'use strict';

const { test: base } = require('@playwright/test');
const { getInstruments } = require('../api/instruments-api');
const { searchInstruments } = require('../api/search-api');
const { getOrders, createOrder } = require('../api/orders-api');
const { getPortfolio } = require('../api/portfolio-api');
const { resetAccount } = require('../api/reset-api');

/**
 * Extended Playwright test fixture that injects typed API clients.
 *
 * Usage in tests:
 *   const { test } = require('../../fixtures/api.fixture');
 *   test('...', async ({ instrumentsApi, ordersApi, portfolioApi, resetApi }) => { ... });
 *
 * The `request` object from Playwright carries the shared headers configured
 * in playwright.config.js (X-Enable-Bugs, X-Candidate-Id, Content-Type).
 */
const test = base.extend({
  /**
   * Instruments API client.
   * GET /instruments
   */
  instrumentsApi: async ({ request }, use) => {
    await use({
      getAll: () => getInstruments(request),
    });
  },

  /**
   * Search API client.
   * GET /search?query=
   */
  searchApi: async ({ request }, use) => {
    await use({
      search: (query) => searchInstruments(request, query),
    });
  },

  /**
   * Orders API client.
   * GET /orders, POST /orders
   */
  ordersApi: async ({ request }, use) => {
    await use({
      getAll: () => getOrders(request),
      create: (payload) => createOrder(request, payload),
    });
  },

  /**
   * Portfolio API client.
   * GET /portfolio
   */
  portfolioApi: async ({ request }, use) => {
    await use({
      get: () => getPortfolio(request),
    });
  },

  /**
   * Reset API client.
   * POST /reset
   *
   * Resets the candidate account to: 1,000,000 ARS cash, no orders, no holdings.
   */
  resetApi: async ({ request }, use) => {
    await use({
      reset: () => resetAccount(request),
    });
  },
});

const { expect } = base;

module.exports = { test, expect };
