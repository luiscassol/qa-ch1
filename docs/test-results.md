# Resultados de tests — matriz multi-tier

**Suite:** **75** tests (`npm test`) · 1 worker · API: `https://dummy-api-topaz.vercel.app`  
**Candidate:** `ch1-matrix75-<tier>` (no reutilizar el tenant de Playwright y el emulador a la vez)  
**Header:** `X-Enable-Bugs: <tier>`  
**Framework:** Playwright Test (CommonJS) + Allure reporter  
**Output crudo:** `docs/tier-results/results-{off,easy,medium,hard}.txt`

Los **títulos de tests** se dejan en inglés: son el texto del reporter `list` de Playwright.

---

## 1. Resumen ejecutivo

| Tier | X-Enable-Bugs | Passed | Failed | Fallos nuevos vs el tier anterior | Pass rate |
|------|---------------|--------|--------|-----------------------------------|-----------|
| off  | `off`         | 69     | 6      | — (baseline)                      | 92.0%     |
| easy | `easy`        | 61     | 14     | +8                                | 81.3%     |
| medium | `medium`    | 58     | 17     | +3                                | 77.3%     |
| hard | `hard`        | 52     | 23     | +6                                | 69.3%     |

Una matriz anterior de **70** tests quedó reemplazada por esta corrida de 75. Las assertions de negocio aceptan `200|201`; el `201` estricto queda en contract, así que F-07 ya no cascada sobre P0.

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

F-11…F-20 son de **app / UI** (F-20 también tiene spec API). No entran en esta tabla de tiers de API.

---

## 3. Tests que fallan por tier

Títulos = nombre del test en Playwright.

### 3.1 Tier: off (baseline, `X-Enable-Bugs: off`)

**Resultado: 69 passed / 6 failed**

| # | Test | File | Bug |
|---|------|------|-----|
| 1 | F-01: LIMIT BUY with price<=0 should be rejected and must not inflate cash | p0/portfolio-consistency | F-01 |
| 2 | rejects order: side is lowercase (case-sensitive check) | p1/order-validation | F-02 |
| 3 | rejects order: type is lowercase (case-sensitive check) | p1/order-validation | F-03 |
| 4 | rejects order: LIMIT BUY with price = 0 | p1/order-validation | F-01 |
| 5 | rejects order: LIMIT BUY with price = -1 | p1/order-validation | F-01 |
| 6 | rejects order: LIMIT BUY with price = null | p1/order-validation | F-01 |

### 3.2 Tier: easy (`X-Enable-Bugs: easy`)

**Resultado: 61 passed / 14 failed** (+8 vs off)

| # | Test | File | Bug |
|---|------|------|-----|
| 1–6 | (los 6 de off) | — | F-01, F-02, F-03 |
| 7 | LIMIT SELL is rejected with no holdings | p0/limit-orders | F-04 |
| 8 | PENDING LIMIT SELL reservation blocks a subsequent MARKET SELL of the same shares | p0/limit-orders | F-04 |
| 9 | MARKET SELL with no holdings is rejected | p0/market-orders | F-04 |
| 10 | MARKET SELL more shares than owned is rejected (BVA: oversell) | p0/market-orders | F-04 |
| 11 | rejects order: LIMIT SELL with price = 0 | p1/order-validation | F-01 |
| 12 | rejects order: LIMIT SELL with price = -1 | p1/order-validation | F-01 |
| 13 | All instruments have a positive last_price | p2/catalog | F-05 |
| 14 | Search is case-insensitive — lowercase ticker returns same result | p3/search | F-06 |

### 3.3 Tier: medium (`X-Enable-Bugs: medium`)

**Resultado: 58 passed / 17 failed** (+3 vs easy)

Los 14 de easy, más:

| # | Test | File | Bug / causa |
|---|------|------|-------------|
| 15 | POST /orders (MARKET BUY) returns 201 and matches order schema | p1/contract | F-07 |
| 16 | POST /orders (LIMIT BUY) returns 201 and matches order schema | p1/contract | F-07 |
| 17 | rejects order: quantity is a float | p1/order-validation | F-08 |

### 3.4 Tier: hard (`X-Enable-Bugs: hard`)

**Resultado: 52 passed / 23 failed** (+6 vs medium)

Los 17 de medium, más:

