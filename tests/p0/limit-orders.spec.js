'use strict';

const { test, expect } = require('../../fixtures/api.fixture');
const { allure } = require('allure-playwright');
const { buildMarketBuyOrder, buildLimitBuyOrder, buildLimitSellOrder, DEFAULT_INSTRUMENT_ID } = require('../../factories/order.factory');
const { assertLimitOrderPending } = require('../../assertions/order.assertions');
const { assertPortfolioCash, assertHolding, assertNoHolding } = require('../../assertions/portfolio.assertions');
const { assertAnyBadRequest } = require('../../assertions/error.assertions');
const { calcCashAfterMarketBuy, calcCashAfterLimitBuyPending } = require('../../utils/calculations');
const { waitForStableOrderStatus } = require('../../utils/polling');

/**
 * P0 — LIMIT order lifecycle
 *
 * Verifies LIMIT order creation, cash reservation, and state resolution.
 *
 * LIMIT orders are nondeterministic: resolution is lazy (triggered by GET /orders)
 * and depends on current market prices. Tests use a status-consistent oracle to
 * validate the correct invariant for whatever stable state the order reaches.
 *
 * Business rules under test:
 *   BR-ORD-006: LIMIT orders are created as PENDING
 *   BR-RSV-001: A PENDING BUY LIMIT reserves quantity * limit_price from cash
 *   BR-ORD-003: LIMIT BUY requires cash >= quantity * limit_price (for reservation)
 *   BR-ORD-004: LIMIT SELL requires holdings >= quantity
 */

/** Attaches a JSON API response to the report for traceability. */
async function attachResponse(label, body) {
  await test.info().attach(label, {
    body: JSON.stringify(body, null, 2),
    contentType: 'application/json',
  });
}

