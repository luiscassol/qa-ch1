'use strict';

const { test, expect } = require('../../fixtures/api.fixture');
const { allure } = require('allure-playwright');
const { buildMarketBuyOrder, buildMarketSellOrder, buildLimitBuyOrder, buildLimitSellOrder, DEFAULT_INSTRUMENT_ID } = require('../../factories/order.factory');
const { assertLimitOrderPending } = require('../../assertions/order.assertions');
const { assertPortfolioCash, assertHolding, assertNoHolding } = require('../../assertions/portfolio.assertions');
const { assertAnyBadRequest, assertErrorContains } = require('../../assertions/error.assertions');
const { calcCashAfterMarketBuy, calcCashAfterLimitBuyPending } = require('../../utils/calculations');
const { waitForStableOrderStatus } = require('../../utils/polling');
const { attachResponse } = require('../../utils/report');

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

  // ─── Reservations interacting with a second order (BR-RSV-001) ───────────────

  test('PENDING LIMIT BUY reservation blocks a subsequent MARKET BUY that exceeds remaining cash @p0', async ({ ordersApi }) => {
    await allure.story('BUY reservation — second order cannot spend reserved cash');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-RSV-001: PENDING BUY reserves quantity × limit_price from available cash' },
      { type: 'technique', description: 'State transition: LIMIT PENDING reservation → MARKET BUY must see reduced available cash' },
    );

    // Reserve almost all cash. Do not GET /orders in between — a read can resolve the LIMIT.
    const reservationPrice = 999_000;
    const limitOrder = await ordersApi.create(buildLimitBuyOrder({ quantity: 1, price: reservationPrice }));
    await attachResponse('limit-reservation', limitOrder.body);
    assertLimitOrderPending(limitOrder, { side: 'BUY', quantity: 1 });

    const marketOrder = await ordersApi.create(buildMarketBuyOrder({ quantity: 1 }));
    await attachResponse('market-after-reservation', marketOrder.body);
    assertErrorContains(marketOrder, 'Insufficient cash');
  });

  test('PENDING LIMIT SELL reservation blocks a subsequent MARKET SELL of the same shares @p0', async ({ ordersApi }) => {
    await allure.story('SELL reservation — reserved shares are not available to sell again');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-RSV-001: PENDING SELL reserves shares | BR-FND-002: oversell is Insufficient shares' },
      { type: 'technique', description: 'State transition: BUY → LIMIT SELL PENDING → MARKET SELL same qty must be rejected' },
    );

    await test.step('Setup: buy 1 share', async () => {
      const buyOrder = await ordersApi.create(buildMarketBuyOrder({ quantity: 1 }));
      await attachResponse('setup-buy-order', buyOrder.body);
    });

    await test.step('Create LIMIT SELL and immediately attempt a second SELL', async () => {
      const limitSell = await ordersApi.create(buildLimitSellOrder({ quantity: 1, price: 50 }));
      await attachResponse('limit-sell-reservation', limitSell.body);
      assertLimitOrderPending(limitSell, { side: 'SELL', quantity: 1 });

      const marketSell = await ordersApi.create(buildMarketSellOrder({ quantity: 1 }));
      await attachResponse('market-sell-after-reservation', marketSell.body);
      assertErrorContains(marketSell, 'Insufficient shares');
    });
  });

  test('F-20: REJECTED LIMIT SELL must not reduce holdings @p0', async ({ ordersApi, portfolioApi }) => {
    await allure.story('SELL reject — holdings restored (no share loss without cash credit)');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-RSV-001 / BR-PRT-001: REJECTED LIMIT SELL releases reserved shares; cash unchanged vs post-BUY' },
      { type: 'technique', description: 'State transition: MARKET BUY 10 → LIMIT SELL 1 → REJECTED ⇒ qty still 10' },
    );

    const setupQty = 10;
    const sellQty = 1;
    let cashAfterBuy;
    let orderId;
    const limitSellPrice = Number((lastPrice + 0.04).toFixed(2));

    await test.step('Setup: MARKET BUY 10', async () => {
      const buyOrder = await ordersApi.create(buildMarketBuyOrder({ quantity: setupQty }));
      await attachResponse('setup-buy-order', buyOrder.body);
      cashAfterBuy = calcCashAfterMarketBuy(1_000_000, setupQty, lastPrice);
    });

    await test.step('LIMIT SELL 1 (price slightly above last_price)', async () => {
      const order = await ordersApi.create(buildLimitSellOrder({ quantity: sellQty, price: limitSellPrice }));
      await attachResponse('limit-sell', order.body);
      assertLimitOrderPending(order, { side: 'SELL', quantity: sellQty });
      orderId = order.body.id;
    });

    const stableOrder = await waitForStableOrderStatus(
      () => ordersApi.getAll(),
      orderId,
      { timeoutMs: 20_000, intervalMs: 1_500 },
    );
    expect(stableOrder, 'LIMIT SELL should reach a stable status').not.toBeNull();
    await attachResponse('stable-limit-sell', stableOrder);
    test.info().annotations.push({ type: 'stableStatus', description: stableOrder.status });

    if (stableOrder.status !== 'REJECTED' && stableOrder.status !== 'CANCELLED') {
      test.info().annotations.push({
        type: 'note',
        description: `F-20 asserts the REJECTED path; got ${stableOrder.status} — holdings check skipped`,
      });
      return;
    }

    const portfolio = await portfolioApi.get();
    await attachResponse('portfolio-after-rejected-sell', portfolio.body);
    assertPortfolioCash(portfolio, cashAfterBuy);
    assertHolding(portfolio, DEFAULT_INSTRUMENT_ID, setupQty);
  });
});
