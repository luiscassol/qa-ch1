# Catálogo de casos

Índice de los casos **automatizados** y de los **manuales de UI** ya documentados. No reemplaza Allure (passed/failed de ahora), ni [`test-results.md`](test-results.md) (matriz por tier), ni [`findings.md`](findings.md) (qué bug es).

- **Riesgo:** R1–R7 de [`test-plan.md`](test-plan.md) (qué pierde el usuario). Puede haber más de uno.
- **Prioridad:** P0–P3 de la suite API (`@p0`… / Allure). Smoke de API = criterio de entrada. UI Maestro = opt-in (no entra a `npm test`).
- **Hallazgo:** F-xx de [`findings.md`](findings.md) cuando el caso está pensado para ese defecto (vacío si no).
- Los títulos de API están en inglés: son el `test()` de Playwright. **No se renombraron** los specs.

Los IDs (`API-01`…75, `UI-M-01`…) son de este documento. **`npm test` corre 75 tests** (45 con título fijo + 30 de `tests/data/invalid-orders.json`). Si se agrega un test, se suma una fila; no se reescribe el historial de git de `tests/`. El spec nuevo usa el mismo molde que el resto (fixture, factory, `attachResponse`, `businessRule` + `technique`, oracle). El `201` estricto solo en contract. Los defectos de baseline se dejan fallar (no `test.fail()`).

---

## API (Playwright)

### Smoke — entrada

| ID | Qué verifica | Riesgo | Prioridad | Hallazgo | Dónde |
|----|----------------|--------|-----------|----------|--------|
| API-01 | GET /instruments returns the instrument catalog | R7 | Smoke |  | `tests/smoke/api-health.spec.js` |
| API-02 | GET /portfolio returns initial state for candidate | R4, R6 | Smoke |  | mismo |
| API-03 | GET /orders returns empty list after reset | R6 | Smoke |  | mismo |

### P0 — MARKET

| ID | Qué verifica | Riesgo | Prioridad | Hallazgo | Dónde |
|----|----------------|--------|-----------|----------|--------|
| API-04 | MARKET BUY fills at last_price and debits cash | R1, R4 | P0 | [F-10](findings.md) | `tests/p0/market-orders.spec.js` |
| API-05 | MARKET SELL fills at last_price and credits cash | R1, R4 | P0 |  | mismo |
| API-06 | MARKET BUY at maximum affordable quantity succeeds (BVA: upper boundary) | R1, R3 | P0 | [F-10](findings.md) | mismo |
| API-07 | MARKET BUY one share over budget is rejected (BVA: just above maximum) | R1, R3 | P0 |  | mismo |
| API-08 | MARKET SELL with no holdings is rejected | R1, R3 | P0 | [F-04](findings.md) | mismo |
| API-09 | MARKET SELL more shares than owned is rejected (BVA: oversell) | R1, R3 | P0 | [F-04](findings.md) | mismo |

### P0 — LIMIT

| ID | Qué verifica | Riesgo | Prioridad | Hallazgo | Dónde |
|----|----------------|--------|-----------|----------|--------|
| API-10 | LIMIT BUY immediate response is PENDING (BR-ORD-006) | R2 | P0 |  | `tests/p0/limit-orders.spec.js` |
| API-11 | LIMIT SELL creates PENDING order and satisfies its invariant (oracle) | R2 | P0 |  | mismo |
| API-12 | LIMIT BUY reaches a consistent state and satisfies its invariant (oracle) | R2 | P0 |  | mismo |
| API-13 | LIMIT BUY is rejected when reservation cost exceeds available cash | R2, R3 | P0 |  | mismo |
| API-14 | LIMIT SELL is rejected with no holdings | R2, R3 | P0 | [F-04](findings.md) | mismo |
| API-15 | PENDING LIMIT BUY reservation blocks a subsequent MARKET BUY that exceeds remaining cash | R2 | P0 |  | mismo |
| API-16 | PENDING LIMIT SELL reservation blocks a subsequent MARKET SELL of the same shares | R2 | P0 |  | mismo |
| API-75 | F-20: REJECTED LIMIT SELL must not reduce holdings | R2, R4 | P0 | [F-20](findings.md) | mismo |

