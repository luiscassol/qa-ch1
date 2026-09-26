'use strict';

const { test, expect } = require('../../fixtures/api.fixture');
const { allure } = require('allure-playwright');
const { assertMatchesSchema } = require('../../utils/schema-validator');
const { attachResponse } = require('../../utils/report');
const { DEFAULT_INSTRUMENT_ID } = require('../../factories/order.factory');

const instrumentsSchema = require('../../schemas/instruments.schema.json');

/**
 * P2 — Instrument catalog
 *
 * Verifies that GET /instruments returns a complete and valid catalog.
 * These are read-only tests — no state modification required.
 *
 * Why P2 (normal severity):
 *   The catalog is a prerequisite for placing orders (instrument_id comes from here).
 *   If the catalog is broken or incomplete, all order creation tests would fail.
 *   However, the catalog itself is unlikely to break independently of the order flow.
 *
 * Business rules under test:
 *   BR-CAT-001: Catalog must contain at least one tradeable instrument.
 *   BR-CAT-002: Each instrument must have a positive last_price and close_price.
 *   BR-CAT-003: The instrument used in all other tests (id=1, DYCA) must exist.
 */

test.describe('P2 - Instrument catalog @p2', () => {
  /** Full instrument catalog, fetched once and shared across all tests in this describe block. */
  let catalog;

  test.beforeEach(async ({ resetApi, instrumentsApi }) => {
    await resetApi.reset();
    const response = await instrumentsApi.getAll();
    catalog = response;

    await allure.severity('normal');
    await allure.parentSuite('P2 — Medium');
    await allure.suite('Instruments');
    await allure.subSuite('Catalog');
    await allure.epic('Instruments');
    await allure.feature('Instrument catalog');

    test.info().annotations.push(
      { type: 'endpoint', description: 'GET /instruments' },
    );
  });

  // ─── Happy paths ──────────────────────────────────────────────────────────────

  test('GET /instruments returns 200 with a non-empty list @p2', async () => {
    await allure.story('Catalog availability');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-CAT-001: catalog must have at least one instrument' },
      { type: 'technique', description: 'Happy path' },
    );

    await attachResponse('instruments-response', catalog.body);

    expect(catalog.status, 'GET /instruments should return 200').toBe(200);
    expect(Array.isArray(catalog.body), 'Response body should be an array').toBe(true);
    expect(catalog.body.length, 'Catalog should have at least one instrument').toBeGreaterThan(0);

    test.info().annotations.push({ type: 'catalogSize', description: String(catalog.body.length) });
  });

  test('Catalog matches instruments schema @p2', async () => {
    await allure.story('Catalog schema');
    test.info().annotations.push(
      { type: 'schema', description: 'schemas/instruments.schema.json' },
      { type: 'technique', description: 'Contract testing — AJV schema validation' },
    );

    expect(catalog.status, 'GET /instruments should return 200').toBe(200);
    assertMatchesSchema(instrumentsSchema, catalog.body, 'GET /instruments body');
  });

  test('Default test instrument (id=1, DYCA) exists in catalog @p2', async () => {
    await allure.story('Test instrument availability');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-CAT-003: instrument id=1 (DYCA) must be present — it is the fixture used in all order tests' },
      { type: 'technique', description: 'Happy path — fixture dependency check' },
    );

    expect(catalog.status).toBe(200);
    const instrument = catalog.body.find((i) => i.id === DEFAULT_INSTRUMENT_ID);

    expect(instrument, `Instrument id=${DEFAULT_INSTRUMENT_ID} must exist in catalog`).toBeDefined();
    expect(instrument.ticker, 'Default instrument ticker should be DYCA').toBe('DYCA');
    expect(instrument.last_price, 'last_price must be a positive number').toBeGreaterThan(0);
    expect(instrument.close_price, 'close_price must be a non-negative number').toBeGreaterThanOrEqual(0);
    expect(instrument.type, 'type field must be present and non-empty').toBeTruthy();

    test.info().annotations.push({
      type: 'instrumentSnapshot',
      description: `id=${instrument.id} ticker=${instrument.ticker} last_price=${instrument.last_price} type=${instrument.type}`,
    });
  });

  // ─── Data integrity ───────────────────────────────────────────────────────────

  test('All instruments have a positive last_price @p2', async () => {
    await allure.story('Catalog data integrity');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-CAT-002: last_price must be > 0 for all instruments' },
      { type: 'technique', description: 'EP — check all items in the catalog' },
    );

    expect(catalog.status).toBe(200);

    const invalid = catalog.body.filter((i) => !(i.last_price > 0));
    expect(
      invalid,
      `Found ${invalid.length} instrument(s) with last_price <= 0: ${JSON.stringify(invalid.map((i) => i.ticker))}`
    ).toHaveLength(0);
  });

  test('All instruments have a non-negative close_price @p2', async () => {
    await allure.story('Catalog data integrity');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-CAT-002: close_price must be >= 0 for all instruments' },
      { type: 'technique', description: 'EP — check all items in the catalog' },
    );

    expect(catalog.status).toBe(200);

    const invalid = catalog.body.filter((i) => typeof i.close_price !== 'number' || i.close_price < 0);
    expect(
      invalid,
      `Found ${invalid.length} instrument(s) with invalid close_price: ${JSON.stringify(invalid.map((i) => i.ticker))}`
    ).toHaveLength(0);
  });

  test('All instruments have a non-empty ticker and name @p2', async () => {
    await allure.story('Catalog data integrity');
    test.info().annotations.push(
      { type: 'businessRule', description: 'BR-CAT-001: every instrument must have a valid ticker and name' },
      { type: 'technique', description: 'EP — check all items in the catalog' },
    );

    expect(catalog.status).toBe(200);

    const invalidTicker = catalog.body.filter((i) => !i.ticker || i.ticker.trim() === '');
    expect(
      invalidTicker,
      `Found ${invalidTicker.length} instrument(s) with empty ticker`
    ).toHaveLength(0);

    const invalidName = catalog.body.filter((i) => !i.name || i.name.trim() === '');
    expect(
      invalidName,
      `Found ${invalidName.length} instrument(s) with empty name`
    ).toHaveLength(0);
  });
});
