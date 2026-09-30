# Plan de pruebas

Qué se cubrió, qué no, y por qué. El criterio está acá. Los casos ejecutables de API son los `test()` (Allure). Los de UI manual: [`manual-cases.md`](manual-cases.md). El **resultado** de las corridas (API por tier y UI Android/`off`) está en [`test-results.md`](test-results.md). Los defectos: [`findings.md`](findings.md).

## Resumen

La app es un cliente de trading (Expo) contra una API dummy multi-tenant. El challenge pide evaluar calidad y automatizar: plan, suite, hallazgos, README. No pide features nuevas.

**Decisión.** El dinero (cash, holdings, reservas, settlement) se prueba en la **API**. La UI se usa para lo que la API no ve (pantalla y ARS→acciones). No hay granja de devices.

Se priorizó profundidad en la capa API (75 tests) por sobre amplitud en UI: ahí está el riesgo de negocio (integridad de cash, holdings y resolución de órdenes). En este challenge, la exploración de la app mostró que las reglas de dinero las manda al API; en el cliente quedan sobre todo la conversión monto→cantidad y que el tap deje la orden en pantalla. Para eso Maestro (opt-in). No se montó infraestructura E2E pesada para revalidar en el emulador lo que ya cubre Playwright (BVA, oversell, oracle de LIMIT). El resto de pantallas se cubrió a mano. En un producto con regresión mobile grande, Appium sería la herramienta.

El recorte de smokes, locators y exploración: [`ui-assessment.md`](ui-assessment.md). Cómo está armada la suite: [`architecture.md`](architecture.md).

