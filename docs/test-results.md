# Resultados de tests — matriz multi-tier

**Suite:** matriz histórica de **70** tests · suite actual **75** (`npm test`) · 1 worker · API: `https://dummy-api-topaz.vercel.app`  
**Candidate:** el `CANDIDATE_ID` de esa corrida (no reutilizar el tenant de Playwright y el emulador a la vez)  
**Header:** `X-Enable-Bugs: <tier>` — controla el nivel de inyección de bugs  
**Framework:** Playwright Test (CommonJS) + Allure reporter

Los **títulos de tests** se dejan en inglés: son el texto del reporter `list` de Playwright. Campos, status HTTP y comandos también quedan como en la API / la corrida.

---

## 1. Resumen ejecutivo

| Tier | X-Enable-Bugs | Passed | Failed | Fallos nuevos vs el tier anterior | Pass rate |
|------|---------------|--------|--------|-----------------------------------|-----------|
| off  | `off`         | 64     | 6      | — (baseline)                      | 91.4%     |
| easy | `easy`        | 57     | 13     | +7                                | 81.4%     |
| medium | `medium`    | 47     | 23     | +10                               | 67.1%     |
| hard | `hard`        | 44     | 26     | +3                                | 62.9%     |

> **Nota:** la corrida `off` se capturó en una sesión anterior; no quedó el output crudo.
> `easy`, `medium` y `hard` están en `docs/tier-results/`.

Esta matriz es de una corrida de **70 tests**. Hoy `npm test` son **75** (incluye `API-75` / F-20). Los IDs F-01…F-10 no cambian.

---

## 2. Bugs detectados por tier

Cada ID aparece primero en el tier que lo expone.  
`✗` = el bug está presente (el test falla). `✓` = el comportamiento es el esperado.

| Bug ID | Descripción | off | easy | medium | hard | Severity |
|--------|-------------|-----|------|--------|------|----------|
| F-01 | Orden LIMIT con `price ≤ 0` o `price = null` aceptada (BUY y SELL) | ✗ | ✗ | ✗ | ✗ | Critical |
| F-02 | `side` en minúsculas (p. ej. `"buy"`) normalizado y aceptado | ✗ | ✗ | ✗ | ✗ | Critical |
| F-03 | `type` en minúsculas (p. ej. `"market"`) normalizado y aceptado | ✗ | ✗ | ✗ | ✗ | Critical |
| F-04 | SELL aceptado sin holdings (MARKET y LIMIT) | ✓ | ✗ | ✗ | ✗ | Critical |
| F-05 | `MIRG` (id=5) tiene `last_price = 0` en el catálogo | ✓ | ✗ | ✗ | ✗ | Normal |
| F-06 | `GET /search` pasa a ser case-sensitive — ticker en minúsculas → lista vacía | ✓ | ✗ | ✗ | ✗ | Normal |
| F-07 | `POST /orders` devuelve HTTP 200 en lugar de 201 al crear la orden | ✓ | ✓ | ✗ | ✗ | Critical |
| F-08 | `quantity` decimal (p. ej. `1.5`) aceptada — se trunca a `1` y queda FILLED | ✓ | ✓ | ✗ | ✗ | Normal |
| F-09 | El holding no trae `avg_cost_price` — regresión de schema | ✓ | ✓ | ✓ | ✗ | Critical |
| F-10 | MARKET se ejecuta a un precio ≠ `last_price` — el cash se debita a otro precio | ✓ | ✓ | ✓ | ✗ | Blocker |

---

## 3. Tests que fallan por tier

Títulos = nombre del test en Playwright.

### 3.1 Tier: off (baseline, `X-Enable-Bugs: off`)

**Resultado: 64 passed / 6 failed**

