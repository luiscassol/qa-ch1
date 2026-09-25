'use strict';

/**
 * Low-level API client wrapper around Playwright's APIRequestContext.
 *
 * All domain clients (orders, portfolio, etc.) use this module so that
 * shared concerns — base URL, headers, error handling — live in one place.
 *
 * Note: headers (X-Enable-Bugs, X-Candidate-Id, Content-Type) are set globally
 * in playwright.config.js via `use.extraHTTPHeaders`. This client does not
 * duplicate them.
 */

/**
 * @param {import('@playwright/test').APIResponse} response
 * @param {string} context - Short description of the call for error messages.
 * @returns {Promise<any>} Parsed JSON body.
 */
async function parseJson(response, context) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`[${context}] Response is not valid JSON (status ${response.status()}): ${text.slice(0, 200)}`);
  }
}

/**
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} path
 * @returns {Promise<{ status: number, body: any }>}
 */
async function get(request, path) {
  const response = await request.get(path);
  const body = await parseJson(response, `GET ${path}`);
  return { status: response.status(), body };
}

/**
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} path
 * @param {object} [data]
 * @returns {Promise<{ status: number, body: any }>}
 */
async function post(request, path, data) {
  const response = await request.post(path, {
    data,
  });
  const body = await parseJson(response, `POST ${path}`);
  return { status: response.status(), body };
}

module.exports = { get, post };
