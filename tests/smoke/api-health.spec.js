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

test.describe('API smoke @smoke', () => {
  test('GET /instruments returns the instrument catalog', async ({ instrumentsApi }) => {
    await test.step('Fetch instrument catalog', async () => {
      const response = await instrumentsApi.getAll();
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
    await test.step('Reset account', async () => {
      const reset = await resetApi.reset();
      expect(reset.status).toBe(200);
      expect(reset.body.ok).toBe(true);
    });

    await test.step('Portfolio is at initial state', async () => {
      const response = await portfolioApi.get();
      expect(response.status).toBe(200);
      expect(response.body.cash).toBe(1_000_000);
      expect(response.body.holdings).toHaveLength(0);
    });
  });

  test('GET /orders returns empty list after reset', async ({ ordersApi, resetApi }) => {
    await test.step('Reset account', async () => {
      await resetApi.reset();
    });

    await test.step('Orders list is empty', async () => {
      const response = await ordersApi.getAll();
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });
  });
});
