'use strict';

require('dotenv').config();

const { defineConfig } = require('@playwright/test');

const BUGS_TIER = process.env.BUGS_TIER || 'off';
const CANDIDATE_ID = process.env.CANDIDATE_ID;

if (!CANDIDATE_ID) {
  throw new Error('CANDIDATE_ID environment variable is required. Copy .env.example to .env and set your candidate ID.');
}

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = defineConfig({
  testDir: './tests',
  // Sequential execution: the API is stateful and tests depend on /reset for isolation.
  // Parallel execution would require multiple candidate IDs and is not enabled by default.
  fullyParallel: false,
  workers: 1,
  // Fail fast is disabled so all tests run and the full picture is visible per tier.
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.API_BASE_URL || 'https://dummy-api-topaz.vercel.app',
    extraHTTPHeaders: {
      'X-Enable-Bugs': BUGS_TIER,
      'X-Candidate-Id': CANDIDATE_ID,
      'Content-Type': 'application/json',
    },
    // Retain traces on failure for debugging.
    trace: 'retain-on-failure',
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['allure-playwright', { outputFolder: 'allure-results' }],
  ],
  // Annotate every test run with the active tier and candidate for traceability.
  metadata: {
    bugsTier: BUGS_TIER,
    candidateId: CANDIDATE_ID,
  },
});