| # | Test | File | Bug / causa |
|---|------|------|-------------|
| 18 | F-20: REJECTED LIMIT SELL must not reduce holdings | p0/limit-orders | F-20 (API) / F-10 |
| 19 | MARKET BUY fills at last_price and debits cash | p0/market-orders | F-10 |
| 20 | MARKET SELL fills at last_price and credits cash | p0/market-orders | F-10 |
| 21 | MARKET BUY at maximum affordable quantity succeeds (BVA: upper boundary) | p0/market-orders | F-10 |
| 22 | Portfolio holding contains correct inputs for client-side metric calculation | p0/portfolio-consistency | F-09 |
| 23 | Portfolio cash decreases correctly after multiple sequential BUY orders | p0/portfolio-consistency | F-10 |

---

## 4. Distribución de fallos por área de riesgo

Este eje es **P0/P1/…** (prioridad del test). Las columnas son el **tier** (inyección).

| Área de riesgo | off | easy | medium | hard |
|----------------|-----|------|--------|------|
| P0 — LIMIT lifecycle | 0 | 2 | 2 | 3 |
| P0 — MARKET settlement | 0 | 2 | 2 | 5 |
| P0 — Portfolio consistency | 1 | 1 | 1 | 3 |
| P1 — Input validation | 5 | 7 | 8 | 8 |
| P1 — API contract | 0 | 0 | 2 | 2 |
| P1 — State isolation | 0 | 0 | 0 | 0 |
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
- **Tests afectados en off:** 4 (3 de validación BUY + 1 sentinel P0). En easy+: +2 SELL `price` inválido

### F-02 — `side` en minúsculas normalizado (todos los tiers)
- **Esperado:** `400 Bad Request` para `"buy"` o `"sell"`
- **Actual:** orden aceptada; la API persiste `"BUY"` / `"SELL"`

### F-03 — `type` en minúsculas normalizado (todos los tiers)
- **Esperado:** `400 Bad Request` para `"market"` o `"limit"`
- **Actual:** orden aceptada; la API persiste `"MARKET"` / `"LIMIT"`

### F-04 — SELL sin holdings aceptado (easy+)
- **Esperado:** `400 Bad Request`
- **Actual:** orden creada / FILLED sin tenencia
- También tumba la reserva LIMIT SELL → MARKET SELL (API-16): el segundo SELL entra

### F-05 — MIRG con `last_price = 0` (easy+)
- **Esperado:** todos los instrumentos con `last_price > 0`
- **Actual:** `MIRG` (id=5) devuelve `last_price: 0`

### F-06 — Search case-sensitive (easy+)
- **Esperado:** `GET /search?query=dyca` devuelve DYCA
- **Actual:** array vacío — exige match en mayúsculas

### F-07 — `POST /orders` devuelve 200 en lugar de 201 (medium+)
- **Esperado:** HTTP `201 Created` al crear la orden
- **Actual:** HTTP `200 OK`
- **Esta corrida:** solo fallan los dos contract que exigen `201`

### F-08 — `quantity` decimal truncada en silencio (medium+)
- **Esperado:** `400 Bad Request` para `quantity: 1.5`
- **Actual:** aceptada, `quantity` queda en `1`, orden FILLED

### F-09 — falta `avg_cost_price` en el holding (hard+)
- **Esperado:** `holding.avg_cost_price` es un number positivo
- **Actual:** `undefined`
- En esta corrida falló el P0 de holding; el contract de holdings con posición no está en la lista de failed

### F-10 — MARKET a un precio ≠ `last_price` (hard+)
- **Esperado:** MARKET ejecuta a `last_price`
- **Actual:** ejecución a un precio mayor (en la práctica, `close_price`)
- MARKET BUY/SELL, BVA de cash máximo y multi-BUY no cierran el oracle. F-20 puede fallar en `hard` si el setup MARKET ya liquidó mal

---

## 6. Cómo reproducir

```bash
# Un tier (el del challenge: tu CANDIDATE_ID en .env)
BUGS_TIER=off npx playwright test --reporter=list

BUGS_TIER=easy   npx playwright test --reporter=list
BUGS_TIER=medium npx playwright test --reporter=list
BUGS_TIER=hard   npx playwright test --reporter=list
```

`BUGS_TIER` pisa el valor del `.env` en esa corrida.  
`workers=1`, sequential. Esta matriz usó tenants `ch1-matrix75-<tier>` para no pisar el `.env` ni el emulador.

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
