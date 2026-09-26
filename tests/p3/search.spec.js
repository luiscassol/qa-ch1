'use strict';

const { test, expect } = require('../../fixtures/api.fixture');
const { allure } = require('allure-playwright');
const { assertMatchesSchema } = require('../../utils/schema-validator');
const { attachResponse } = require('../../utils/report');

const instrumentsSchema = require('../../schemas/instruments.schema.json');

/**
 * P3 — Instrument search (GET /search?query=)
 *
 * Verifies that the search endpoint returns correct results for various queries.
 * Search is auxiliary — the app can function without it. Bugs here don't block
 * the order flow.
 *
 * Why P3 (minor severity):
 *   Search failure degrades UX but doesn't prevent trading. A user can still
 *   manually select instruments from the full catalog.
 *
 * Known behavior (confirmed from API client docs):
 *   - Matches by ticker substring, case-insensitive.
 *   - Returns an array of instrument objects (same shape as GET /instruments items).
 */

test.describe('P3 - Instrument search @p3', () => {
  test.beforeEach(async ({ resetApi }) => {
    await resetApi.reset();

    await allure.severity('minor');
    await allure.parentSuite('P3 — Low');
    await allure.suite('Instruments');
    await allure.subSuite('Search');
    await allure.epic('Instruments');
    await allure.feature('Instrument search');

    test.info().annotations.push(
      { type: 'endpoint', description: 'GET /search?query=' },
    );
  });

  // ─── Happy paths ──────────────────────────────────────────────────────────────

  test('Search by exact ticker (DYCA) returns matching result @p3', async ({ searchApi }) => {
    await allure.story('Exact ticker match');
    test.info().annotations.push(
      { type: 'technique', description: 'Happy path — exact ticker query' },
      { type: 'query', description: 'DYCA' },
    );

    const response = await searchApi.search('DYCA');
    await attachResponse('search-response', response.body);

    expect(response.status, 'GET /search should return 200').toBe(200);
    expect(Array.isArray(response.body), 'Search result should be an array').toBe(true);
    expect(response.body.length, 'Exact ticker search should return at least one result').toBeGreaterThan(0);

    const match = response.body.find((i) => i.ticker === 'DYCA');
    expect(match, 'Result should include the instrument with ticker DYCA').toBeDefined();

    test.info().annotations.push({ type: 'resultCount', description: String(response.body.length) });
  });

  test('Search is case-insensitive — lowercase ticker returns same result @p3', async ({ searchApi }) => {
    await allure.story('Case-insensitive search');
    test.info().annotations.push(
      { type: 'technique', description: 'EP — case sensitivity check' },
      { type: 'query', description: 'dyca (lowercase)' },
    );

    const response = await searchApi.search('dyca');
    await attachResponse('search-response', response.body);

    expect(response.status, 'GET /search with lowercase query should return 200').toBe(200);
    expect(Array.isArray(response.body), 'Search result should be an array').toBe(true);
    expect(response.body.length, 'Case-insensitive search should return at least one result').toBeGreaterThan(0);

    const match = response.body.find((i) => i.ticker === 'DYCA');
    expect(match, 'Lowercase query should find DYCA instrument').toBeDefined();
  });

  test('Search by partial ticker returns relevant results @p3', async ({ searchApi }) => {
    await allure.story('Partial ticker match');
    test.info().annotations.push(
      { type: 'technique', description: 'Happy path — substring query' },
      { type: 'query', description: 'DY (partial ticker)' },
    );

    const response = await searchApi.search('DY');
    await attachResponse('search-response', response.body);

    expect(response.status, 'GET /search should return 200').toBe(200);
    expect(Array.isArray(response.body), 'Search result should be an array').toBe(true);
    expect(response.body.length, 'Partial ticker search should return at least one result').toBeGreaterThan(0);

    // All results should contain the query string in ticker or name
    const relevant = response.body.filter(
      (i) => i.ticker.toUpperCase().includes('DY') || i.name.toUpperCase().includes('DY')
    );
    expect(
      relevant.length,
      'All search results should be relevant to the query'
    ).toBe(response.body.length);

    test.info().annotations.push({ type: 'resultCount', description: String(response.body.length) });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────────

  test('Search with no match returns empty list @p3', async ({ searchApi }) => {
    await allure.story('No match — empty result');
    test.info().annotations.push(
      { type: 'technique', description: 'EP — query that matches nothing' },
      { type: 'query', description: 'ZZZZZZZ (non-existent)' },
    );

    const response = await searchApi.search('ZZZZZZZ');
    await attachResponse('search-response', response.body);

    expect(response.status, 'GET /search with no match should return 200').toBe(200);
    expect(Array.isArray(response.body), 'No-match result should be an empty array').toBe(true);
    expect(response.body, 'No-match search should return empty list').toHaveLength(0);
  });

  // ─── Schema ───────────────────────────────────────────────────────────────────

  test('Search results match instruments schema @p3', async ({ searchApi }) => {
    await allure.story('Search result schema');
    test.info().annotations.push(
      { type: 'schema', description: 'schemas/instruments.schema.json (per item)' },
      { type: 'technique', description: 'Contract testing — AJV schema validation on search results' },
    );

    const response = await searchApi.search('DYCA');
    await attachResponse('search-response', response.body);

    expect(response.status, 'GET /search should return 200').toBe(200);
    expect(response.body.length, 'Search must return results to validate schema').toBeGreaterThan(0);

    // Search results must follow the same shape as GET /instruments items.
    // The instruments schema defines an array — validate the search result array directly.
    assertMatchesSchema(instrumentsSchema, response.body, 'GET /search body');
  });
});