| # | Test | File | Bug |
|---|------|------|-----|
| 1 | F-01: LIMIT BUY with price=0 should be rejected but is accepted | p0/portfolio-consistency | F-01 |
| 2 | rejects order: LIMIT BUY with price = 0 | p1/order-validation | F-01 |
| 3 | rejects order: LIMIT BUY with price = -1 | p1/order-validation | F-01 |
| 4 | rejects order: LIMIT BUY with price = null | p1/order-validation | F-01 |
| 5 | rejects order: side is lowercase (case-sensitive check) | p1/order-validation | F-02 |
| 6 | rejects order: type is lowercase (case-sensitive check) | p1/order-validation | F-03 |

### 3.2 Tier: easy (`X-Enable-Bugs: easy`)

**Resultado: 57 passed / 13 failed** (+7 vs off)

| # | Test | File | Bug |
|---|------|------|-----|
| 1–6 | (los 6 de off) | — | F-01, F-02, F-03 |
| 7 | LIMIT SELL is rejected with no holdings | p0/limit-orders | F-04 |
| 8 | MARKET SELL with no holdings is rejected | p0/market-orders | F-04 |
| 9 | MARKET SELL more shares than owned is rejected (BVA: oversell) | p0/market-orders | F-04 |
| 10 | rejects order: LIMIT SELL with price = 0 | p1/order-validation | F-01 |
| 11 | rejects order: LIMIT SELL with price = -1 | p1/order-validation | F-01 |
| 12 | All instruments have a positive last_price | p2/catalog | F-05 |
| 13 | Search is case-insensitive — lowercase ticker returns same result | p3/search | F-06 |

### 3.3 Tier: medium (`X-Enable-Bugs: medium`)

**Resultado: 47 passed / 23 failed** (+10 vs easy)

Los 13 de easy, más:

| # | Test | File | Bug / causa |
|---|------|------|-------------|
| 14 | LIMIT BUY immediate response is PENDING (BR-ORD-006) | p0/limit-orders | F-07 |
| 15 | LIMIT SELL creates PENDING order and satisfies its invariant | p0/limit-orders | F-07 |
| 16 | LIMIT BUY reaches a consistent state and satisfies its invariant | p0/limit-orders | F-07 |
| 17 | MARKET BUY fills at last_price and debits cash | p0/market-orders | F-07 |
| 18 | MARKET SELL fills at last_price and credits cash | p0/market-orders | F-07 |
| 19 | MARKET BUY at maximum affordable quantity (BVA: upper boundary) | p0/market-orders | F-07 |
| 20 | POST /orders (MARKET BUY) returns 201 and matches order schema | p1/contract | F-07 |
| 21 | POST /orders (LIMIT BUY) returns 201 and matches order schema | p1/contract | F-07 |
| 22 | POST /reset after trades restores portfolio to initial state | p1/isolation | F-07 (cascada) |
| 23 | rejects order: quantity is a float | p1/order-validation | F-08 |

### 3.4 Tier: hard (`X-Enable-Bugs: hard`)

**Resultado: 44 passed / 26 failed** (+3 vs medium)

Los 23 de medium, más:

| # | Test | File | Bug / causa |
|---|------|------|-------------|
| 24 | Reset restores initial state after trades | p0/portfolio-consistency | F-10 (BUY rechazado en silencio, cash = 1M) |
| 25 | Portfolio holding contains correct inputs for client-side metric calculation | p0/portfolio-consistency | F-09 (`avg_cost_price` undefined) |
| 26 | Portfolio cash decreases correctly after multiple sequential BUY orders | p0/portfolio-consistency | F-10 (ejecutado a precio ≠ `last_price`) |

---

## 4. Distribución de fallos por área de riesgo

Este eje es **P0/P1/…** (prioridad del test). Las columnas son el **tier** (inyección). No son lo mismo: un P0 puede estar verde en `off` y rojo en `easy`.

