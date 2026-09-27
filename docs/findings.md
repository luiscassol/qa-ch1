# Findings — Cocos QA Challenge

**API:** `https://dummy-api-topaz.vercel.app`  
**Candidate:** `lc-qa-1`  
**Evidencia de ejecución:** [`docs/test-results.md`](test-results.md) y [`docs/tier-results/`](tier-results/)  
**Cómo ver este documento:** en GitHub (`docs/findings.md`) o preview Markdown del editor.

Este archivo es el **reporte de defectos**. No se regenera al correr la suite: se edita cuando hay un hallazgo nuevo (por ejemplo, un escenario UI). La matriz por tier vive en `test-results.md`.

**Severity** = impacto técnico o de negocio. **Priority** no la asignamos: la decide el equipo. Acá solo se justifica el impacto.

**Nota de alcance de la matriz:** los conteos de `test-results.md` corresponden a la suite de **70 tests** (antes de los gaps de `feat/suite-gaps`). Los IDs F-01…F-10 no cambian.

---

## Índice

| ID | Título | Tiers | Severity |
|----|--------|-------|----------|
| [F-01](#f-01--limit-acepta-price--0-o-null) | LIMIT acepta `price ≤ 0` o `null` (puede inflar cash) | todos | Critical |
| [F-02](#f-02--side-en-minúsculas-aceptado) | `side` en minúsculas aceptado | todos | Critical |
| [F-03](#f-03--type-en-minúsculas-aceptado) | `type` en minúsculas aceptado | todos | Critical |
| [F-04](#f-04--sell-sin-tenencia-aceptado) | SELL sin tenencia aceptado | easy+ | Critical |
| [F-05](#f-05--mirg-con-last_price--0) | MIRG con `last_price = 0` | easy+ | Normal |
| [F-06](#f-06--search-case-sensitive) | Search case-sensitive | easy+ | Normal |
| [F-07](#f-07--post-orders-devuelve-200-en-lugar-de-201) | `POST /orders` devuelve 200 en lugar de 201 | medium+ | Critical |
| [F-08](#f-08--quantity-decimal-aceptada-y-truncada) | `quantity` decimal aceptada y truncada | medium+ | Normal |
| [F-09](#f-09--avg_cost_price-ausente-en-el-holding) | `avg_cost_price` ausente en el holding | hard | Critical |
| [F-10](#f-10--market-se-ejecuta-a-un-precio--last_price) | MARKET se ejecuta a un precio ≠ `last_price` | hard | Blocker |
| [Observaciones](#observaciones) | Coerción, HTML en error, headers, LIMIT, cliente | — | — |

---

## F-01 — LIMIT acepta `price ≤ 0` o `null`

**Tiers:** off, easy, medium, hard (baseline; el equipo confirmó que `off` puede tener bugs).  
**Severity:** Critical — reserva o liquidación a precio no positivo corrompe cash.  
**Priority:** a definir por el equipo.  
**Confirmado:** el precio LIMIT debe ser `> 0` (respuesta del equipo + validación del form: *“un precio límite mayor a cero”*).

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `400` y body `{ "error": "…" }`. Cash no supera 1.000.000. |
| **Actual** | `201` (o `200` en medium+), `status: PENDING`, orden creada. `price: null` se persiste como `0`. En easy+ también afecta LIMIT SELL. Un `price` negativo puede **aumentar** el cash disponible (reserva negativa). |

### Reproducción

```http
POST /orders
X-Enable-Bugs: off
X-Candidate-Id: <candidate>
Content-Type: application/json

{ "instrument_id": 1, "side": "BUY", "type": "LIMIT", "quantity": 1, "price": -1 }
```

Luego `GET /portfolio`. En `off` la orden se acepta. El impacto de cash se ve con más claridad en easy/medium cuando la orden queda PENDING.

### Tests

- `tests/p0/portfolio-consistency.spec.js` — sentinel: status `400` y `cash ≤ 1_000_000`
- `tests/p1/order-validation.spec.js` — BUY `0` / `-1` / `null`; SELL `0` / `-1` (easy+)

No se usa `test.fail()`: el fallo es el defecto.

---

## F-02 — `side` en minúsculas aceptado

**Tiers:** todos.  
**Severity:** Critical — el contrato declara `BUY` \| `SELL`; normalizar en silencio admite clientes rotos.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `400` para `"buy"` / `"sell"`. |
| **Actual** | Orden aceptada; la API persiste `"BUY"` / `"SELL"`. |

### Reproducción

```json
{ "instrument_id": 1, "side": "buy", "type": "MARKET", "quantity": 1 }
```

### Tests

- `tests/p1/order-validation.spec.js` — *side is lowercase*

---

## F-03 — `type` en minúsculas aceptado

**Tiers:** todos.  
**Severity:** Critical — mismo criterio que F-02 (`MARKET` \| `LIMIT`).  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `400` para `"market"` / `"limit"`. |
| **Actual** | Orden aceptada; la API persiste el enum en mayúsculas. |

### Tests

- `tests/p1/order-validation.spec.js` — *type is lowercase*

---

## F-04 — SELL sin tenencia aceptado

**Tiers:** easy, medium, hard.  
**Severity:** Critical — venta sin inventario (short implícito).  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `400` + `Insufficient shares` (MARKET y LIMIT). Oversell (`owned + 1`) también `400`. |
| **Actual** | MARKET SELL sin holdings → `FILLED`. LIMIT SELL sin holdings → `PENDING`. Oversell aceptado. |

### Reproducción

Tras `POST /reset`:

```json
{ "instrument_id": 1, "side": "SELL", "type": "MARKET", "quantity": 1 }
```

Header: `X-Enable-Bugs: easy`.

### Tests

- `tests/p0/market-orders.spec.js` — SELL sin holdings; BVA oversell
- `tests/p0/limit-orders.spec.js` — LIMIT SELL sin holdings

---

## F-05 — MIRG con `last_price = 0`

**Tiers:** easy, medium, hard.  
**Severity:** Normal — dato de catálogo inválido. En el cliente, `lastPrice <= 0` hace que la conversión ARS→acciones devuelva `0` (`orderValidation.ts`).  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | Todo instrumento con `last_price > 0`. |
| **Actual** | `MIRG` (id=5): `last_price: 0`, `close_price: 37.74`. Una MARKET sobre MIRG puede operar a otro precio (observado ~40.88 en discovery). |

### Tests

- `tests/p2/catalog.spec.js` — *All instruments have a positive last_price*

---

## F-06 — Search case-sensitive

**Tiers:** easy, medium, hard.  
**Severity:** Normal — el cliente normaliza con `trim().toUpperCase()` (`searchText.ts`); si la API deja de ser case-insensitive, la UI busca `DYCA` y el usuario que tipeó `dyca` depende de esa capa.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `GET /search?query=dyca` devuelve DYCA (igual que `DYCA`). |
| **Actual** | Lista vacía. |

### Tests

- `tests/p3/search.spec.js` — *Search is case-insensitive*

---

## F-07 — `POST /orders` devuelve 200 en lugar de 201

**Tiers:** medium, hard.  
**Severity:** Critical para clientes que ramifican por status HTTP. El cliente mobile de la app **no mira** el status: parsea el body.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `201 Created` al crear la orden. |
| **Actual** | `200 OK`. Body de orden válido. |

En la matriz de 70 tests esto **cascadió**: varios P0 fallaban en el `expect(201)` y no evaluaban cash/holdings. La suite actual acepta `200|201` en assertions de negocio; el `201` estricto queda en `tests/p1/contract.spec.js`.

### Tests

- `tests/p1/contract.spec.js` — POST MARKET y POST LIMIT deben ser `201`

---

## F-08 — `quantity` decimal aceptada y truncada

**Tiers:** medium, hard.  
**Severity:** Normal — el usuario pide 1.5 y se confirma 1. El form del cliente exige entero.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `400` — `quantity must be a positive integer`. |
| **Actual** | Orden aceptada; `quantity` persistido como `1`, MARKET `FILLED`. |

### Reproducción

```json
{ "instrument_id": 1, "side": "BUY", "type": "MARKET", "quantity": 1.5 }
```

`X-Enable-Bugs: medium`.

### Tests

- `tests/p1/order-validation.spec.js` — *quantity is a float*

---

## F-09 — `avg_cost_price` ausente en el holding

**Tiers:** hard.  
**Severity:** Critical — el cliente Zod exige el campo (`portfolio.api.ts`). Si falta, la app tira `"Invalid portfolio response"` y no calcula market value / gain.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | Cada holding incluye `avg_cost_price` (number). |
| **Actual** | Campo `undefined` tras un MARKET BUY. |

Un contract sobre `holdings: []` **no detecta** esto (AJV no evalúa `items.required` en un array vacío). El test de contrato con holding cubre el hueco.

### Tests

- `tests/p0/portfolio-consistency.spec.js` — inputs para métricas client-side
- `tests/p1/contract.spec.js` — `GET /portfolio` con holdings

---

## F-10 — MARKET se ejecuta a un precio ≠ `last_price`

**Tiers:** hard.  
**Severity:** Blocker — settlement incorrecto: cash y `avg_cost` no coinciden con el precio de mercado del catálogo (en hard el fill observado es `close_price`).  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | MARKET `FILLED` a `last_price` del instrumento (BR-ORD-005). |
| **Actual** | Precio de la orden ≈ `close_price` (DYCA: last 45.72 vs close 50.07). El BVA de cantidad máxima (calculado con `last_price`) falla con `Insufficient cash`. Un BUY de setup puede no debitar. Dos BUY acumulados debitan más que `qty × last_price`. |

### Reproducción

```sh
BUGS_TIER=hard npx playwright test tests/p0/market-orders.spec.js --grep "fills at last_price"
```

Comparar `order.price` con `GET /instruments` → `last_price` y `close_price`.

### Tests

- `assertMarketOrderFilled` — `price ≈ last_price` y ≠ `close_price` cuando difieren
- `tests/p0/portfolio-consistency.spec.js` — cash acumulado; reset after trades (síntoma: cash no baja)

---

## Observaciones

No son fallos de la matriz por ID, o no tienen un test dedicado. Se reportan porque la consigna pidió observaciones sobre métricas, contrato y comportamiento no documentado.

### OBS-01 — Coerción de tipos en el payload

En discovery, `quantity: true` se tomó como `1`; se aceptaron `"10"`, `"buy"`, `instrument_id: "1"`. Contradice “positive integer” / enums. **Severity:** Low. Cubierto en parte por F-02/F-03 (strings de enum); `true` no está en la decision table.

### OBS-02 — Mensajes de error inconsistentes

La API mezcla *positive number* y *positive integer*. El cliente solo traduce un set fijo (`orderErrorMessages.ts`: `Insufficient cash`, `Insufficient shares`, etc.). Un mensaje no mapeado se muestra crudo. **Severity:** Low (UX).

### OBS-03 — JSON malformado → HTML

Body no-JSON en `POST /orders` puede devolver HTML en lugar de `{ "error": "…" }`. **Severity:** Low. El cliente espera JSON.

### OBS-04 — `GET /instruments` sin `X-Candidate-Id`

El catálogo responde sin header de candidato. La consigna pide el header en todo request; es razonable en datos de referencia. **Severity:** observación.

### OBS-05 — LIMIT FILLED pisa el precio límite

Al resolverse, `price` de la orden pasa a ser el de ejecución (`last_price`). El historial pierde el límite original. **Severity:** observación (el equipo pidió reportar dónde se calculan las métricas / el precio).

### OBS-06 — Market value, gain y return no los devuelve la API

Se calculan en el cliente (`portfolioMath.ts`) a partir de `quantity`, `last_price`, `avg_cost_price`. Cocos los consideró **dentro del alcance** de la suite: se validan los inputs + oracle local, no un campo `market_value` en el JSON. F-09/F-10 rompen lo que el usuario ve sin que el servidor calcule esas métricas.

### OBS-07 — `CANCELLED` no está en la consigna ni en el cliente

La app admite `PENDING | REJECTED | FILLED`. Nuestro schema de orden incluye `CANCELLED` porque apareció en respuestas. No hay tests que lo exijan. Si se observa, es estado no documentado.

### OBS-08 — Promedio ponderado de `avg_cost_price` no ejercitable en `off`

Precios estáticos; todo MARKET fillea al mismo `last_price`. Se valida `avg_cost ≈ precio de ejecución` (detecta F-10). Limitación, no defecto.

### OBS-09 — Resolución LIMIT sin tiempo máximo

El equipo: depende de liquidez simulada; una orden puede quedar PENDING indefinidamente. La suite usa oracle por estado estable, no un SLA de tiempo.

### OBS-10 — MARKET PENDING en hard (intermitente)

En discovery, algunas MARKET quedaron `PENDING` en hard. Los bugs intermitentes son parte del ejercicio. Si se reproduce, anotar frecuencia en una recorreida (ej. N de M requests).

### OBS-11 — `ticker` ausente en holdings (hard, discovery)

Además de F-09, en discovery faltó `ticker` en algún holding. El schema y el Zod del cliente lo exigen. El contract con holdings cubre el campo.

---

## Cómo reproducir un finding

1. `X-Enable-Bugs` = tier de la tabla (o `BUGS_TIER=<tier>` al correr Playwright).
2. `X-Candidate-Id` propio; `POST /reset` antes del escenario.
3. Payload de la sección del finding, o el test citado.
4. Evidencia de corrida: `docs/tier-results/results-<tier>.txt` y traces en fallo (`npx playwright show-trace …`).

```sh
BUGS_TIER=off    npx playwright test --reporter=list
BUGS_TIER=easy   npx playwright test --reporter=list
BUGS_TIER=medium npx playwright test --reporter=list
BUGS_TIER=hard   npx playwright test --reporter=list
```

Repro manual: el JSON de cada finding (o `curl`) alcanza. Una colección Postman irá en `postman/` cuando esté en el repo.

---

## Relación con otros reportes

| Pregunta | Dónde |
|----------|--------|
| ¿Qué tests fallaron por tier? | `docs/test-results.md` + `docs/tier-results/` |
| ¿Qué es el bug y cómo lo reproduzco? | Este archivo |
| ¿Pasó esta corrida? | Allure (`npx allure serve allure-results`) o `npm run test:report` — locales, no commiteados |
