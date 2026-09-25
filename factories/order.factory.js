'use strict';

/**
 * Order payload factory.
 *
 * Provides sensible defaults for valid order payloads.
 * Tests override only the fields relevant to the scenario being tested.
 *
 * Default instrument: DYCA (id: 1, last_price: 45.72)
 * This is the primary instrument used in most test scenarios.
 */

const DEFAULT_INSTRUMENT_ID = 1; // DYCA

/**
 * Builds a valid MARKET BUY order payload.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
function buildMarketBuyOrder(overrides = {}) {
  return {
    instrument_id: DEFAULT_INSTRUMENT_ID,
    side: 'BUY',
    type: 'MARKET',
    quantity: 1,
    ...overrides,
  };
}

/**
 * Builds a valid MARKET SELL order payload.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
function buildMarketSellOrder(overrides = {}) {
  return {
    instrument_id: DEFAULT_INSTRUMENT_ID,
    side: 'SELL',
    type: 'MARKET',
    quantity: 1,
    ...overrides,
  };
}

/**
 * Builds a valid LIMIT BUY order payload.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
function buildLimitBuyOrder(overrides = {}) {
  return {
    instrument_id: DEFAULT_INSTRUMENT_ID,
    side: 'BUY',
    type: 'LIMIT',
    quantity: 1,
    price: 40.00,
    ...overrides,
  };
}

/**
 * Builds a valid LIMIT SELL order payload.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
function buildLimitSellOrder(overrides = {}) {
  return {
    instrument_id: DEFAULT_INSTRUMENT_ID,
    side: 'SELL',
    type: 'LIMIT',
    quantity: 1,
    price: 50.00,
    ...overrides,
  };
}

module.exports = {
  buildMarketBuyOrder,
  buildMarketSellOrder,
  buildLimitBuyOrder,
  buildLimitSellOrder,
  DEFAULT_INSTRUMENT_ID,
};
