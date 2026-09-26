# Test Results — Multi-Tier Execution Matrix

**Suite:** 70 tests · 1 worker (sequential) · API: `https://dummy-api-topaz.vercel.app`  
**Candidate:** `lc-qa-1`  
**Header:** `X-Enable-Bugs: <tier>` — controls bug injection level  
**Framework:** Playwright Test (CommonJS) + Allure reporter

---

## 1. Executive Summary

| Tier | X-Enable-Bugs | Passed | Failed | New failures vs previous | Pass rate |
|------|---------------|--------|--------|--------------------------|-----------|
| off  | `off`         | 64     | 6      | — (baseline)             | 91.4%     |
| easy | `easy`        | 57     | 13     | +7                       | 81.4%     |
| medium | `medium`    | 47     | 23     | +10                      | 67.1%     |
| hard | `hard`        | 44     | 26     | +3                       | 62.9%     |

> **Note:** The `off` tier run was captured in a prior session; raw output not preserved.
> Results for `easy`, `medium`, and `hard` are saved in `docs/tier-results/`.

---

## 2. Bugs Detected per Tier

Each bug ID is first introduced by the tier that exposes it.
A `✗` means the bug is present (test fails); `✓` means the behavior is correct.

| Bug ID | Description | off | easy | medium | hard | Severity |
|--------|-------------|-----|------|--------|------|----------|
| F-01 | LIMIT order with `price ≤ 0` or `price = null` accepted (BUY and SELL) | ✗ | ✗ | ✗ | ✗ | Critical |
| F-02 | Lowercase `side` (e.g. `"buy"`) normalized and accepted — not rejected | ✗ | ✗ | ✗ | ✗ | Critical |
| F-03 | Lowercase `type` (e.g. `"market"`) normalized and accepted — not rejected | ✗ | ✗ | ✗ | ✗ | Critical |
| F-04 | SELL orders accepted without any holdings (both MARKET and LIMIT) | ✓ | ✗ | ✗ | ✗ | Critical |
| F-05 | `MIRG` (id=5) has `last_price = 0` in the catalog | ✓ | ✗ | ✗ | ✗ | Normal |
| F-06 | `GET /search` becomes case-sensitive — lowercase ticker returns empty result | ✓ | ✗ | ✗ | ✗ | Normal |
| F-07 | `POST /orders` returns HTTP 200 instead of 201 for all order creation | ✓ | ✓ | ✗ | ✗ | Blocker |
| F-08 | Float quantity (e.g. `1.5`) accepted — truncated silently to `1` and FILLED | ✓ | ✓ | ✗ | ✗ | Normal |
| F-09 | Portfolio holding missing `avg_cost_price` field — schema regression | ✓ | ✓ | ✓ | ✗ | Critical |
| F-10 | MARKET order executes at price ≠ `last_price` — cash debited at different (higher) price | ✓ | ✓ | ✓ | ✗ | Blocker |

---

## 3. Failing Tests per Tier

### 3.1 Tier: off (baseline, `X-Enable-Bugs: off`)

**Result: 64 passed / 6 failed**

| # | Test | File | Bug |
|---|------|------|-----|
| 1 | F-01: LIMIT BUY with price=0 should be rejected but is accepted | p0/portfolio-consistency | F-01 |
| 2 | rejects order: LIMIT BUY with price = 0 | p1/order-validation | F-01 |
| 3 | rejects order: LIMIT BUY with price = -1 | p1/order-validation | F-01 |
| 4 | rejects order: LIMIT BUY with price = null | p1/order-validation | F-01 |
| 5 | rejects order: side is lowercase (case-sensitive check) | p1/order-validation | F-02 |
| 6 | rejects order: type is lowercase (case-sensitive check) | p1/order-validation | F-03 |

### 3.2 Tier: easy (`X-Enable-Bugs: easy`)

**Result: 57 passed / 13 failed** (+7 vs off)

