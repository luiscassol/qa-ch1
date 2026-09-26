'use strict';

const { test, expect } = require('../../fixtures/api.fixture');
const { allure } = require('allure-playwright');
const { buildMarketBuyOrder } = require('../../factories/order.factory');
const { assertInitialPortfolio } = require('../../assertions/portfolio.assertions');
const { assertOrderAccepted } = require('../../assertions/order.assertions');
const { attachResponse } = require('../../utils/report');

/**
 * P1 — State isolation and reset idempotence
 *
 * Verifies that POST /reset reliably restores a known initial state
 * regardless of prior operations, and that the state between tests is clean.
 *
 * Why this matters:
 *   The entire test suite depends on `beforeEach → reset` to guarantee isolation.
 *   If reset is flaky or incomplete, test results become order-dependent and
 *   unreliable. These tests validate the mechanism that all other tests rely on.
 *
 * Business rules under test:
 *   BR-RST-001: POST /reset restores 1,000,000 ARS cash and empty holdings.
 */

test.describe('P1 - State isolation and reset idempotence @p1', () => {
  // No automatic reset in beforeEach — reset behavior is the subject under test.

  test.beforeEach(async () => {
    await allure.severity('critical');
    await allure.parentSuite('P1 — High');
    await allure.suite('Isolation');
    await allure.subSuite('Reset idempotence');
    await allure.epic('API Contract');
    await allure.feature('State isolation');
  });

  // ─── Idempotence ──────────────────────────────────────────────────────────────

  test('POST /reset is idempotent — two consecutive resets yield the same initial state @p1', async ({ resetApi, portfolioApi }) => {
    await allure.story('Reset idempotence');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-RST-001: idempotent — N resets == 1 reset' },
      { type: 'technique', description: 'State transition: reset → reset → assert initial' },
      { type: 'endpoint', description: 'POST /reset, GET /portfolio' },
    );

    await test.step('First reset', async () => {
      const r = await resetApi.reset();
      expect(r.status, 'First reset should return 200').toBe(200);
    });

    await test.step('Second reset (idempotence check)', async () => {
      const r = await resetApi.reset();
      expect(r.status, 'Second reset should return 200').toBe(200);
    });

    await test.step('State after two resets matches initial state', async () => {
      const portfolio = await portfolioApi.get();
      await attachResponse('portfolio-after-double-reset', portfolio.body);
      assertInitialPortfolio(portfolio);
    });
  });

  // ─── Full state restoration ───────────────────────────────────────────────────

  test('POST /reset after trades restores portfolio to initial state @p1', async ({ resetApi, ordersApi, portfolioApi }) => {
    await allure.story('Reset after trades');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-RST-001: reset clears holdings and restores cash after any number of trades' },
      { type: 'technique', description: 'State transition: initial → traded → reset → initial' },
      { type: 'endpoint', description: 'POST /reset, POST /orders, GET /portfolio' },
    );

    await test.step('Setup: bring to known state', async () => {
      const r = await resetApi.reset();
      expect(r.status).toBe(200);
    });

    await test.step('Trade: buy shares to modify state', async () => {
      const order = await ordersApi.create(buildMarketBuyOrder({ quantity: 5 }));
      await attachResponse('buy-order', order.body);
      assertOrderAccepted(order);
    });

    await test.step('Confirm state is modified after trade', async () => {
      const portfolio = await portfolioApi.get();
      expect(portfolio.body.cash, 'Cash should be reduced after trade').toBeLessThan(1_000_000);
      expect(portfolio.body.holdings.length, 'Holdings should not be empty after trade').toBeGreaterThan(0);
    });

    await test.step('Reset account', async () => {
      const r = await resetApi.reset();
      await attachResponse('reset-response', r.body);
      expect(r.status, 'Reset should return 200').toBe(200);
    });

    await test.step('Portfolio is back to initial state', async () => {
      const portfolio = await portfolioApi.get();
      await attachResponse('portfolio-after-reset', portfolio.body);
      assertInitialPortfolio(portfolio);
    });
  });

  // ─── Order history ────────────────────────────────────────────────────────────

  test('GET /orders returns empty list after reset @p1', async ({ resetApi, ordersApi }) => {
    await allure.story('Reset clears order history');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-RST-001: reset should clear order history' },
      { type: 'technique', description: 'State transition: create orders → reset → verify list empty' },
      { type: 'endpoint', description: 'POST /reset, POST /orders, GET /orders' },
    );

    await test.step('Setup: reset and create orders', async () => {
      await resetApi.reset();
      await ordersApi.create(buildMarketBuyOrder({ quantity: 1 }));
      await ordersApi.create(buildMarketBuyOrder({ quantity: 1 }));
    });

    await test.step('Confirm orders exist before reset', async () => {
      const orders = await ordersApi.getAll();
      expect(orders.status, 'GET /orders should return 200').toBe(200);
      expect(orders.body.length, 'Orders should exist before reset').toBeGreaterThan(0);
      test.info().annotations.push({ type: 'ordersBeforeReset', description: String(orders.body.length) });
    });

    await test.step('Reset account', async () => {
      const r = await resetApi.reset();
      expect(r.status, 'Reset should return 200').toBe(200);
    });

    await test.step('Orders list is empty after reset', async () => {
      const orders = await ordersApi.getAll();
      await attachResponse('orders-after-reset', orders.body);
      expect(orders.status, 'GET /orders should return 200').toBe(200);
      expect(Array.isArray(orders.body), 'GET /orders body should be an array').toBe(true);
      expect(orders.body, 'Order history should be cleared after reset').toHaveLength(0);
    });
  });
});