### P0 — Portfolio

| ID | Qué verifica | Riesgo | Prioridad | Hallazgo | Dónde |
|----|----------------|--------|-----------|----------|--------|
| API-17 | Portfolio is at initial state after reset | R4, R6 | P0 |  | `tests/p0/portfolio-consistency.spec.js` |
| API-18 | Reset restores initial state after trades | R4, R6 | P0 | [F-10](findings.md) | mismo |
| API-19 | Portfolio holding contains correct inputs for client-side metric calculation | R4 | P0 | [F-09](findings.md) | mismo |
| API-20 | Portfolio cash decreases correctly after multiple sequential BUY orders | R1, R4 | P0 | [F-10](findings.md) | mismo |
| API-21 | F-01: LIMIT BUY with price<=0 should be rejected and must not inflate cash | R2, R3 | P0 | [F-01](findings.md) | mismo |

### P1 — Aislamiento

| ID | Qué verifica | Riesgo | Prioridad | Hallazgo | Dónde |
|----|----------------|--------|-----------|----------|--------|
| API-22 | POST /reset is idempotent — two consecutive resets yield the same initial state | R6 | P1 |  | `tests/p1/isolation.spec.js` |
| API-23 | POST /reset after trades restores portfolio to initial state | R4, R6 | P1 |  | mismo |
| API-24 | GET /orders returns empty list after reset | R6 | P1 |  | mismo |

### P1 — Contrato

| ID | Qué verifica | Riesgo | Prioridad | Hallazgo | Dónde |
|----|----------------|--------|-----------|----------|--------|
| API-25 | GET /instruments returns 200 and matches instruments schema | R7 | P1 |  | `tests/p1/contract.spec.js` |
| API-26 | POST /orders (MARKET BUY) returns 201 and matches order schema | R1 | P1 | [F-07](findings.md) | mismo |
| API-27 | POST /orders (LIMIT BUY) returns 201 and matches order schema | R2 | P1 | [F-07](findings.md) | mismo |
| API-28 | GET /orders returns 200 and each item matches order schema | R1, R2 | P1 |  | mismo |
| API-29 | GET /portfolio returns 200 and matches portfolio schema | R4 | P1 |  | mismo |
| API-30 | GET /portfolio with holdings matches portfolio schema including holding fields | R4 | P1 | [F-09](findings.md) | mismo |
| API-31 | POST /orders with invalid payload returns 400 and matches error schema | R3 | P1 |  | mismo |
| API-32 | POST /reset returns 200 | R6 | P1 |  | mismo |

### P1 — Validación de input

Cada fila es un escenario de `tests/data/invalid-orders.json` (`rejects order: … @p1`). Riesgo **R3**. Spec: `tests/p1/order-validation.spec.js`.

| ID | Qué verifica | Riesgo | Prioridad | Hallazgo |
|----|----------------|--------|-----------|----------|
| API-33 | quantity is zero (BVA: just below minimum) | R3 | P1 |  |
| API-34 | quantity is -1 (BVA: one below zero) | R3 | P1 |  |
| API-35 | quantity is deeply negative | R3 | P1 |  |
| API-36 | quantity is null | R3 | P1 |  |
| API-37 | quantity is a string | R3 | P1 |  |
| API-38 | quantity is a float | R3 | P1 | [F-08](findings.md) |
| API-39 | quantity field is missing | R3 | P1 |  |
| API-40 | side is an unknown string | R3 | P1 |  |
| API-41 | side is empty string | R3 | P1 |  |
| API-42 | side is null | R3 | P1 |  |
| API-43 | side is lowercase (case-sensitive check) | R3 | P1 | [F-02](findings.md) |
| API-44 | side field is missing | R3 | P1 |  |
| API-45 | type is an unknown string | R3 | P1 |  |
| API-46 | type is empty string | R3 | P1 |  |
| API-47 | type is null | R3 | P1 |  |
| API-48 | type is lowercase (case-sensitive check) | R3 | P1 | [F-03](findings.md) |
| API-49 | type field is missing | R3 | P1 |  |
| API-50 | instrument_id is zero (BVA: boundary below valid range) | R3 | P1 |  |
| API-51 | instrument_id is negative (BVA: one below zero) | R3 | P1 |  |
| API-52 | instrument_id is null | R3 | P1 |  |
| API-53 | instrument_id is a ticker string instead of integer | R3 | P1 |  |
| API-54 | instrument_id does not exist in catalog | R3 | P1 |  |
| API-55 | instrument_id field is missing | R3 | P1 |  |
| API-56 | LIMIT BUY order with price field missing | R3 | P1 |  |
| API-57 | LIMIT SELL order with price field missing | R3 | P1 |  |
| API-58 | LIMIT BUY with price = 0 | R3 | P1 | [F-01](findings.md) |
| API-59 | LIMIT BUY with price = -1 (negative price) | R3 | P1 | [F-01](findings.md) |
| API-60 | LIMIT BUY with price = null | R3 | P1 | [F-01](findings.md) |
| API-61 | LIMIT SELL with price = 0 | R3 | P1 | [F-01](findings.md) |
| API-62 | LIMIT SELL with price = -1 (negative price) | R3 | P1 | [F-01](findings.md) |

