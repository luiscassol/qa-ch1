'use strict';

const { expect } = require('@playwright/test');

/**
 * Domain-level assertions for order responses.
 *
 * These check business behavior, not just HTTP status.
 * Each assertion validates a specific business rule (BR-ORD-*).
 */

/**
 * Asserts that an order creation response is a successful FILLED MARKET order.
 * BR-ORD-005: MARKET orders are immediately FILLED at last_price.
 *
 * @param {{ status: number, body: object }} response
 * @param {object} expected
 * @param {number} expected.instrumentId
 * @param {'BUY'|'SELL'} expected.side
 * @param {number} expected.quantity
 * @param {number} expected.price - Expected execution price (last_price).
 */
function assertMarketOrderFilled(response, expected) {
  const bodyStr = JSON.stringify(response.body);
  expect(response.status, `MARKET order should return 201. Body: ${bodyStr}`).toBe(201);
  expect(response.body.status, `MARKET order status should be FILLED. Body: ${bodyStr}`).toBe('FILLED');
  expect(response.body.side, 'Order side should match').toBe(expected.side);
  expect(response.body.quantity, 'Order quantity should match').toBe(expected.quantity);
  expect(response.body.price, 'MARKET order price should equal last_price').toBeCloseTo(expected.price, 2);
  expect(response.body.instrument_id, 'Instrument ID should match').toBe(expected.instrumentId);
  expect(response.body.id, 'Order should have an ID').toBeDefined();
}

/**
 * Asserts that an order creation response is a PENDING LIMIT order.
 * BR-ORD-006: LIMIT orders start as PENDING.
 *
 * @param {{ status: number, body: object }} response
 * @param {object} expected
 * @param {'BUY'|'SELL'} expected.side
 * @param {number} expected.quantity
 */
function assertLimitOrderPending(response, expected) {
  const bodyStr = JSON.stringify(response.body);
  expect(response.status, `LIMIT order should return 201. Body: ${bodyStr}`).toBe(201);
  expect(response.body.status, `LIMIT order initial status should be PENDING. Body: ${bodyStr}`).toBe('PENDING');
  expect(response.body.side, 'Order side should match').toBe(expected.side);
  expect(response.body.quantity, 'Order quantity should match').toBe(expected.quantity);
  expect(response.body.id, 'Order should have an ID').toBeDefined();
}

/**
 * Asserts that a request was rejected with a business error.
 *
 * @param {{ status: number, body: object }} response
 * @param {string} expectedError - Exact error message from the API.
 */
function assertOrderRejected(response, expectedError) {
  expect(response.status, `Order should be rejected with 400, got ${response.status}`).toBe(400);
  expect(response.body.error, 'Error message should match').toBe(expectedError);
}

module.exports = {
  assertMarketOrderFilled,
  assertLimitOrderPending,
  assertOrderRejected,
};
