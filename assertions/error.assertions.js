'use strict';

const { expect } = require('@playwright/test');

/**
 * Assertions for API error responses.
 */

/**
 * Asserts a 400 response with a specific error message.
 *
 * @param {{ status: number, body: object }} response
 * @param {string} expectedMessage
 */
function assertBadRequest(response, expectedMessage) {
  expect(response.status, `Expected 400, got ${response.status}`).toBe(400);
  expect(response.body.error, 'Error message should match').toBe(expectedMessage);
}

/**
 * Asserts a 400 response with any error message (for cases where the exact message
 * is not the focus of the test).
 *
 * @param {{ status: number, body: object }} response
 */
function assertAnyBadRequest(response) {
  expect(response.status, `Expected 400, got ${response.status}`).toBe(400);
  expect(response.body.error, 'Response should have an error message').toBeTruthy();
}

module.exports = { assertBadRequest, assertAnyBadRequest };