### P2 — Catálogo

| ID | Qué verifica | Riesgo | Prioridad | Hallazgo | Dónde |
|----|----------------|--------|-----------|----------|--------|
| API-63 | GET /instruments returns 200 with a non-empty list | R7 | P2 |  | `tests/p2/catalog.spec.js` |
| API-64 | Catalog matches instruments schema | R7 | P2 |  | mismo |
| API-65 | Default test instrument (id=1, DYCA) exists in catalog | R7 | P2 |  | mismo |
| API-66 | All instruments have a positive last_price | R7 | P2 | [F-05](findings.md) | mismo |
| API-67 | All instruments have a non-negative close_price | R7 | P2 |  | mismo |
| API-68 | Daily direction partitions sum to catalog size | R7 | P2 |  | mismo |
| API-69 | All instruments have a non-empty ticker and name | R7 | P2 |  | mismo |

### P3 — Search

| ID | Qué verifica | Riesgo | Prioridad | Hallazgo | Dónde |
|----|----------------|--------|-----------|----------|--------|
| API-70 | Search by exact ticker (DYCA) returns matching result | R7 | P3 |  | `tests/p3/search.spec.js` |
| API-71 | Search is case-insensitive — lowercase ticker returns same result | R7 | P3 | [F-06](findings.md) | mismo |
| API-72 | Search by partial ticker returns relevant results | R7 | P3 |  | mismo |
| API-73 | Search with no match returns empty list | R7 | P3 |  | mismo |
| API-74 | Search results match instruments schema | R7 | P3 |  | mismo |

---

## UI automatizada (Maestro, opt-in)

No forman parte de `npm test` ni de GitHub Actions. Riesgo **R5**.

| ID | Qué verifica | Riesgo | Prioridad | Hallazgo | Dónde |
|----|----------------|--------|-----------|----------|--------|
| UI-01 | ARS amount converts to share quantity (client-side floor) | R5 | UI smoke |  | `maestro/01-ars-to-qty.yaml` |
| UI-02 | MARKET buy is visible on Portfolio and Orders tabs | R5 | UI smoke |  | `maestro/02-buy-wiring.yaml` |
| UI-03 | Reset from the Orders tab restores initial cash | R5, R6 | UI smoke |  | `maestro/03-reset.yaml` |

---

## UI manual (exploratorio)

