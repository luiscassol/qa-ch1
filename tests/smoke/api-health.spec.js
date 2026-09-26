'use strict';

/**
 * Smoke tests — @smoke
 *
 * Verify that the API is reachable and the candidate account is functional.
 * These are the entry criteria for the full test suite:
 * if these fail, nothing else is worth running.
 *
 * BR-HDR-001: X-Enable-Bugs is required and valid.
 * BR-HDR-002: X-Candidate-Id is required.
 * BR-ISO-001: State is isolated by candidate.
 * BR-RST-001: Reset restores initial state.
 */

const { test, expect } = require('../../fixtures/api.fixture');
const { allure } = require('allure-playwright');
const { attachResponse } = require('../../utils/report');

test.describe('API smoke @smoke', () => {
  test.beforeEach(async () => {
    await allure.severity('blocker');
    await allure.parentSuite('Smoke — Entry criteria');
    await allure.suite('API Health');
    await allure.epic('API');
    await allure.feature('API Health');
  });

  test('GET /instruments returns the instrument catalog', async ({ instrumentsApi }) => {
    await allure.subSuite('Instruments');
    await allure.story('Catalog reachable');
    test.info().annotations.push(
      { type: 'endpoint', description: 'GET /instruments' },
      { type: 'businessRule', description: 'BR-HDR-001: API must be reachable with correct headers' },
      { type: 'technique', description: 'Happy path — entry criteria' },
    );

    await test.step('Fetch instrument catalog', async () => {
      const response = await instrumentsApi.getAll();
      await attachResponse('instruments-response', response.body);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    await test.step('Each instrument has required fields', async () => {
      const response = await instrumentsApi.getAll();
      for (const instrument of response.body) {
        expect(instrument.id).toBeDefined();
        expect(instrument.ticker).toBeDefined();
        expect(instrument.name).toBeDefined();
        expect(instrument.type).toBeDefined();
        expect(typeof instrument.last_price).toBe('number');
        expect(typeof instrument.close_price).toBe('number');
      }
    });
  });

  test('GET /portfolio returns initial state for candidate', async ({ portfolioApi, resetApi }) => {
    await allure.subSuite('Portfolio');
    await allure.story('Initial state');
    test.info().annotations.push(
      { type: 'endpoint', description: 'POST /reset, GET /portfolio' },
      { type: 'businessRule', description: 'BR-RST-001: reset restores 1,000,000 ARS and empty holdings' },
      { type: 'technique', description: 'Happy path — entry criteria' },
    );

    await test.step('Reset account', async () => {
      const reset = await resetApi.reset();
      await attachResponse('reset-response', reset.body);
      expect(reset.status).toBe(200);
    });

    await test.step('Portfolio is at initial state', async () => {
      const response = await portfolioApi.get();
      await attachResponse('portfolio-response', response.body);
      expect(response.status).toBe(200);
      expect(response.body.cash).toBe(1_000_000);
      expect(response.body.holdings).toHaveLength(0);
    });
  });

  test('GET /orders returns empty list after reset', async ({ ordersApi, resetApi }) => {
    await allure.subSuite('Orders');
    await allure.story('Empty after reset');
    test.info().annotations.push(
      { type: 'endpoint', description: 'POST /reset, GET /orders' },
      { type: 'businessRule', description: 'BR-RST-001: reset clears order history' },
      { type: 'technique', description: 'Happy path — entry criteria' },
    );

    await test.step('Reset account', async () => {
      const reset = await resetApi.reset();
      expect(reset.status).toBe(200);
    });

    await test.step('Orders list is empty', async () => {
      const response = await ordersApi.getAll();
      await attachResponse('orders-response', response.body);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });
  });
});