test.describe('P0 - LIMIT order lifecycle @p0', () => {
  let lastPrice;

  test.beforeEach(async ({ resetApi, instrumentsApi }) => {
    await resetApi.reset();

    const instruments = await instrumentsApi.getAll();
    const instrument = instruments.body.find((i) => i.id === DEFAULT_INSTRUMENT_ID);
    expect(instrument, `Instrument id=${DEFAULT_INSTRUMENT_ID} must exist in catalog`).toBeDefined();
    lastPrice = instrument.last_price;

    await allure.severity('blocker');
    await allure.parentSuite('P0 — Critical');
    await allure.suite('Orders');
    await allure.subSuite('LIMIT lifecycle');
    await allure.epic('Orders');
    await allure.feature('LIMIT order lifecycle');

    test.info().annotations.push(
      { type: 'instrument', description: `id=${DEFAULT_INSTRUMENT_ID} last_price=${lastPrice}` },
      { type: 'endpoint', description: 'POST /orders, GET /orders, GET /portfolio' },
    );
  });

  // ─── Happy paths ─────────────────────────────────────────────────────────────

  test('LIMIT BUY immediate response is PENDING (BR-ORD-006) @p0', async ({ ordersApi }) => {
    await allure.story('BUY — immediate PENDING response');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-006: POST /orders for a LIMIT order must always return PENDING immediately' },
      { type: 'technique', description: 'Happy path — verifies synchronous response contract' },
      { type: 'note', description: 'Portfolio state after creation is verified in the oracle test (nondeterministic resolution)' },
    );

    const order = await ordersApi.create(buildLimitBuyOrder({ quantity: 1, price: 40.00 }));
    await attachResponse('order-response', order.body);

    // The POST /orders response must ALWAYS be PENDING for LIMIT orders, regardless
    // of whether the order subsequently resolves (FILLED/CANCELLED) on the next GET.
    assertLimitOrderPending(order, { side: 'BUY', quantity: 1 });
    test.info().annotations.push({ type: 'orderId', description: String(order.body.id) });
  });

  test('LIMIT SELL creates PENDING order and satisfies its invariant (oracle) @p0', async ({ ordersApi, portfolioApi }) => {
    await allure.story('SELL oracle — state-consistent invariant');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-006: LIMIT SELL starts PENDING | SELL does not reserve cash' },
      { type: 'technique', description: 'Status-consistent oracle — same approach as LIMIT BUY oracle' },
    );

    const qty = 1;
    let cashAfterBuy;
    let orderId;

    await test.step('Setup: buy shares to create a holding', async () => {
      const buyOrder = await ordersApi.create(buildMarketBuyOrder({ quantity: qty }));
      await attachResponse('setup-buy-order', buyOrder.body);
      cashAfterBuy = calcCashAfterMarketBuy(1_000_000, qty, lastPrice);
    });

    await test.step('Create LIMIT SELL — verify immediate PENDING response', async () => {
      const limitSellPrice = 50.00; // above last_price, tends to stay PENDING
      const order = await ordersApi.create(buildLimitSellOrder({ quantity: qty, price: limitSellPrice }));
      await attachResponse('order-response', order.body);
      // The immediate POST response must always be PENDING (BR-ORD-006).
      assertLimitOrderPending(order, { side: 'SELL', quantity: qty });
      orderId = order.body.id;
      test.info().annotations.push({ type: 'orderId', description: String(orderId) });
    });

    await test.step('Wait for stable order status via oracle', async () => {
      const stableOrder = await waitForStableOrderStatus(
        () => ordersApi.getAll(),
        orderId,
        { timeoutMs: 15_000, intervalMs: 1_500 },
      );

      expect(stableOrder, 'LIMIT SELL should reach a stable status within polling window').not.toBeNull();
      await attachResponse('stable-order', stableOrder);
      test.info().annotations.push({ type: 'stableStatus', description: stableOrder.status });
    });

    await test.step('Portfolio reflects a valid post-LIMIT-SELL state', async () => {
      // NOTE: GET /portfolio can itself trigger LIMIT resolution, so the portfolio
      // state may differ from the last oracle reading. We validate any VALID state:
      //   - If holding exists: SELL is still PENDING → cash = cashAfterBuy (no reservation for SELL)
      //   - If holding gone:   SELL resolved (FILLED/CANCELLED) → cash ≥ cashAfterBuy
      const portfolio = await portfolioApi.get();
      await attachResponse('portfolio-stable', portfolio.body);

      const holding = portfolio.body.holdings.find((h) => h.instrument_id === DEFAULT_INSTRUMENT_ID);

      if (holding) {
        // SELL still PENDING: cash is unchanged (SELL does NOT reserve cash, unlike BUY)
        assertPortfolioCash(portfolio, cashAfterBuy);
        assertHolding(portfolio, DEFAULT_INSTRUMENT_ID, qty);
        test.info().annotations.push({ type: 'portfolioState', description: 'SELL PENDING — holding preserved, cash unchanged (no reservation)' });
      } else {
        // SELL resolved: cash should have been credited
        expect(
          portfolio.body.cash,
          'If SELL resolved, cash should be >= cashAfterBuy (credited or unchanged)'
        ).toBeGreaterThanOrEqual(cashAfterBuy - 0.01); // -0.01 for float tolerance
        test.info().annotations.push({ type: 'portfolioState', description: 'SELL resolved — holding gone' });
      }
    });
  });

  // ─── Status-consistent oracle ─────────────────────────────────────────────────

  test('LIMIT BUY reaches a consistent state and satisfies its invariant (oracle) @p0', async ({ ordersApi, portfolioApi }) => {
    await allure.story('BUY oracle — state-consistent invariant');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-006, BR-RSV-001: invariant holds for any stable LIMIT state' },
      { type: 'technique', description: 'Status-consistent oracle: read twice, validate stable state invariant' },
    );

    // Use last_price as limit price to maximize chance of FILLED resolution,
    // exercising both the PENDING and FILLED paths depending on market state.
    const limitPrice = lastPrice;
    const qty = 1;
    let orderId;

    await test.step('Create LIMIT BUY order at last_price', async () => {
      const order = await ordersApi.create(buildLimitBuyOrder({ quantity: qty, price: limitPrice }));
      await attachResponse('order-response', order.body);
      assertLimitOrderPending(order, { side: 'BUY', quantity: qty });
      orderId = order.body.id;
      test.info().annotations.push({ type: 'orderId', description: String(orderId) });
    });

    await test.step('Wait for a stable order status (two identical consecutive reads)', async () => {
      const stableOrder = await waitForStableOrderStatus(
        () => ordersApi.getAll(),
        orderId,
        { timeoutMs: 15_000, intervalMs: 1_500 },
      );

      expect(stableOrder, 'Order should reach a stable status within the polling window').not.toBeNull();
      await attachResponse('stable-order', stableOrder);
      test.info().annotations.push({ type: 'stableStatus', description: stableOrder.status });

      if (stableOrder.status === 'PENDING') {
        await test.step('Invariant: PENDING — cash is reserved at limit_price', async () => {
          const portfolio = await portfolioApi.get();
          await attachResponse('portfolio-pending', portfolio.body);
          assertPortfolioCash(portfolio, calcCashAfterLimitBuyPending(1_000_000, qty, limitPrice));
          assertNoHolding(portfolio, DEFAULT_INSTRUMENT_ID);
        });
      } else if (stableOrder.status === 'FILLED') {
        await test.step('Invariant: FILLED — cash is debited at execution price, holding exists', async () => {
          const executionPrice = stableOrder.price;
          const portfolio = await portfolioApi.get();
          await attachResponse('portfolio-filled', portfolio.body);
          assertPortfolioCash(portfolio, calcCashAfterLimitBuyPending(1_000_000, qty, executionPrice));
          assertHolding(portfolio, DEFAULT_INSTRUMENT_ID, qty);
        });
      } else {
        // CANCELLED or other final state: just verify the order list reflects it.
        test.info().annotations.push({ type: 'note', description: `Order resolved as ${stableOrder.status}` });
      }
    });
  });

  // ─── Rejection paths ──────────────────────────────────────────────────────────

  test('LIMIT BUY is rejected when reservation cost exceeds available cash @p0', async ({ ordersApi }) => {
    await allure.story('BUY rejection — insufficient cash for reservation');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-003: LIMIT BUY reservation requires cash >= quantity * limit_price' },
      { type: 'technique', description: 'Error guessing — limit_price > total cash' },
    );

    // A single share at 1,500,000 ARS exceeds the 1,000,000 ARS starting balance.
    const order = await ordersApi.create(buildLimitBuyOrder({ quantity: 1, price: 1_500_000 }));
    await attachResponse('rejection-response', order.body);
    assertAnyBadRequest(order);
  });

  test('LIMIT SELL is rejected with no holdings @p0', async ({ ordersApi }) => {
    await allure.story('SELL rejection — no holdings');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-004: LIMIT SELL requires holdings >= quantity' },
      { type: 'technique', description: 'Error guessing — sell after reset (zero holdings)' },
    );

    const order = await ordersApi.create(buildLimitSellOrder({ quantity: 1 }));
    await attachResponse('rejection-response', order.body);
    assertAnyBadRequest(order);
  });
});
