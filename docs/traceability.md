# Traceability

Mapa **regla de negocio → spec**. No es un catálogo de casos (`TC-001`) ni el listado completo de BRs: eso vive en cada test (`test.info().annotations`: `businessRule`, `technique`) y en Allure (`story`, `severity`).

Esta página es el índice por área: qué archivo abrir. La fila de Allure / el `test()` es el caso. Caso → riesgo → prioridad: [`catalog.md`](catalog.md).

| Área | Spec | BRs (muestra) |
|------|------|----------------|
| Smoke | `tests/smoke/api-health.spec.js` | BR-HDR-001, BR-RST-001 |
| MARKET | `tests/p0/market-orders.spec.js` | BR-ORD-001/002/005, BR-PRT-001 |
| LIMIT | `tests/p0/limit-orders.spec.js` | BR-ORD-003/004/006, BR-RSV-001 |
| Portfolio | `tests/p0/portfolio-consistency.spec.js` | BR-RST-001, BR-PRT-002, F-01 |
| Validación | `tests/p1/order-validation.spec.js` | BR-VAL-001…005 |
| Isolation | `tests/p1/isolation.spec.js` | BR-RST-001 |
| Contract | `tests/p1/contract.spec.js` | schemas + 201 |
| Catálogo | `tests/p2/catalog.spec.js` | BR-CAT-001…004 |
| Search | `tests/p3/search.spec.js` | búsqueda |
| UI smoke | `maestro/*.yaml` | orden visible en Portafolio/Órdenes; ARS→qty. Sin BRs de API |
| UI manual | [`manual-cases.md`](manual-cases.md) | UI-M-01…20 (script). Resultado: [`test-results.md`](test-results.md#ui). Defectos F-11…F-20 |

Otros mapas (no son trazabilidad de BRs):

- Defecto ↔ test: [`docs/findings.md`](findings.md)
- Qué pasó por tier: [`docs/test-results.md`](test-results.md)