Scripts (precondición / pasos / esperado): [`manual-cases.md`](manual-cases.md). Resultado de la corrida: [`test-results.md`](test-results.md#ui). Android, `off`. **Hallazgo** solo si el caso está pensado para ese defecto.

UI-M-01…09 y UI-M-20 pasaron en esa corrida. UI-M-03 puede mostrar antes el modal de [F-18](findings.md) (contado en UI-M-17). API-75 es el mismo invariante que UI-M-19 en Playwright.

| ID | Qué verifica | Riesgo | Prioridad | Hallazgo | Dónde |
|----|----------------|--------|-----------|----------|--------|
| UI-M-01 | Preview pesos → 21 acciones (DYCA $1000); estimado coherente | R5 | Manual |  | [manual-cases](manual-cases.md#ui-m-01) |
| UI-M-02 | MARKET con saldo → orden en Órdenes; gain 0 en `off` | R5 | Manual |  | [manual-cases](manual-cases.md#ui-m-02) |
| UI-M-03 | Reiniciar → $1.000.000, 0 posiciones, valor total $0 (valor = tenencias) | R5, R6 | Manual |  | [manual-cases](manual-cases.md#ui-m-03) |
| UI-M-04 | MARKET sin saldo suficiente: aviso *No pudimos enviar la orden*; no hay orden nueva | R5 | Manual |  | [manual-cases](manual-cases.md#ui-m-04) |
| UI-M-05 | Cantidad no entera: el form no deja enviar (ni ≤0 ni coma en LIMIT precio) | R5 | Manual |  | [manual-cases](manual-cases.md#ui-m-05) |
| UI-M-06 | LIMIT BUY lejos del mercado: queda *Rechazada* en Órdenes (no PENDING) | R2, R5 | Manual |  | [manual-cases](manual-cases.md#ui-m-06) |
| UI-M-07 | Doble tap en *Enviar orden*: una sola orden | R5 | Manual |  | [manual-cases](manual-cases.md#ui-m-07) |
| UI-M-08 | Pesos ↔ Acciones a mitad de carga: no mezcla el número | R5 | Manual |  | [manual-cases](manual-cases.md#ui-m-08) |
| UI-M-09 | LIMIT sin precio / precio 0: no deja enviar | R5 | Manual |  | [manual-cases](manual-cases.md#ui-m-09) |
| UI-M-10 | Comprar ↔ Vender: persisten qty/pesos | R5 | Manual | [F-14](findings.md) | [manual-cases](manual-cases.md#ui-m-10) |
| UI-M-11 | Instrumento ARS/MONEDA: comprar (cash debitado) y vender desde Buscar | R1, R5 | Manual | [F-15](findings.md) | [manual-cases](manual-cases.md#ui-m-11) |
| UI-M-12 | Venta desde Mercados: el ticket no muestra tenencia | R5 | Manual | [F-16](findings.md) | [manual-cases](manual-cases.md#ui-m-12) |
| UI-M-13 | Search: ticker/parcial OK; nombre de empresa no (label *Ticker o empresa*) | R7 | Manual | [F-12](findings.md) | [manual-cases](manual-cases.md#ui-m-13) |
| UI-M-14 | Strip Mercados: 24 suben + 1 baja ≠ Total 26 | R7 | Manual | [F-11](findings.md) | [manual-cases](manual-cases.md#ui-m-14) |
| UI-M-15 | Última fila tapada por tabs (Portafolio y Órdenes); Buscar en horizontal | R5 | Manual | [F-13](findings.md) | [manual-cases](manual-cases.md#ui-m-15) |
| UI-M-16 | Horizontal: no se puede cargar cantidad en el ticket | R5 | Manual | [F-17](findings.md) | [manual-cases](manual-cases.md#ui-m-16) |
| UI-M-17 | Tras vender todo o Reiniciar: modal *Posición no encontrada* | R5 | Manual | [F-18](findings.md) | [manual-cases](manual-cases.md#ui-m-17) |
| UI-M-18 | LIMIT *Rechazada*: sin motivo; tap no abre ficha | R5 | Manual | [F-19](findings.md) | [manual-cases](manual-cases.md#ui-m-18) |
| UI-M-19 | LIMIT SELL *Rechazada*: qty/cash iguales que post-BUY | R2, R4 | Manual | [F-20](findings.md) | [manual-cases](manual-cases.md#ui-m-19) |
| UI-M-20 | Reiniciar → Cancelar: no resetea cash ni posiciones | R6 | Manual |  | [manual-cases](manual-cases.md#ui-m-20) |

Siguiente: qué pasó por tier (y UI Android/`off`) — [`test-results.md`](test-results.md).
