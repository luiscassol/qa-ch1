'use strict';

const { post } = require('./api-client');

/**
 * POST /reset
 * Resets the candidate account to the initial state:
 * - Cash restored to 1,000,000 ARS
 * - All orders cleared
 * - All holdings cleared
 *
 * This does NOT affect other candidates (isolation by X-Candidate-Id).
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @returns {Promise<{ status: number, body: { ok: true } }>}
 */
async function resetAccount(request) {
  return post(request, '/reset');
}

module.exports = { resetAccount };
