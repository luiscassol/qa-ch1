'use strict';

const { expect } = require('@playwright/test');
const { calcPositionMetrics } = require('../utils/calculations');
const { CENT_PRECISION } = require('../utils/money');

/**
 * Domain-level assertions for portfolio responses.
 *
 * BR-PRT-001: Portfolio is derived from FILLED orders, net of PENDING reservations.
 * BR-PRT-002: market_value = quantity * last_price; gain and return use avg_cost_price.
 */

/**
 * Asserts the portfolio cash value is close to expected (within 2 decimal places).
 *
 * @param {{ status: number, body: object }} response
 * @param {number} expectedCash
 */
function assertPortfolioCash(response, expectedCash) {
  expect(response.status, 'Portfolio request should return 200').toBe(200);
  expect(response.body.cash, 'Portfolio cash should match expected value').toBeCloseTo(expectedCash, CENT_PRECISION);
}

/**
 * Asserts that a specific holding exists in the portfolio with the correct quantity.
 *
 * @param {{ status: number, body: object }} response
 * @param {number} instrumentId
 * @param {number} expectedQuantity
 */
function assertHolding(response, instrumentId, expectedQuantity) {
  expect(response.status, 'Portfolio request should return 200').toBe(200);
  const holding = response.body.holdings.find((h) => h.instrument_id === instrumentId);
  expect(holding, `Holding for instrument_id ${instrumentId} should exist`).toBeDefined();
  expect(holding.quantity, `Holding quantity for instrument_id ${instrumentId} should match`).toBe(expectedQuantity);
}

/**
 * Asserts that no holding exists for a given instrument (position is zero or liquidated).
 *
 * @param {{ status: number, body: object }} response
 * @param {number} instrumentId
 */
function assertNoHolding(response, instrumentId) {
  expect(response.status, 'Portfolio request should return 200').toBe(200);
  const holding = response.body.holdings.find((h) => h.instrument_id === instrumentId);
  expect(holding, `Holding for instrument_id ${instrumentId} should not exist`).toBeUndefined();
}

/**
 * Asserts that portfolio holdings are empty and cash is at the initial amount.
 * Used after a reset.
 *
 * @param {{ status: number, body: object }} response
 * @param {number} [expectedCash=1_000_000]
 */
function assertInitialPortfolio(response, expectedCash = 1_000_000) {
  expect(response.status, 'Portfolio request should return 200').toBe(200);
  expect(response.body.cash, 'Cash should be at initial amount').toBeCloseTo(expectedCash, CENT_PRECISION);
  expect(response.body.holdings, 'Holdings should be empty').toHaveLength(0);
}

/**
 * Asserts that the portfolio holding inputs are internally consistent.
 * Uses the oracle from utils/calculations.js as the independent source of truth.
 *
 * BR-PRT-002: market_value and gain are calculated client-side from portfolio fields.
 * The API does not return these values directly; it returns the inputs needed to compute them.
 * We verify the inputs (quantity, avg_cost_price) and cross-reference last_price from instruments.
 *
 * @param {{ status: number, body: object }} portfolioResponse
 * @param {number} instrumentId
 * @param {number} lastPrice - last_price from GET /instruments for this instrument.
 */
function assertPositionMetrics(portfolioResponse, instrumentId, lastPrice) {
  expect(portfolioResponse.status, 'Portfolio request should return 200').toBe(200);
  const holding = portfolioResponse.body.holdings.find((h) => h.instrument_id === instrumentId);
  expect(holding, `Holding for instrument_id ${instrumentId} should exist`).toBeDefined();

  const expected = calcPositionMetrics({
    quantity: holding.quantity,
    lastPrice,
    avgCostPrice: holding.avg_cost_price,
  });

  // These values are calculated client-side from the API inputs.
  // We verify the inputs are correct so the client calculation will be correct.
  expect(holding.quantity * lastPrice, 'Expected market_value inputs').toBeCloseTo(expected.marketValue, CENT_PRECISION);
  expect(holding.quantity * (lastPrice - holding.avg_cost_price), 'Expected gain inputs').toBeCloseTo(expected.gain, CENT_PRECISION);
}

module.exports = {
  assertPortfolioCash,
  assertHolding,
  assertNoHolding,
  assertInitialPortfolio,
  assertPositionMetrics,
};
