'use strict';

const { get } = require('./api-client');

/**
 * GET /instruments
 * Returns the full instrument catalog.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @returns {Promise<{ status: number, body: Array }>}
 */
async function getInstruments(request) {
  return get(request, '/instruments');
}

module.exports = { getInstruments };
