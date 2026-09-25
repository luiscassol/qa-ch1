'use strict';

const { test, expect } = require('../../fixtures/api.fixture');
const { allure } = require('allure-playwright');
const { buildMarketBuyOrder, buildMarketSellOrder, DEFAULT_INSTRUMENT_ID } = require('../../factories/order.factory');
const { assertMarketOrderFilled } = require('../../assertions/order.assertions');
const { assertPortfolioCash, assertHolding, assertNoHolding } = require('../../assertions/portfolio.assertions');
const { assertAnyBadRequest } = require('../../assertions/error.assertions');
const { calcCashAfterMarketBuy, calcCashAfterMarketSell, calcSharesFromArs } = require('../../utils/calculations');

/**
 * P0 — MARKET order settlement
 *
 * Verifies that MARKET orders execute immediately at last_price and that
 * cash and holdings reflect the correct post-trade state.
 *
 * Business rules under test:
 *   BR-ORD-001: MARKET BUY requires cash >= quantity * last_price
 *   BR-ORD-002: MARKET SELL requires holdings >= quantity
 *   BR-ORD-005: MARKET orders fill immediately at last_price
 *   BR-PRT-001: Cash is debited/credited correctly after settlement
 */

/** Attaches a JSON API response to the report for traceability. */
async function attachResponse(label, body) {
  await test.info().attach(label, {
    body: JSON.stringify(body, null, 2),
    contentType: 'application/json',
  });
}

