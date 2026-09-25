'use strict';

const { get } = require('./api-client');

/**
 * GET /search?query=<query>
 * Returns instruments matching the query (ticker substring, case-insensitive).
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} query
 * @returns {Promise<{ status: number, body: Array }>}
 */
async function searchInstruments(request, query) {
  return get(request, `/search?query=${encodeURIComponent(query)}`);
}

module.exports = { searchInstruments };
