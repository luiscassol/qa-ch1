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
 * Asserts that the portfolio holding contains valid inputs for client-side metric calculation.
 *
 * BR-PRT-002: market_value and gain are calculated client-side from portfolio fields.
 * The API does NOT return these computed values; it returns the inputs:
 *   - quantity, last_price, avg_cost_price (all present in GET /portfolio holdings)
 *
 * This assertion:
 *   1. Verifies all required fields exist and are positive numbers (presence check).
 *   2. Verifies avg_cost_price ≈ executionPrice when provided — confirms the API tracks
 *      cost basis from the actual MARKET execution price (non-tautological cross-check).
 *   3. Verifies ordered quantity matches (non-tautological cross-check).
 *
 * @param {{ status: number, body: object }} response
 * @param {number} instrumentId
 * @param {object} [options]
 * @param {number} [options.executionPrice] - Expected avg_cost_price (= MARKET last_price at order time).
 * @param {number} [options.orderedQuantity] - Expected holding quantity.
 */
function assertPositionMetrics(response, instrumentId, options = {}) {
  const { executionPrice, orderedQuantity } = options;

  expect(response.status, 'Portfolio request should return 200').toBe(200);
  const holding = response.body.holdings.find((h) => h.instrument_id === instrumentId);
  expect(holding, `Holding for instrument_id ${instrumentId} should exist`).toBeDefined();

  // All calculation inputs must be present and positive (BR-PRT-002 field presence).
  expect(holding.last_price, 'last_price must exist and be > 0').toBeGreaterThan(0);
  expect(holding.avg_cost_price, 'avg_cost_price must exist and be > 0').toBeGreaterThan(0);
  expect(holding.quantity, 'quantity must exist and be > 0').toBeGreaterThan(0);

  // Non-tautological cross-check: avg_cost_price should equal the MARKET execution price.
  // For a MARKET order, execution_price = last_price at order time → API must track this.
  if (executionPrice !== undefined) {
    expect(
      holding.avg_cost_price,
      `avg_cost_price (${holding.avg_cost_price}) should match MARKET execution price (${executionPrice})`
    ).toBeCloseTo(executionPrice, CENT_PRECISION);
  }

  // Non-tautological cross-check: quantity in portfolio must match what was ordered.
  if (orderedQuantity !== undefined) {
    expect(
      holding.quantity,
      `holding quantity (${holding.quantity}) should match ordered quantity (${orderedQuantity})`
    ).toBe(orderedQuantity);
  }

  // Oracle: independently compute market_value and gain to confirm inputs are usable.
  const { marketValue, gain } = calcPositionMetrics({
    quantity: holding.quantity,
    lastPrice: holding.last_price,
    avgCostPrice: holding.avg_cost_price,
  });
  expect(marketValue, 'oracle: computed market_value must be positive').toBeGreaterThan(0);
  expect(typeof gain, 'oracle: computed gain must be a number').toBe('number');
}

module.exports = {
  assertPortfolioCash,
  assertHolding,
  assertNoHolding,
  assertInitialPortfolio,
  assertPositionMetrics,
};
