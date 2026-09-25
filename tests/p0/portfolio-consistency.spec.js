'use strict';

const { test, expect } = require('../../fixtures/api.fixture');
const { allure } = require('allure-playwright');
const { buildMarketBuyOrder, buildMarketSellOrder, buildLimitBuyOrder, DEFAULT_INSTRUMENT_ID } = require('../../factories/order.factory');
const { assertInitialPortfolio, assertPortfolioCash, assertHolding, assertNoHolding, assertPositionMetrics } = require('../../assertions/portfolio.assertions');
const { calcCashAfterMarketBuy } = require('../../utils/calculations');

/**
 * P0 — Portfolio consistency
 *
 * Verifies that portfolio state is accurate after trades and that the
 * inputs needed for client-side metric calculations are correct.
 *
 * Business rules under test:
 *   BR-RST-001: Reset restores initial state (1,000,000 ARS, no holdings)
 *   BR-PRT-001: Portfolio reflects FILLED orders and PENDING reservations
 *   BR-PRT-002: Holdings contain quantity, last_price, avg_cost_price
 *               so market_value and gain can be computed client-side
 *
 * F-01 baseline defect: LIMIT BUY with price=0 is accepted in tier 'off'
 *   (documented here as a failing test to establish the defect baseline)
 */

/** Attaches a JSON API response to the report for traceability. */
async function attachResponse(label, body) {
  await test.info().attach(label, {
    body: JSON.stringify(body, null, 2),
    contentType: 'application/json',
  });
}

