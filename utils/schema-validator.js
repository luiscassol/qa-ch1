'use strict';

const Ajv = require('ajv');
const { expect } = require('@playwright/test');

const ajv = new Ajv({ allErrors: true });

/**
 * Schema validation utility.
 *
 * Thin wrapper around AJV that integrates with Playwright's expect API.
 * Used in contract tests (P1) to verify that API response shapes are stable.
 *
 * Using JSON Schema draft-07 via AJV v8 (draft-07 compatible mode).
 */

/**
 * Asserts that a value matches a JSON Schema.
 * Fails the test with a descriptive message listing all schema violations.
 *
 * @param {object} schema - JSON Schema object (draft-07).
 * @param {*} data - Value to validate (typically response.body or response.body.someField).
 * @param {string} [label] - Human-readable label shown in failure messages.
 */
function assertMatchesSchema(schema, data, label = 'response body') {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid) {
    const errors = ajv.errorsText(validate.errors, { dataVar: label });
    expect(valid, `Schema validation failed:\n${errors}`).toBe(true);
  }
}

module.exports = { assertMatchesSchema };
