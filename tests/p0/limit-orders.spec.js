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

  test('LIMIT BUY creates PENDING order and reserves cash @p0', async ({ ordersApi, portfolioApi }) => {
    await allure.story('BUY PENDING — cash reservation');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-006: LIMIT starts PENDING | BR-RSV-001: cash reserved at limit_price' },
      { type: 'technique', description: 'Happy path' },
    );

    const limitPrice = 40.00;
    const qty = 1;
    let orderId;

    await test.step('Create LIMIT BUY order', async () => {
      const order = await ordersApi.create(buildLimitBuyOrder({ quantity: qty, price: limitPrice }));
      await attachResponse('order-response', order.body);
      assertLimitOrderPending(order, { side: 'BUY', quantity: qty });
      orderId = order.body.id;
      test.info().annotations.push({ type: 'orderId', description: String(orderId) });
    });

    await test.step('Cash is reduced by quantity × limit_price (reservation)', async () => {
      const portfolio = await portfolioApi.get();
      await attachResponse('portfolio-after-limit-buy', portfolio.body);
      assertPortfolioCash(portfolio, calcCashAfterLimitBuyPending(1_000_000, qty, limitPrice));
    });

    await test.step('No holding created yet (order is still PENDING)', async () => {
      const portfolio = await portfolioApi.get();
      assertNoHolding(portfolio, DEFAULT_INSTRUMENT_ID);
    });
  });

  test('LIMIT SELL creates PENDING order with no cash impact @p0', async ({ ordersApi, portfolioApi }) => {
    await allure.story('SELL PENDING — no cash reservation');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-006: LIMIT starts PENDING | SELL reservation does not affect cash' },
      { type: 'technique', description: 'Happy path — requires existing holding' },
    );

    const qty = 1;
    let cashAfterBuy;

    await test.step('Setup: buy shares to create a holding', async () => {
      const buyOrder = await ordersApi.create(buildMarketBuyOrder({ quantity: qty }));
      await attachResponse('setup-buy-order', buyOrder.body);
      cashAfterBuy = calcCashAfterMarketBuy(1_000_000, qty, lastPrice);
    });

    await test.step('Create LIMIT SELL order', async () => {
      const limitSellPrice = 50.00; // above last_price, stays PENDING
      const order = await ordersApi.create(buildLimitSellOrder({ quantity: qty, price: limitSellPrice }));
      await attachResponse('order-response', order.body);
      assertLimitOrderPending(order, { side: 'SELL', quantity: qty });
      test.info().annotations.push({ type: 'orderId', description: String(order.body.id) });
    });

    await test.step('Cash is unchanged (SELL does not reserve cash)', async () => {
      const portfolio = await portfolioApi.get();
      await attachResponse('portfolio-after-limit-sell', portfolio.body);
      assertPortfolioCash(portfolio, cashAfterBuy);
    });

    await test.step('Holding still exists (order is still PENDING)', async () => {
      const portfolio = await portfolioApi.get();
      assertHolding(portfolio, DEFAULT_INSTRUMENT_ID, qty);
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