| # | Test | File | Bug |
|---|------|------|-----|
| 1–6 | (all 6 from off) | — | F-01, F-02, F-03 |
| 7 | LIMIT SELL is rejected with no holdings | p0/limit-orders | F-04 |
| 8 | MARKET SELL with no holdings is rejected | p0/market-orders | F-04 |
| 9 | MARKET SELL more shares than owned is rejected (BVA: oversell) | p0/market-orders | F-04 |
| 10 | rejects order: LIMIT SELL with price = 0 | p1/order-validation | F-01 |
| 11 | rejects order: LIMIT SELL with price = -1 | p1/order-validation | F-01 |
| 12 | All instruments have a positive last_price | p2/catalog | F-05 |
| 13 | Search is case-insensitive — lowercase ticker returns same result | p3/search | F-06 |

### 3.3 Tier: medium (`X-Enable-Bugs: medium`)

**Result: 47 passed / 23 failed** (+10 vs easy)

All 13 from easy, plus:

| # | Test | File | Bug / Root cause |
|---|------|------|-----------------|
| 14 | LIMIT BUY immediate response is PENDING (BR-ORD-006) | p0/limit-orders | F-07 |
| 15 | LIMIT SELL creates PENDING order and satisfies its invariant | p0/limit-orders | F-07 |
| 16 | LIMIT BUY reaches a consistent state and satisfies its invariant | p0/limit-orders | F-07 |
| 17 | MARKET BUY fills at last_price and debits cash | p0/market-orders | F-07 |
| 18 | MARKET SELL fills at last_price and credits cash | p0/market-orders | F-07 |
| 19 | MARKET BUY at maximum affordable quantity (BVA: upper boundary) | p0/market-orders | F-07 |
| 20 | POST /orders (MARKET BUY) returns 201 and matches order schema | p1/contract | F-07 |
| 21 | POST /orders (LIMIT BUY) returns 201 and matches order schema | p1/contract | F-07 |
| 22 | POST /reset after trades restores portfolio to initial state | p1/isolation | F-07 cascade |
| 23 | rejects order: quantity is a float | p1/order-validation | F-08 |

### 3.4 Tier: hard (`X-Enable-Bugs: hard`)

**Result: 44 passed / 26 failed** (+3 vs medium)

All 23 from medium, plus:

| # | Test | File | Bug / Root cause |
|---|------|------|-----------------|
| 24 | Reset restores initial state after trades | p0/portfolio-consistency | F-10 (BUY silently rejected, cash = 1M) |
| 25 | Portfolio holding contains correct inputs for client-side metric calculation | p0/portfolio-consistency | F-09 (`avg_cost_price` undefined) |
| 26 | Portfolio cash decreases correctly after multiple sequential BUY orders | p0/portfolio-consistency | F-10 (executed at price ≠ last_price) |

---

## 4. Failure Distribution by Risk Area

| Risk area | off | easy | medium | hard |
|-----------|-----|------|--------|------|
| P0 — LIMIT lifecycle | 0 | 1 | 4 | 4 |
| P0 — MARKET settlement | 0 | 2 | 3 | 3 |
| P0 — Portfolio consistency | 1 | 1 | 1 | 4 |
| P1 — Input validation | 5 | 7 | 8 | 8 |
| P1 — API contract | 0 | 0 | 2 | 2 |
| P1 — State isolation | 0 | 0 | 1 | 1 |
| P2 — Catalog | 0 | 1 | 1 | 1 |
| P3 — Search | 0 | 1 | 1 | 1 |
| Smoke | 0 | 0 | 0 | 0 |

**Smoke tests pass across all tiers** — entry criteria always met.

---

## 5. Bug Analysis

### F-01 — LIMIT price ≤ 0 accepted (present in ALL tiers)
- **Expected:** `400 Bad Request` when `price = 0`, `price < 0`, or `price = null`
- **Actual:** `200 OK`, order created with `status: PENDING`
- In easy+ tier: also affects SELL side (not just BUY)
- **Tests affected:** 6 (5 validation + 1 P0 sentinel)

