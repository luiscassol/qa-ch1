'use strict';

const { test, expect } = require('../../fixtures/api.fixture');
const { allure } = require('allure-playwright');
const { buildMarketBuyOrder, buildLimitBuyOrder } = require('../../factories/order.factory');
const { assertMatchesSchema } = require('../../utils/schema-validator');
const { attachResponse } = require('../../utils/report');

const orderSchema = require('../../schemas/order.schema.json');
const portfolioSchema = require('../../schemas/portfolio.schema.json');
const instrumentsSchema = require('../../schemas/instruments.schema.json');
const errorSchema = require('../../schemas/error.schema.json');

/**
 * P1 — API contract: schema validation
 *
 * Verifies that every endpoint returns a stable, documented response shape.
 * Uses AJV (JSON Schema draft-07) against the schemas in /schemas.
 *
 * These tests act as a regression net: if the API silently changes its
 * response structure, schema validation will catch it before it impacts clients.
 *
 * Endpoints covered:
 *   GET  /instruments          → instruments.schema.json
 *   POST /orders (MARKET BUY)  → order.schema.json
 *   POST /orders (LIMIT BUY)   → order.schema.json
 *   GET  /orders               → array, each item matches order.schema.json
 *   GET  /portfolio            → portfolio.schema.json
 *   POST /orders (invalid)     → error.schema.json
 *   POST /reset                → 200 status
 */

test.describe('P1 - API contract (schema validation) @p1', () => {
  test.beforeEach(async ({ resetApi }) => {
    await resetApi.reset();

    await allure.severity('critical');
    await allure.parentSuite('P1 — High');
    await allure.suite('Contract');
    await allure.subSuite('Schema validation');
    await allure.epic('API Contract');
    await allure.feature('Schema validation');
  });

  // ─── GET /instruments ─────────────────────────────────────────────────────────

  test('GET /instruments returns 200 and matches instruments schema @p1', async ({ instrumentsApi }) => {
    await allure.story('Instruments contract');
    test.info().annotations.push(
      { type: 'endpoint', description: 'GET /instruments' },
      { type: 'schema', description: 'schemas/instruments.schema.json' },
      { type: 'technique', description: 'Contract testing — AJV schema validation' },
    );

    const response = await instrumentsApi.getAll();
    await attachResponse('instruments-response', response.body);

    expect(response.status, 'GET /instruments should return 200').toBe(200);
    assertMatchesSchema(instrumentsSchema, response.body, 'GET /instruments body');
    expect(response.body.length, 'Instruments list should not be empty').toBeGreaterThan(0);
  });

  // ─── POST /orders ─────────────────────────────────────────────────────────────

  test('POST /orders (MARKET BUY) returns 201 and matches order schema @p1', async ({ ordersApi }) => {
    await allure.story('Orders contract — MARKET BUY');
    test.info().annotations.push(
      { type: 'endpoint', description: 'POST /orders' },
      { type: 'schema', description: 'schemas/order.schema.json' },
      { type: 'technique', description: 'Contract testing — AJV schema validation' },
    );

    const response = await ordersApi.create(buildMarketBuyOrder());
    await attachResponse('order-response', response.body);

    expect(response.status, 'POST /orders (MARKET BUY) should return 201').toBe(201);
    assertMatchesSchema(orderSchema, response.body, 'POST /orders body');
  });

  test('POST /orders (LIMIT BUY) returns 201 and matches order schema @p1', async ({ ordersApi }) => {
    await allure.story('Orders contract — LIMIT BUY');
    test.info().annotations.push(
      { type: 'endpoint', description: 'POST /orders' },
      { type: 'schema', description: 'schemas/order.schema.json' },
      { type: 'technique', description: 'Contract testing — AJV schema validation' },
    );

    const response = await ordersApi.create(buildLimitBuyOrder());
    await attachResponse('order-response', response.body);

    expect(response.status, 'POST /orders (LIMIT BUY) should return 201').toBe(201);
    assertMatchesSchema(orderSchema, response.body, 'POST /orders body');
  });

  // ─── GET /orders ──────────────────────────────────────────────────────────────

  test('GET /orders returns 200 and each item matches order schema @p1', async ({ ordersApi }) => {
    await allure.story('Orders list contract');
    test.info().annotations.push(
      { type: 'endpoint', description: 'GET /orders' },
      { type: 'schema', description: 'schemas/order.schema.json (validated per item)' },
      { type: 'technique', description: 'Contract testing — AJV schema validation on each element' },
    );

    // Create an order so the list is non-empty — validates schema against real data.
    await ordersApi.create(buildMarketBuyOrder());

    const response = await ordersApi.getAll();
    await attachResponse('orders-list-response', response.body);

    expect(response.status, 'GET /orders should return 200').toBe(200);
    expect(Array.isArray(response.body), 'GET /orders body should be an array').toBe(true);
    expect(response.body.length, 'GET /orders should have at least one order').toBeGreaterThan(0);

    test.info().annotations.push({ type: 'itemCount', description: String(response.body.length) });

    response.body.forEach((order, i) => {
      assertMatchesSchema(orderSchema, order, `orders[${i}]`);
    });
  });

  // ─── GET /portfolio ───────────────────────────────────────────────────────────

  test('GET /portfolio returns 200 and matches portfolio schema @p1', async ({ portfolioApi }) => {
    await allure.story('Portfolio contract');
    test.info().annotations.push(
      { type: 'endpoint', description: 'GET /portfolio' },
      { type: 'schema', description: 'schemas/portfolio.schema.json' },
      { type: 'technique', description: 'Contract testing — AJV schema validation' },
    );

    const response = await portfolioApi.get();
    await attachResponse('portfolio-response', response.body);

    expect(response.status, 'GET /portfolio should return 200').toBe(200);
    assertMatchesSchema(portfolioSchema, response.body, 'GET /portfolio body');
  });

  // ─── Error responses ──────────────────────────────────────────────────────────

  test('POST /orders with invalid payload returns 400 and matches error schema @p1', async ({ ordersApi }) => {
    await allure.story('Error response contract');
    test.info().annotations.push(
      { type: 'endpoint', description: 'POST /orders (invalid payload)' },
      { type: 'schema', description: 'schemas/error.schema.json' },
      { type: 'technique', description: 'Contract testing — AJV schema validation on error response' },
    );

    // Intentionally empty payload — triggers validation error.
    const response = await ordersApi.create({});
    await attachResponse('error-response', response.body);

    expect(response.status, 'Invalid POST /orders should return 400').toBe(400);
    assertMatchesSchema(errorSchema, response.body, 'error response body');
  });

  // ─── POST /reset ──────────────────────────────────────────────────────────────

  test('POST /reset returns 200 @p1', async ({ resetApi }) => {
    await allure.story('Reset contract');
    test.info().annotations.push(
      { type: 'endpoint', description: 'POST /reset' },
      { type: 'businessRule', description: 'BR-RST-001: reset must always return 200' },
      { type: 'technique', description: 'Contract testing — status code verification' },
    );

    // beforeEach already called reset; calling again tests the endpoint directly.
    const response = await resetApi.reset();
    await attachResponse('reset-response', response.body);

    expect(response.status, 'POST /reset should return 200').toBe(200);
  });
});
