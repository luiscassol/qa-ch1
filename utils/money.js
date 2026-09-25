'use strict';

/**
 * Monetary comparison helpers.
 *
 * The API uses floating-point numbers for cash and prices (e.g. 999542.8).
 * Direct equality comparisons are fragile due to floating-point arithmetic.
 * These helpers provide tolerance-based comparisons.
 */

const CENT_PRECISION = 2; // 0.01 ARS tolerance

/**
 * Returns true if two monetary values are equal within 2 decimal places (centavos).
 *
 * @param {number} actual
 * @param {number} expected
 * @returns {boolean}
 */
function moneyEquals(actual, expected) {
  return Math.abs(actual - expected) < Math.pow(10, -CENT_PRECISION);
}

/**
 * Rounds a monetary value to 2 decimal places.
 *
 * @param {number} value
 * @returns {number}
 */
function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

module.exports = { moneyEquals, roundMoney, CENT_PRECISION };
