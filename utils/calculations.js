'use strict';

/**
 * Independent oracle for portfolio and order calculations.
 *
 * These formulas are derived from the confirmed source code in the app-qa repo
 * (src/features/portfolio/portfolioMath.ts) and from the business rules
 * documented in the challenge.
 *
 * "Independent" means this module must NOT import or reuse application code.
 * If the application has a bug in its formula, this oracle would still produce
 * the correct expected value, making the bug detectable.
 *
 * BR-PRT-002: market_value = quantity * last_price
 *             gain         = quantity * (last_price - avg_cost_price)
 *             return_ratio = gain / cost_basis  (0 if cost_basis <= 0)
 *             cost_basis   = quantity * avg_cost_price
 */

/**
 * Calculates the expected portfolio position metrics from API response fields.
 *
 * @param {object} params
 * @param {number} params.quantity
 * @param {number} params.lastPrice
 * @param {number} params.avgCostPrice
 * @returns {{ costBasis: number, marketValue: number, gain: number, returnRatio: number }}
 */
function calcPositionMetrics({ quantity, lastPrice, avgCostPrice }) {
  const costBasis = quantity * avgCostPrice;
  const marketValue = quantity * lastPrice;
  const gain = quantity * (lastPrice - avgCostPrice);
  const returnRatio = costBasis <= 0 ? 0 : gain / costBasis;

  return { costBasis, marketValue, gain, returnRatio };
}

/**
 * Calculates the expected cash impact of a MARKET BUY order.
 * Cash decreases by quantity * last_price.
 *
 * @param {number} cashBefore
 * @param {number} quantity
 * @param {number} lastPrice
 * @returns {number} Expected cash after the order.
 */
function calcCashAfterMarketBuy(cashBefore, quantity, lastPrice) {
  return cashBefore - quantity * lastPrice;
}

/**
 * Calculates the expected cash impact of a MARKET SELL order.
 * Cash increases by quantity * last_price.
 *
 * @param {number} cashBefore
 * @param {number} quantity
 * @param {number} lastPrice
 * @returns {number} Expected cash after the order.
 */
function calcCashAfterMarketSell(cashBefore, quantity, lastPrice) {
  return cashBefore + quantity * lastPrice;
}

/**
 * Calculates the cash reserved by a BUY LIMIT order.
 * BR-RSV-001: A pending BUY reserves quantity * limit_price from cash.
 *
 * @param {number} quantity
 * @param {number} limitPrice
 * @returns {number} Amount reserved.
 */
function calcLimitBuyReservation(quantity, limitPrice) {
  return quantity * limitPrice;
}

/**
 * Calculates expected cash after a BUY LIMIT order is created (PENDING).
 * Cash decreases by the reservation amount.
 *
 * @param {number} cashBefore
 * @param {number} quantity
 * @param {number} limitPrice
 * @returns {number} Expected cash after reservation.
 */
function calcCashAfterLimitBuyPending(cashBefore, quantity, limitPrice) {
  return cashBefore - calcLimitBuyReservation(quantity, limitPrice);
}

/**
 * Calculates the maximum number of shares that can be bought with a given ARS amount.
 * BR-ORD-ARS-001: quantity = Math.floor(amount / last_price)
 *
 * @param {number} arsAmount
 * @param {number} lastPrice
 * @returns {number} Integer number of shares.
 */
function calcSharesFromArs(arsAmount, lastPrice) {
  if (lastPrice <= 0) return 0;
  return Math.floor(arsAmount / lastPrice);
}

module.exports = {
  calcPositionMetrics,
  calcCashAfterMarketBuy,
  calcCashAfterMarketSell,
  calcLimitBuyReservation,
  calcCashAfterLimitBuyPending,
  calcSharesFromArs,
};