test.describe('P0 - MARKET order settlement @p0', () => {
  /** last_price of the default instrument, fetched before each test. */
  let lastPrice;

  test.beforeEach(async ({ resetApi, instrumentsApi }) => {
    await resetApi.reset();

    // Fetch last_price here so each test works with the current market price.
    const instruments = await instrumentsApi.getAll();
    const instrument = instruments.body.find((i) => i.id === DEFAULT_INSTRUMENT_ID);
    expect(instrument, `Instrument id=${DEFAULT_INSTRUMENT_ID} must exist in catalog`).toBeDefined();
    lastPrice = instrument.last_price;

    // Allure taxonomy — common to all tests in this describe block.
    await allure.severity('blocker');
    await allure.parentSuite('P0 — Critical');
    await allure.suite('Orders');
    await allure.subSuite('MARKET settlement');
    await allure.epic('Orders');
    await allure.feature('MARKET order settlement');

    test.info().annotations.push(
      { type: 'instrument', description: `id=${DEFAULT_INSTRUMENT_ID} ticker=${instrument.ticker} last_price=${lastPrice}` },
      { type: 'endpoint', description: 'POST /orders, GET /portfolio' },
    );
  });

  // ─── Happy paths ────────────────────────────────────────────────────────────

  test('MARKET BUY fills at last_price and debits cash @p0', async ({ ordersApi, portfolioApi }) => {
    await allure.story('BUY happy path');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-005: MARKET fills at last_price | BR-PRT-001: cash debited' },
      { type: 'technique', description: 'Happy path' },
    );

    const qty = 1;
    let order;

    await test.step('Create MARKET BUY order', async () => {
      order = await ordersApi.create(buildMarketBuyOrder({ quantity: qty }));
      await attachResponse('order-response', order.body);
      assertMarketOrderFilled(order, {
        side: 'BUY',
        quantity: qty,
        price: lastPrice,
        instrumentId: DEFAULT_INSTRUMENT_ID,
      });
      test.info().annotations.push({ type: 'orderId', description: String(order.body.id) });
    });

    await test.step('Cash decreases by quantity × last_price', async () => {
      const portfolio = await portfolioApi.get();
      await attachResponse('portfolio-after-buy', portfolio.body);
      assertPortfolioCash(portfolio, calcCashAfterMarketBuy(1_000_000, qty, lastPrice));
    });

    await test.step('Holding is created for the instrument', async () => {
      const portfolio = await portfolioApi.get();
      assertHolding(portfolio, DEFAULT_INSTRUMENT_ID, qty);
    });
  });

  test('MARKET SELL fills at last_price and credits cash @p0', async ({ ordersApi, portfolioApi }) => {
    await allure.story('SELL happy path');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-005: MARKET fills at last_price | BR-PRT-001: cash credited' },
      { type: 'technique', description: 'Happy path — buy then full liquidation' },
    );

    const qty = 2;
    let cashAfterBuy;

    await test.step('Setup: buy shares to create a holding', async () => {
      const buyOrder = await ordersApi.create(buildMarketBuyOrder({ quantity: qty }));
      await attachResponse('setup-buy-order', buyOrder.body);
      cashAfterBuy = calcCashAfterMarketBuy(1_000_000, qty, lastPrice);
    });

    await test.step('Create MARKET SELL order', async () => {
      const order = await ordersApi.create(buildMarketSellOrder({ quantity: qty }));
      await attachResponse('order-response', order.body);
      assertMarketOrderFilled(order, {
        side: 'SELL',
        quantity: qty,
        price: lastPrice,
        instrumentId: DEFAULT_INSTRUMENT_ID,
      });
      test.info().annotations.push({ type: 'orderId', description: String(order.body.id) });
    });

    await test.step('Cash is credited back (buy + sell same qty restores balance)', async () => {
      const portfolio = await portfolioApi.get();
      await attachResponse('portfolio-after-sell', portfolio.body);
      assertPortfolioCash(portfolio, calcCashAfterMarketSell(cashAfterBuy, qty, lastPrice));
    });

    await test.step('Holding is removed after full liquidation', async () => {
      const portfolio = await portfolioApi.get();
      assertNoHolding(portfolio, DEFAULT_INSTRUMENT_ID);
    });
  });

  // ─── BVA: boundary at maximum affordable quantity ────────────────────────────

  test('MARKET BUY at maximum affordable quantity succeeds (BVA: upper boundary) @p0', async ({ ordersApi, portfolioApi }) => {
    await allure.story('BUY boundary — max affordable quantity');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-001: cash >= quantity * last_price' },
      { type: 'technique', description: 'BVA — upper boundary: floor(cash / last_price)' },
    );

    const maxQty = calcSharesFromArs(1_000_000, lastPrice);
    test.info().annotations.push({ type: 'maxQuantity', description: String(maxQty) });

    await test.step(`Buy maximum ${maxQty} shares`, async () => {
      const order = await ordersApi.create(buildMarketBuyOrder({ quantity: maxQty }));
      await attachResponse('order-response', order.body);
      assertMarketOrderFilled(order, {
        side: 'BUY',
        quantity: maxQty,
        price: lastPrice,
        instrumentId: DEFAULT_INSTRUMENT_ID,
      });
      test.info().annotations.push({ type: 'orderId', description: String(order.body.id) });
    });

    await test.step('Cash is debited for the full purchase', async () => {
      const portfolio = await portfolioApi.get();
      await attachResponse('portfolio-after-buy', portfolio.body);
      assertPortfolioCash(portfolio, calcCashAfterMarketBuy(1_000_000, maxQty, lastPrice));
    });
  });

  test('MARKET BUY one share over budget is rejected (BVA: just above maximum) @p0', async ({ ordersApi }) => {
    await allure.story('BUY boundary — insufficient cash');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-001: insufficient cash must be rejected' },
      { type: 'technique', description: 'BVA — just above upper boundary: floor(cash / last_price) + 1' },
    );

    const maxQty = calcSharesFromArs(1_000_000, lastPrice);
    test.info().annotations.push({ type: 'attemptedQuantity', description: String(maxQty + 1) });

    const order = await ordersApi.create(buildMarketBuyOrder({ quantity: maxQty + 1 }));
    await attachResponse('rejection-response', order.body);
    assertAnyBadRequest(order);
  });

  // ─── Insufficient holdings ───────────────────────────────────────────────────

  test('MARKET SELL with no holdings is rejected @p0', async ({ ordersApi }) => {
    await allure.story('SELL rejection — no holdings');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-002: SELL requires existing holdings' },
      { type: 'technique', description: 'Error guessing — sell after reset (zero holdings)' },
    );

    const order = await ordersApi.create(buildMarketSellOrder({ quantity: 1 }));
    await attachResponse('rejection-response', order.body);
    assertAnyBadRequest(order);
  });

  test('MARKET SELL more shares than owned is rejected (BVA: oversell) @p0', async ({ ordersApi }) => {
    await allure.story('SELL boundary — oversell');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-ORD-002: SELL quantity must not exceed holdings' },
      { type: 'technique', description: 'BVA — oversell: owned + 1' },
    );

    const ownedQty = 1;

    await test.step('Setup: buy 1 share', async () => {
      const buyOrder = await ordersApi.create(buildMarketBuyOrder({ quantity: ownedQty }));
      await attachResponse('setup-buy-order', buyOrder.body);
    });

    await test.step('Attempt to sell owned + 1 shares', async () => {
      const order = await ordersApi.create(buildMarketSellOrder({ quantity: ownedQty + 1 }));
      await attachResponse('rejection-response', order.body);
      assertAnyBadRequest(order);
    });
  });
});