test.describe('P0 - Portfolio consistency @p0', () => {
  let lastPrice;

  test.beforeEach(async ({ resetApi, instrumentsApi }) => {
    await resetApi.reset();

    const instruments = await instrumentsApi.getAll();
    const instrument = instruments.body.find((i) => i.id === DEFAULT_INSTRUMENT_ID);
    expect(instrument, `Instrument id=${DEFAULT_INSTRUMENT_ID} must exist`).toBeDefined();
    lastPrice = instrument.last_price;

    await allure.severity('blocker');
    await allure.parentSuite('P0 — Critical');
    await allure.suite('Portfolio');
    await allure.subSuite('Consistency');
    await allure.epic('Portfolio');
    await allure.feature('Portfolio consistency');

    test.info().annotations.push(
      { type: 'instrument', description: `id=${DEFAULT_INSTRUMENT_ID} last_price=${lastPrice}` },
      { type: 'endpoint', description: 'GET /portfolio, POST /reset' },
    );
  });

  // ─── Reset ───────────────────────────────────────────────────────────────────

  test('Portfolio is at initial state after reset @p0', async ({ portfolioApi }) => {
    await allure.story('Reset — initial state');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-RST-001: reset restores 1,000,000 ARS and empty holdings' },
      { type: 'technique', description: 'Happy path' },
    );

    const portfolio = await portfolioApi.get();
    await attachResponse('portfolio-after-reset', portfolio.body);
    assertInitialPortfolio(portfolio);
  });

  test('Reset restores initial state after trades @p0', async ({ ordersApi, portfolioApi, resetApi }) => {
    await allure.story('Reset — state restoration after trades');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-RST-001: reset clears all orders and holdings' },
      { type: 'technique', description: 'State transition: initial → traded → reset → initial' },
    );

    await test.step('Trade: buy shares to modify state', async () => {
      const buyOrder = await ordersApi.create(buildMarketBuyOrder({ quantity: 2 }));
      await attachResponse('buy-order', buyOrder.body);
    });

    await test.step('Verify state is modified', async () => {
      const portfolio = await portfolioApi.get();
      expect(portfolio.body.cash, 'Cash should be less than initial after trade').toBeLessThan(1_000_000);
      expect(portfolio.body.holdings.length, 'Holdings should not be empty').toBeGreaterThan(0);
    });

    await test.step('Reset account', async () => {
      const reset = await resetApi.reset();
      expect(reset.status).toBe(200);
    });

    await test.step('Portfolio is back to initial state', async () => {
      const portfolio = await portfolioApi.get();
      await attachResponse('portfolio-after-reset', portfolio.body);
      assertInitialPortfolio(portfolio);
    });
  });

  // ─── Position metrics ─────────────────────────────────────────────────────────

  test('Portfolio holding contains correct inputs for client-side metric calculation @p0', async ({ ordersApi, portfolioApi }) => {
    await allure.story('Position metrics — oracle verification');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-PRT-002: quantity * last_price = market_value; quantity * (last_price - avg_cost_price) = gain' },
      { type: 'technique', description: 'Independent oracle: verifies API inputs, not computed values' },
    );

    const qty = 3;

    await test.step('Buy shares to create a holding with avg_cost_price', async () => {
      const buyOrder = await ordersApi.create(buildMarketBuyOrder({ quantity: qty }));
      await attachResponse('buy-order', buyOrder.body);
    });

    await test.step('Verify holding inputs are correct for client-side calculation', async () => {
      const portfolio = await portfolioApi.get();
      await attachResponse('portfolio', portfolio.body);

      assertHolding(portfolio, DEFAULT_INSTRUMENT_ID, qty);

      // assertPositionMetrics uses the independent oracle (calculations.js) to verify
      // that quantity, last_price, and avg_cost_price produce correct market_value and gain.
      assertPositionMetrics(portfolio, DEFAULT_INSTRUMENT_ID);

      const holding = portfolio.body.holdings.find((h) => h.instrument_id === DEFAULT_INSTRUMENT_ID);
      test.info().annotations.push({
        type: 'holdingSummary',
        description: `qty=${holding.quantity} last_price=${holding.last_price} avg_cost=${holding.avg_cost_price}`,
      });
    });
  });

  test('Portfolio cash decreases correctly after multiple sequential BUY orders @p0', async ({ ordersApi, portfolioApi }) => {
    await allure.story('Cash consistency — sequential buys');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-PRT-001: each FILLED BUY debits cash by quantity * last_price' },
      { type: 'technique', description: 'State transition: buy → buy → verify cumulative cash' },
    );

    const qty1 = 1;
    const qty2 = 2;

    await test.step('First MARKET BUY', async () => {
      const order = await ordersApi.create(buildMarketBuyOrder({ quantity: qty1 }));
      await attachResponse('first-buy', order.body);
    });

    await test.step('Second MARKET BUY', async () => {
      const order = await ordersApi.create(buildMarketBuyOrder({ quantity: qty2 }));
      await attachResponse('second-buy', order.body);
    });

    await test.step('Cash reflects both purchases', async () => {
      const portfolio = await portfolioApi.get();
      await attachResponse('portfolio-after-two-buys', portfolio.body);

      const expectedCash = calcCashAfterMarketBuy(
        calcCashAfterMarketBuy(1_000_000, qty1, lastPrice),
        qty2,
        lastPrice,
      );
      assertPortfolioCash(portfolio, expectedCash);
      assertHolding(portfolio, DEFAULT_INSTRUMENT_ID, qty1 + qty2);
    });
  });

  // ─── F-01 baseline defect ─────────────────────────────────────────────────────

  test('F-01: LIMIT BUY with price=0 should be rejected but is accepted @p0', async ({ ordersApi }) => {
    await allure.story('F-01 baseline — zero price accepted');
    test.info().annotations.push(
      { type: 'businessRule', description: 'LIMIT price must be > 0 (no explicit BR, implied by financial logic)' },
      { type: 'technique', description: 'Error guessing — boundary: price = 0' },
      { type: 'defect', description: 'F-01: LIMIT BUY with price=0 returns 201 in tier off. Expected: 400.' },
      { type: 'severity', description: 'High — a zero-price reservation corrupts cash accounting' },
    );

    // This test is expected to FAIL in tier 'off' (no bugs enabled).
    // It documents the baseline defect: the API accepts price=0 when it should reject it.
    // Do NOT use test.fail() — that would normalize the failure.
    // The test fails honestly; the defect is tracked via the annotation above.
    const order = await ordersApi.create(buildLimitBuyOrder({ price: 0 }));
    await attachResponse('order-response', order.body);

    expect(order.status, 'F-01: price=0 should return 400 but returns 201').toBe(400);
  });
});