| | |
|--|--|
| Suite API | **75** tests Playwright (`npm test` y GitHub Actions; catálogo API-01…75) |
| UI | 3 smokes Maestro + 20 manuales. Test cases: [`manual-cases.md`](manual-cases.md). Resultado: [`test-results.md`](test-results.md#ui) |
| Defectos | F-01–F-10 (API) + F-11–F-20 (app; F-20 también spec API) en [`findings.md`](findings.md) |
| Tiers | `off` … `hard` — misma suite; matriz en [`test-results.md`](test-results.md) |

- **Dónde está el peso.** Si una MARKET liquida mal o una LIMIT reserva mal, el usuario pierde dinero. Eso se prueba en Playwright (P0). Search, catálogo y smokes de UI no mueven esa plata; van más abajo a propósito.
- **Por qué no hay una suite grande de UI.** Mercados, portafolio, historial y reset no se ignoran: van por API o por los tres smokes / manual. Lo que no se hace es un E2E por cada cruce del **formulario de orden** (lado × tipo × pesos/acciones): repetiría las reglas de la API. Los smokes tocan esos controles y lo que la API no recibe (ARS→qty). LIMIT PENDING no se espera en pantalla: no hay SLA y el oracle ya está en la API.
- **Por qué un rojo en `off` no se esconde.** `off` es el modo para escribir aserciones, no un sello de “cero defectos”. El equipo lo confirmó. Si el camino base está mal, el test falla y el caso va a findings.

## Objetivo

Reducir el riesgo financiero antes que cualquier otra cosa. Dejar una suite repetible (reset, un worker, tenant; LIMIT sin `sleep`). Que cada decisión de alcance se pueda seguir: riesgo → tipo de escenario → spec → hallazgo.

## Alcance

- API: instruments, search, portfolio, orders, reset.
- Oracle de métricas de portfolio sobre inputs de API (`quantity`, `last_price`, `avg_cost_price`).
- Tres smokes Maestro (opt-in).
- Exploratorio de UI (manual) y Postman para repro.

## Fuera de alcance

| Queda afuera | Por qué |
|--------------|---------|
| Granja de devices / Appium | Tres smokes alcanzan el binding y el `floor` ARS. Appium sería para una regresión mobile grande. |
| Performance y security en profundidad | Sin requisitos de carga; no hay login, solo `X-Candidate-Id`. No es un pentest. |
| Promedio ponderado de `avg_cost` | En `off` el fill es a `last_price` estático: no hay dos precios distintos. |
| Tests que exijan `CANCELLED` | No está en la consigna ni en el Zod del cliente. |
| Combinaciones del **formulario de orden** (lado × tipo × pesos/acciones) | Un E2E por cada cruce de ese form repetiría side/type/qty que ya cubre la API. Mercados, search, portafolio, historial y reset se cubren por API o por los smokes / manual. |

## Riesgo

Qué pierde el usuario si falla, y dónde se cubre. Un escenario puede tocar más de una fila.

| | Qué puede fallar | Qué pierde el usuario | Dónde |
|--|------------------|----------------------|--------|
| R1 | MARKET liquida mal (precio, cash, qty) | Compra o vende mal | `tests/p0/market-orders.spec.js` |
| R2 | LIMIT: reserva o liberación incorrecta | Gasta dos veces o cash bloqueado | `tests/p0/limit-orders.spec.js` |
| R3 | Payload inválido aceptado | Orden sucia en el motor | `tests/p1/order-validation.spec.js` |
| R4 | Portafolio no cuadra con las órdenes | Opera sobre números falsos | `tests/p0/portfolio-consistency.spec.js` |
| R5 | El tap no deja la orden en pantalla, o ARS→qty mal | Ve otra cantidad o cree que no operó | `maestro/` |
| R6 | Reset o tenant mezclado | Estado de otra corrida | `tests/p1/isolation.spec.js`, smoke |
| R7 | Catálogo o search mienten | Elige mal el instrumento | `tests/p2/catalog.spec.js`, `tests/p3/search.spec.js` |

**Profundidad:** P0 = R1, R2, R4 (plata). P1 = contrato, validación, aislamiento. P2/P3 = catálogo y search. Los **tiers** (`off`…`hard`) no son prioridad: son el modo de bugs de la API. El mismo P0 se corre en los cuatro.

## Escenarios

Inventario de **tipos** de prueba que salieron de usar la API y la app: qué se le ocurre a alguien que operó el producto, no un código por fila.

Cada viñeta es una clase (p. ej. “MARKET BUY liquida cash”). Los casos concretos son los `test()` de Playwright y los YAML de Maestro; Allure los muestra passed/failed. El índice spec → regla está en [`traceability.md`](traceability.md).

**API — plata**

- MARKET BUY/SELL a `last_price`; cash y holdings.
- BVA de cash (qty máxima / una de más) y oversell / SELL sin tenencia.
- LIMIT al crear: `PENDING`. Después: invariante del estado estable (reserva / fill / reject).
- Reserva PENDING bloquea un MARKET posterior.
- Reset: estado inicial y vuelta atrás tras trades.
- Inputs de métricas para el cálculo del cliente; varios BUY seguidos.
- LIMIT con `price` no positivo: no debe inflar cash.

**API — contrato e input**

- EP/BVA: `quantity`, `side`, `type`, `instrument_id`, LIMIT sin precio / precio inválido.
- Schema y status (201 estricto solo en contract; portfolio **con** holding).
- Reset idempotente; historial vacío.

**API — catálogo, search, smoke**

- Ambiente usable (catálogo, portfolio inicial, órdenes vacías).
- Catálogo: DYCA, precios, ticker/name, up+down+flat = tamaño.
- Search: exacto, case, parcial, sin match.

**UI**

- ARS → qty (`Math.floor`; la API no recibe pesos).
- *Enviar orden* → visible en Portafolio y Órdenes.
- Reiniciar desde la app → efectivo inicial.
- Manual: test cases UI-M-01…20 en [`manual-cases.md`](manual-cases.md). Resultado de esa corrida: [`test-results.md`](test-results.md#ui). Índice: [`catalog.md`](catalog.md). Defectos de app: [F-11…F-20](findings.md).

**Producto (exploratorio)**

Operar es desde **Mercados** (Portafolio no abre el ticket). Tras enviar: *Enviar otra orden* limpia el form de ese instrumento; no reenvía sola. Mercados y Órdenes sin filtros. Hallazgos de app: [F-11…F-20](findings.md) (F-20: LIMIT SELL rechazada come acciones).

## Estrategia

- **P0–P3** = riesgo del test. **Tiers** = bugs inyectados. No son lo mismo.
- **API (Playwright)** = ¿se cumple la regla? Cash, holdings, status, reservas. `npm test` y CI son solo esto.
- **Oracle** = el valor esperado se calcula **fuera** de la respuesta bajo prueba (no se relee el mismo body y se da por bueno). Fórmulas en `utils/calculations.js`; en LIMIT, invariante del status estable.
- **UI (Maestro)** = ¿el tap deja la orden en Portafolio y Órdenes? ¿Cuántas acciones arma el cliente con pesos? Tres smokes; no re-ejecutan BVA/LIMIT.
- `off` es el modo para **escribir** aserciones. El equipo aclaró que no implica “sin bugs”: los fallos de baseline van a findings. El job de Actions usa el exit de Playwright (puede quedar rojo).

## Tipos de prueba

Smoke, functional, negative, contract/schema, state transition, exploratory (UI manual + Postman).

## Técnicas

La **prioridad** dice *cuánto* profundizar. La **técnica** dice *cómo* se arma el caso. No es “P0 = BVA siempre”: un P0 MARKET es happy path + BVA de cash; un P1 de `quantity` es EP/BVA; LIMIT usa oracle por estado.

Cada spec anota `technique` y `businessRule` (Allure).

| Técnica | Para qué (acá) | Dónde |
|---------|----------------|--------|
| EP | Una clase de input, un representante | `order-validation.spec.js` |
| BVA | El bug suele estar en el borde | Cash/shares en P0; `price ≤ 0` |
| Happy path | El flujo core, sin error | MARKET BUY/SELL; reset inicial |
| State transition | Depende del estado anterior | Reset; reserva + segunda orden |
| Status-consistent oracle | LIMIT sin SLA: dos lecturas, invariante del status estable | `limit-orders.spec.js` |
| Error guessing | Caso que EP/BVA no sugiere | `null`, SELL sin holdings, precio no positivo |
| Contract / schema | Forma y 201, no el monto | `contract.spec.js` (201 solo acá; holdings con posición) |

EP y BVA suelen ir juntos: EP elige la clase, BVA el valor en el borde.

## ISO/IEC 25010

Norma de **calidad del producto de software**: parte la calidad en características (functional suitability, reliability, performance efficiency, security, usability, compatibility, maintainability, portability).

No hay un informe aparte ni un score por eje. Se usa el vocabulario de la norma para decir **qué características se evaluaron en este challenge y cuáles no** (sin requisitos, no se “miden”).

- **Functional suitability** — ¿el producto hace lo de la consigna? Órdenes MARKET/LIMIT, cash, holdings, mensajes de negocio. Es el grueso de Playwright.
- **Reliability** — ¿el comportamiento se puede repetir y el estado restaurar? Reset, `workers: 1`, tenant, oracle de LIMIT cuando no hay SLA.
- **Usability** — no hay heurística formal ni suite de UX. Revisión exploratoria en emulador; defectos de app en F-11…F-20. Filtros ausentes y *Enviar otra orden* quedan como observación (no F-xx).
- **No evaluado (sin requisitos ni mediciones):** performance (tiempo/carga), security en profundidad (hay headers de tenant/tier; no es pentest), compatibility / maintainability / portability como puntajes.

## Datos y aislamiento

- Precios vivos de `/instruments`. Payloads: factory + JSON de inválidos.
- `POST /reset` en `beforeEach`. `workers: 1`. Un `CANDIDATE_ID` por corrida.

## Entorno

`.env` local (`API_BASE_URL`, `CANDIDATE_ID`, `BUGS_TIER`). En GitHub Actions, las mismas vars en el job.

## Entrada / salida

Qué tiene que ser verdad **antes de ejecutar** y para dar el testing **por cerrado**. Cómo correr está en el README.

- **Entrada:** API dummy alcanzable, tenant y tier configurados, smoke de salud en verde. Si el smoke falla, el ambiente no está listo.
- **Salida:** P0 ejercitado; defectos con repro en `findings.md`; evidencia por tier en `test-results.md`. Fallos de baseline en `off` no impiden la salida si están documentados.

## Dónde está cada entregable

| La consigna pide | Acá |
|------------------|-----|
| Plan | Este archivo |
| Catálogo (caso → riesgo → prioridad) | [`catalog.md`](catalog.md) |
| Suite + cómo correrla | `tests/`, README, `npm test` / Actions |
| Hallazgos | [`findings.md`](findings.md) |
| README (ejecución y decisiones) | [`README.md`](../README.md) |
| Contrato (opcional) | [`api-contract.md`](api-contract.md), Postman = repro |
| UI | [`manual-cases.md`](manual-cases.md), [`ui-assessment.md`](ui-assessment.md), `maestro/` |

Corrida de ahora: Allure / HTML local, o artifact de Actions. Matriz histórica por tier: [`test-results.md`](test-results.md).

## Límites

Restricciones que no se arreglan con más tests.

- **LIMIT sin SLA.** Fill o reject no determinístico, sin tiempo máximo. El oracle valida el estado que quedó.
- **Ganancia/retorno en `off` tras un MARKET.** El cliente calcula; costo = `last_price` → gain y return = 0. Un MARKET no prueba PnL ≠ 0.
- **Maestro.** Opt-in, no CI. Locators frágiles (LogBox, sheet, tabs). Un rojo de UI no es un rojo de la API.
- **Red caída.** En este emulador no se pudo activar modo avión; no hay caso de *Network Error*.

## Supuestos

- Tiers acumulativos (observado, no escrito en la consigna).
- Precios del catálogo estables entre lecturas de un mismo test.
- Un `CANDIDATE_ID` + reset + `workers: 1` alcanza. Dos corridas a la vez con el mismo tenant se pisan.

## Catálogo de casos

Tabla caso → riesgo (R1–R7) → prioridad (P0–P3 / smoke / UI): [`catalog.md`](catalog.md). Allure sigue agrupando por P0–P3; los specs no se renombran.
