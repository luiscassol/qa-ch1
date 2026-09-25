'use strict';

const { test } = require('@playwright/test');

/**
 * Shared report utilities.
 *
 * Centralises response attachment so all spec files use the same format.
 */

/**
 * Attaches a JSON API response to the Playwright/Allure report.
 *
 * @param {string} label - Attachment name shown in the report.
 * @param {object} body  - The response body to attach (will be JSON-stringified).
 */
async function attachResponse(label, body) {
  await test.info().attach(label, {
    body: JSON.stringify(body, null, 2),
    contentType: 'application/json',
  });
}

module.exports = { attachResponse };
