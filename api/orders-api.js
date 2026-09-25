'use strict';

const { get, post } = require('./api-client');

/**
 * GET /orders
 * Returns the order history for the current candidate.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @returns {Promise<{ status: number, body: Array }>}
 */
async function getOrders(request) {
  return get(request, '/orders');
}

/**
 * POST /orders
 * Creates a new order.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {object} payload
 * @param {number} payload.instrument_id
 * @param {'BUY'|'SELL'} payload.side
 * @param {'MARKET'|'LIMIT'} payload.type
 * @param {number} payload.quantity
 * @param {number} [payload.price] - Required for LIMIT orders.
 * @returns {Promise<{ status: number, body: object }>}
 */
async function createOrder(request, payload) {
  return post(request, '/orders', payload);
}

module.exports = { getOrders, createOrder };
