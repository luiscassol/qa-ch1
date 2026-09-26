'use strict';

const { test, expect } = require('../../fixtures/api.fixture');
const { allure } = require('allure-playwright');
const { buildMarketBuyOrder, buildMarketSellOrder, buildLimitBuyOrder, DEFAULT_INSTRUMENT_ID } = require('../../factories/order.factory');
const { assertInitialPortfolio, assertPortfolioCash, assertHolding, assertNoHolding, assertPositionMetrics } = require('../../assertions/portfolio.assertions');
const { calcCashAfterMarketBuy } = require('../../utils/calculations');
const { attachResponse } = require('../../utils/report');

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
 * F-01 baseline defect: LIMIT BUY with price ≤ 0 is accepted in tier 'off'
 *   and a negative price can inflate available cash via a negative reservation.
 */

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

      // assertPositionMetrics verifies that:
      //   - all required fields (last_price, avg_cost_price, quantity) exist and are positive
      //   - avg_cost_price ≈ lastPrice (MARKET execution price captured from beforeEach)
      //   - quantity matches what was ordered
      assertPositionMetrics(portfolio, DEFAULT_INSTRUMENT_ID, {
        executionPrice: lastPrice,
        orderedQuantity: qty,
      });

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

  test('F-01: LIMIT BUY with price<=0 should be rejected and must not inflate cash @p0', async ({ ordersApi, portfolioApi }) => {
    await allure.story('F-01 baseline — non-positive price accepted and can inflate cash');
    test.info().annotations.push(
      { type: 'businessRule', description: 'LIMIT price must be > 0 (confirmed by the team; client form requires the same)' },
      { type: 'technique', description: 'Error guessing — boundary: price = -1 plus cash-side effect' },
      { type: 'defect', description: 'F-01: LIMIT BUY with price<=0 is accepted in tier off. Expected: 400. Negative price can raise cash above 1,000,000.' },
      { type: 'severity', description: 'High — a negative reservation corrupts cash accounting' },
    );

    // Expected to FAIL in tier 'off'. Do NOT use test.fail() — the failure is the defect.
    // Cash is checked first so the financial impact is reported even when status is wrong.
    const order = await ordersApi.create(buildLimitBuyOrder({ price: -1 }));
    await attachResponse('order-response', order.body);

    const portfolio = await portfolioApi.get();
    await attachResponse('portfolio-after-negative-limit', portfolio.body);
    expect(
      portfolio.body.cash,
      'F-01: a non-positive LIMIT price must not inflate available cash above the initial 1,000,000'
    ).toBeLessThanOrEqual(1_000_000);

    expect(order.status, 'F-01: price<=0 should return 400').toBe(400);
  });
});