### F-02 — Lowercase `side` normalized (present in ALL tiers)
- **Expected:** `400 Bad Request` for `"buy"` or `"sell"`
- **Actual:** `200 OK`, API normalizes to `"BUY"`/`"SELL"` internally

### F-03 — Lowercase `type` normalized (present in ALL tiers)
- **Expected:** `400 Bad Request` for `"market"` or `"limit"`
- **Actual:** `200 OK`, API normalizes to `"MARKET"`/`"LIMIT"` internally

### F-04 — SELL without holdings accepted (easy+)
- **Expected:** `400 Bad Request`
- **Actual:** `200 OK`, order created/FILLED with no holdings — inventory goes negative implicitly

### F-05 — MIRG catalog `last_price = 0` (easy+)
- **Expected:** all instruments have `last_price > 0`
- **Actual:** `MIRG` (id=5) returns `last_price: 0`

### F-06 — Search becomes case-sensitive (easy+)
- **Expected:** `GET /search?q=dyca` returns DYCA
- **Actual:** empty array — search requires exact uppercase match

### F-07 — `POST /orders` returns 200 instead of 201 (medium+)
- **Expected:** HTTP 201 Created on order creation (REST standard)
- **Actual:** HTTP 200 OK — breaks contract for all clients relying on status codes
- **Cascades:** 9 tests fail because setup assertions also check for 201

### F-08 — Float quantity silently truncated (medium+)
- **Expected:** `400 Bad Request` for `quantity: 1.5`
- **Actual:** `200 OK`, `quantity` stored as `1`, order FILLED
- **Risk:** client submits 1.5 shares, gets confirmation, but only 1 was traded

### F-09 — `avg_cost_price` absent from portfolio holding (hard+)
- **Expected:** `holding.avg_cost_price` is a positive number (field always present)
- **Actual:** `undefined` — field removed from response schema
- **Risk:** any client computing market value or gain using this field will crash

### F-10 — MARKET order execution price ≠ `last_price` (hard+)
- **Expected:** MARKET order executes at the current `last_price`
- **Actual:** execution occurs at a higher price (injected slippage or stale price)
- **Symptoms:**
  - BVA upper-boundary BUY rejected with `{"error":"Insufficient cash"}` even though `floor(cash / last_price)` shares should fit
  - Multi-BUY cash debit exceeds expected (`expected: 999862.84`, `received: 999849.79` — more was debited)
  - BUY qty=5 silently rejected → cash remains at 1,000,000

---

## 6. How to Reproduce

Run the suite against any tier:

```bash
# Baseline (no bug injection)
BUGS_TIER=off npx playwright test --reporter=list

# Specific tier
BUGS_TIER=easy   npx playwright test --reporter=list
BUGS_TIER=medium npx playwright test --reporter=list
BUGS_TIER=hard   npx playwright test --reporter=list
```

The `BUGS_TIER` environment variable overrides the `.env` value for that run.
Results are deterministic within the same tier (workers=1, sequential execution).

---

## 7. Traceability

| Test file | Priority | Technique | Allure severity |
|-----------|----------|-----------|-----------------|
| smoke/api-health.spec.js | P0 | — | blocker |
| p0/market-orders.spec.js | P0 | EP + BVA | blocker |
| p0/limit-orders.spec.js | P0 | EP + oracle | blocker |
| p0/portfolio-consistency.spec.js | P0 | oracle | blocker |
| p1/contract.spec.js | P1 | schema | critical |
| p1/isolation.spec.js | P1 | state | critical |
| p1/order-validation.spec.js | P1 | EP + BVA | critical |
| p2/catalog.spec.js | P2 | EP | normal |
| p3/search.spec.js | P3 | EP | minor |