| Área de riesgo | off | easy | medium | hard |
|----------------|-----|------|--------|------|
| P0 — LIMIT lifecycle | 0 | 1 | 4 | 4 |
| P0 — MARKET settlement | 0 | 2 | 3 | 3 |
| P0 — Portfolio consistency | 1 | 1 | 1 | 4 |
| P1 — Input validation | 5 | 7 | 8 | 8 |
| P1 — API contract | 0 | 0 | 2 | 2 |
| P1 — State isolation | 0 | 0 | 1 | 1 |
| P2 — Catalog | 0 | 1 | 1 | 1 |
| P3 — Search | 0 | 1 | 1 | 1 |
| Smoke | 0 | 0 | 0 | 0 |

Los **smoke tests** pasan en todos los tiers — el criterio de entrada se cumple.

---

## 5. Análisis de bugs

### F-01 — LIMIT acepta `price ≤ 0` (todos los tiers)
- **Esperado:** `400 Bad Request` si `price = 0`, `price < 0` o `price = null`
- **Actual:** `200`/`201`, orden creada con `status: PENDING`
- En easy+: también afecta SELL (no solo BUY)
- **Tests afectados:** 6 (5 de validación + 1 sentinel P0)

### F-02 — `side` en minúsculas normalizado (todos los tiers)
- **Esperado:** `400 Bad Request` para `"buy"` o `"sell"`
- **Actual:** orden aceptada; la API persiste `"BUY"` / `"SELL"`

### F-03 — `type` en minúsculas normalizado (todos los tiers)
- **Esperado:** `400 Bad Request` para `"market"` o `"limit"`
- **Actual:** orden aceptada; la API persiste `"MARKET"` / `"LIMIT"`

### F-04 — SELL sin holdings aceptado (easy+)
- **Esperado:** `400 Bad Request`
- **Actual:** orden creada / FILLED sin tenencia

### F-05 — MIRG con `last_price = 0` (easy+)
- **Esperado:** todos los instrumentos con `last_price > 0`
- **Actual:** `MIRG` (id=5) devuelve `last_price: 0`

### F-06 — Search case-sensitive (easy+)
- **Esperado:** `GET /search?query=dyca` devuelve DYCA
- **Actual:** array vacío — exige match en mayúsculas

### F-07 — `POST /orders` devuelve 200 en lugar de 201 (medium+)
- **Esperado:** HTTP `201 Created` al crear la orden
- **Actual:** HTTP `200 OK`
- **Cascada (en esta corrida de 70 tests):** 9 tests fallaron porque el setup exigía `201`

### F-08 — `quantity` decimal truncada en silencio (medium+)
- **Esperado:** `400 Bad Request` para `quantity: 1.5`
- **Actual:** aceptada, `quantity` queda en `1`, orden FILLED
- **Riesgo:** el cliente pide 1.5 y se confirma 1

### F-09 — falta `avg_cost_price` en el holding (hard+)
- **Esperado:** `holding.avg_cost_price` es un number positivo
- **Actual:** `undefined`
- **Riesgo:** el cliente que calcula market value / gain con ese campo falla

### F-10 — MARKET a un precio ≠ `last_price` (hard+)
- **Esperado:** MARKET ejecuta a `last_price`
- **Actual:** ejecución a un precio mayor (en la práctica, `close_price`)
- **Síntomas:**
  - BVA upper-boundary BUY rechazado con `{"error":"Insufficient cash"}` aunque `floor(cash / last_price)` debería entrar
  - Multi-BUY: esperado `999862.84`, recibido `999849.79` (debitó de más)
  - BUY qty=5 rechazado en silencio → cash sigue en 1.000.000

---

## 6. Cómo reproducir

```bash
# Baseline (sin inyección)
BUGS_TIER=off npx playwright test --reporter=list

BUGS_TIER=easy   npx playwright test --reporter=list
BUGS_TIER=medium npx playwright test --reporter=list
BUGS_TIER=hard   npx playwright test --reporter=list
```

`BUGS_TIER` pisa el valor del `.env` en esa corrida.  
Dentro del mismo tier el resultado es determinístico (`workers=1`, sequential).

---

## 7. Trazabilidad

`Technique` = cómo se diseñó el caso (EP, BVA, oracle, schema). No es la prioridad (P0) ni el tier.

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
