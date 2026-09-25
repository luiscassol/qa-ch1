'use strict';

/**
 * Bounded polling utility for LIMIT order lifecycle tests.
 *
 * LIMIT order resolution is nondeterministic and lazy (triggered by reads).
 * The team confirmed there is no maximum resolution time.
 *
 * Strategy (status-consistent oracle):
 *   1. Read orders twice in quick succession.
 *   2. If the target order has the same status in both reads, the state is stable.
 *   3. Validate the business invariant for that state.
 *
 * This avoids arbitrary sleeps and remains deterministic regardless of whether
 * the order resolves quickly or stays PENDING.
 */

const DEFAULT_POLL_TIMEOUT_MS = 15_000;
const DEFAULT_POLL_INTERVAL_MS = 1_500;

/**
 * Reads the order list twice and returns the target order if its status
 * is stable (same in both reads). Returns null if not stable within timeout.
 *
 * @param {Function} getOrdersFn - Async function returning { body: Array }
 * @param {number|string} orderId - The order ID to watch.
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.intervalMs]
 * @returns {Promise<object|null>} The stable order object, or null if timed out.
 */
async function waitForStableOrderStatus(getOrdersFn, orderId, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const first = await getOrdersFn();
    const orderA = first.body.find((o) => String(o.id) === String(orderId));

    if (!orderA) return null;

    const second = await getOrdersFn();
    const orderB = second.body.find((o) => String(o.id) === String(orderId));

    if (!orderB) return null;

    if (orderA.status === orderB.status) {
      return orderA;
    }

    await sleep(intervalMs);
  }

  return null;
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { waitForStableOrderStatus };
