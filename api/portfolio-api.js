'use strict';

const { get } = require('./api-client');

/**
 * GET /portfolio
 * Returns cash and holdings for the current candidate.
 *
 * Response shape:
 * {
 *   cash: number,
 *   holdings: Array<{
 *     instrument_id: number,
 *     ticker: string,
 *     quantity: number,
 *     last_price: number,
 *     close_price: number,
 *     avg_cost_price: number
 *   }>
 * }
 *
 * Note: market_value, gain, and return_ratio are NOT returned by the API.
 * They are calculated client-side from the fields above.
 * See utils/calculations.js for the oracle implementation.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @returns {Promise<{ status: number, body: object }>}
 */
async function getPortfolio(request) {
  return get(request, '/portfolio');
}

module.exports = { getPortfolio };
