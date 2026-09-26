'use strict';

const { test, expect } = require('../../fixtures/api.fixture');
const { allure } = require('allure-playwright');
const { buildMarketBuyOrder, buildLimitBuyOrder, buildLimitSellOrder } = require('../../factories/order.factory');
const { assertAnyBadRequest } = require('../../assertions/error.assertions');
const { attachResponse } = require('../../utils/report');
const scenarios = require('../data/invalid-orders.json');

/**
 * P1 — Order input validation
 *
 * Data-driven tests using the EP/BVA decision table in tests/data/invalid-orders.json.
 * Each scenario sends an invalid payload and expects a 400 Bad Request response.
 *
 * Technique: Equivalence Partitioning (EP) + Boundary Value Analysis (BVA).
 * Each category covers one invalid partition; BVA entries target exact boundaries.
 *
 * Business rules under test:
 *   BR-VAL-001: quantity must be a positive integer
 *   BR-VAL-002: side must be 'BUY' or 'SELL' (case-sensitive)
 *   BR-VAL-003: type must be 'MARKET' or 'LIMIT' (case-sensitive)
 *   BR-VAL-004: instrument_id must reference a valid instrument
 *   BR-VAL-005: LIMIT orders require a price field
 */

/**
 * Builds the payload for a scenario entry from the decision table.
 * Applies overrides and removes omitted fields from a valid base payload.
 *
 * @param {object} scenario
 * @param {'marketBuy'|'limitBuy'|'limitSell'} [defaultBase]
 * @returns {object}
 */
function buildPayload(scenario, defaultBase = 'marketBuy') {
  const base = scenario.base || defaultBase;

  let payload;
  if (base === 'limitBuy') payload = buildLimitBuyOrder();
  else if (base === 'limitSell') payload = buildLimitSellOrder();
  else payload = buildMarketBuyOrder();

  if (scenario.overrides) Object.assign(payload, scenario.overrides);
  if (scenario.omit) scenario.omit.forEach((field) => delete payload[field]);

  return payload;
}

/** Annotates the test with the defect ID if the scenario is a known defect. */
function annotateIfDefect(scenario) {
  if (scenario._defect) {
    test.info().annotations.push({ type: 'defect', description: scenario._defect });
  }
}

test.describe('P1 - Order input validation @p1', () => {
  test.beforeEach(async ({ resetApi }) => {
    await resetApi.reset();

    await allure.severity('critical');
    await allure.parentSuite('P1 — High');
    await allure.suite('Orders');
    await allure.subSuite('Input validation');
    await allure.epic('Orders');
    await allure.feature('Input validation');
  });

  // ─── Invalid quantity ─────────────────────────────────────────────────────────

  test.describe('Invalid quantity (EP + BVA)', () => {
    for (const scenario of scenarios.invalidQuantity) {
      test(`rejects order: ${scenario.description} @p1`, async ({ ordersApi }) => {
        await allure.story('Invalid quantity');
        test.info().annotations.push(
          { type: 'businessRule', description: 'BR-VAL-001: quantity must be a positive integer' },
          { type: 'technique', description: scenario.technique || 'EP' },
          { type: 'payload', description: JSON.stringify(buildPayload(scenario)) },
        );
        annotateIfDefect(scenario);

        const order = await ordersApi.create(buildPayload(scenario));
        await attachResponse('rejection-response', order.body);
        assertAnyBadRequest(order);
      });
    }
  });

  // ─── Invalid side ─────────────────────────────────────────────────────────────

  test.describe('Invalid side (EP)', () => {
    for (const scenario of scenarios.invalidSide) {
      test(`rejects order: ${scenario.description} @p1`, async ({ ordersApi }) => {
        await allure.story('Invalid side');
        test.info().annotations.push(
          { type: 'businessRule', description: "BR-VAL-002: side must be 'BUY' or 'SELL' (case-sensitive)" },
          { type: 'technique', description: scenario.technique || 'EP' },
          { type: 'payload', description: JSON.stringify(buildPayload(scenario)) },
        );
        annotateIfDefect(scenario);

        const order = await ordersApi.create(buildPayload(scenario));
        await attachResponse('rejection-response', order.body);
        assertAnyBadRequest(order);
      });
    }
  });

  // ─── Invalid type ─────────────────────────────────────────────────────────────

  test.describe('Invalid type (EP)', () => {
    for (const scenario of scenarios.invalidType) {
      test(`rejects order: ${scenario.description} @p1`, async ({ ordersApi }) => {
        await allure.story('Invalid type');
        test.info().annotations.push(
          { type: 'businessRule', description: "BR-VAL-003: type must be 'MARKET' or 'LIMIT' (case-sensitive)" },
          { type: 'technique', description: scenario.technique || 'EP' },
          { type: 'payload', description: JSON.stringify(buildPayload(scenario)) },
        );
        annotateIfDefect(scenario);

        const order = await ordersApi.create(buildPayload(scenario));
        await attachResponse('rejection-response', order.body);
        assertAnyBadRequest(order);
      });
    }
  });

  // ─── Invalid instrument_id ────────────────────────────────────────────────────

  test.describe('Invalid instrument_id (EP + BVA)', () => {
    for (const scenario of scenarios.invalidInstrumentId) {
      test(`rejects order: ${scenario.description} @p1`, async ({ ordersApi }) => {
        await allure.story('Invalid instrument_id');
        test.info().annotations.push(
          { type: 'businessRule', description: 'BR-VAL-004: instrument_id must reference an existing instrument' },
          { type: 'technique', description: scenario.technique || 'EP' },
          { type: 'payload', description: JSON.stringify(buildPayload(scenario)) },
        );
        annotateIfDefect(scenario);

        const order = await ordersApi.create(buildPayload(scenario));
        await attachResponse('rejection-response', order.body);
        assertAnyBadRequest(order);
      });
    }
  });

  // ─── LIMIT without price ──────────────────────────────────────────────────────

  test.describe('LIMIT order without price (EP)', () => {
    for (const scenario of scenarios.limitWithoutPrice) {
      test(`rejects order: ${scenario.description} @p1`, async ({ ordersApi }) => {
        await allure.story('LIMIT without price');
        test.info().annotations.push(
          { type: 'businessRule', description: 'BR-VAL-005: LIMIT orders require a price field' },
          { type: 'technique', description: scenario.technique || 'EP' },
          { type: 'payload', description: JSON.stringify(buildPayload(scenario)) },
        );
        annotateIfDefect(scenario);

        const order = await ordersApi.create(buildPayload(scenario));
        await attachResponse('rejection-response', order.body);
        assertAnyBadRequest(order);
      });
    }
  });

  // ─── LIMIT with invalid price (includes F-01) ─────────────────────────────────

  test.describe('LIMIT order with invalid price (BVA + F-01)', () => {
    for (const scenario of scenarios.limitWithInvalidPrice) {
      test(`rejects order: ${scenario.description} @p1`, async ({ ordersApi }) => {
        await allure.story('LIMIT invalid price');
        test.info().annotations.push(
          { type: 'businessRule', description: 'LIMIT price must be > 0' },
          { type: 'technique', description: scenario.technique || 'BVA' },
          { type: 'payload', description: JSON.stringify(buildPayload(scenario)) },
        );
        annotateIfDefect(scenario);

        const order = await ordersApi.create(buildPayload(scenario));
        await attachResponse('rejection-response', order.body);
        assertAnyBadRequest(order);
      });
    }
  });
});
