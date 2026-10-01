# Plan de pruebas

Qué se cubrió, qué no, y por qué. El criterio está acá. Los casos ejecutables de API son los `test()` (Allure). Los de UI manual: [`manual-cases.md`](manual-cases.md). El **resultado** de las corridas (API por tier y UI Android/`off`) está en [`test-results.md`](test-results.md). Los defectos: [`findings.md`](findings.md).

## Resumen

La app es un cliente de trading (Expo) contra una API dummy multi-tenant. El challenge pide evaluar calidad y automatizar: plan, suite, hallazgos, README. No pide features nuevas.

**Decisión.** El dinero (cash, holdings, reservas, settlement) se prueba en la **API**. La UI se usa para lo que la API no ve (pantalla y ARS→acciones). No hay granja de devices.

Se priorizó profundidad en la capa API (75 tests) por sobre amplitud en UI: ahí está el riesgo de negocio (integridad de cash, holdings y resolución de órdenes). En este challenge, la exploración de la app mostró que las reglas de dinero las manda al API; en el cliente quedan sobre todo la conversión monto→cantidad y que el tap deje la orden en pantalla. Para eso Maestro (opt-in). No se montó infraestructura E2E pesada para revalidar en el emulador lo que ya cubre Playwright (BVA, oversell, oracle de LIMIT). El resto de pantallas se cubrió a mano. En un producto con regresión mobile grande, Appium sería la herramienta.

El recorte de smokes, locators y exploración: [`ui-assessment.md`](ui-assessment.md). Cómo está armada la suite: [`architecture.md`](architecture.md).

| | |
|--|--|
| Suite API | **75** tests Playwright (`npm test` y GitHub Actions; catálogo API-01…75). Resultado: [`test-results.md`](test-results.md) |
| UI | 3 smokes Maestro + 20 manuales. Test cases: [`manual-cases.md`](manual-cases.md). Resultado: [`test-results.md`](test-results.md#ui) |
| Defectos | F-01–F-10 (API) + F-11–F-20 (app; F-20 también spec API) en [`findings.md`](findings.md) |
| Tiers | `off` … `hard` — misma suite; matriz en [`test-results.md`](test-results.md) |

- **Dónde está el peso.** Si una MARKET liquida mal o una LIMIT reserva mal, el usuario pierde dinero. Eso se prueba en Playwright (P0). Search, catálogo y smokes de UI no mueven esa plata; van más abajo a propósito.
- **Por qué no hay una suite grande de UI.** Mercados, portafolio, historial y reset no se ignoran: van por API o por los smokes / manual. Lo que no se hace es un E2E por cada cruce del **formulario de orden** (lado × tipo × pesos/acciones): repetiría las reglas de la API. Los smokes tocan esos controles y lo que la API no recibe (ARS→qty). LIMIT PENDING no se espera en pantalla: no hay SLA y el oracle ya está en la API.
- **Por qué un rojo en `off` no se esconde.** `off` es el modo para escribir aserciones, no un sello de “cero defectos”. Lo consultamos y nos confirmaron que no implica “sin bugs”. Si el camino base está mal, el test falla y el caso va a findings.

## Objetivo

Reducir el riesgo financiero antes que cualquier otra cosa. También que lo que se ve en la app coincida con lo operado: una orden en Órdenes tiene que haberse enviado; un “ejecutada” tiene que haber liquidado. La plata se ataca en la API; esa coherencia de pantalla, en Maestro y en los manuales. Dejar una suite repetible (reset, un worker, tenant; LIMIT sin `sleep`). Que cada decisión de alcance se pueda seguir: riesgo → tipo de escenario → spec → hallazgo.

## Alcance

- API: instruments, search, portfolio, orders, reset.
- Oracle de métricas de portfolio sobre inputs de API (`quantity`, `last_price`, `avg_cost_price`).
- Smokes Maestro (opt-in).
- Exploratorio de UI (manual) y Postman para repro.

## Fuera de alcance

| Queda afuera | Por qué |
|--------------|---------|
| Granja de devices / Appium | Los smokes alcanzan el binding y el `floor` ARS. Appium sería para una regresión mobile grande. |
| Carga / performance | Dummy sin SLA ni requisito de RPS. No hay load test. |
| Autenticación (login, sesión, tokens) | La app no tiene login. El aislamiento es `X-Candidate-Id` (tenant), no un usuario autenticado. |
| Security en profundidad | No es un pentest. Tener tenant/tier en headers no cubre inyección, authz ni superficie de ataque. |
| Promedio ponderado de `avg_cost` | En `off` el fill es a `last_price` estático: no hay dos precios distintos. |
| Tests que exijan `CANCELLED` | No está en la consigna ni en el Zod del cliente. |
| Combinaciones del **formulario de orden** (lado × tipo × pesos/acciones) | Un E2E por cada cruce de ese form repetiría side/type/qty que ya cubre la API. Mercados, search, portafolio, historial y reset se cubren por API o por los smokes / manual. |

## Riesgo

Qué pierde el usuario si falla, y dónde se cubre. **R** no es **P**: R es el riesgo; P0–P3 es la prioridad del spec de API (`@p0`…). Un escenario puede tocar más de una fila.

| | Qué puede fallar | Qué pierde el usuario | Prioridad | Dónde |
|--|------------------|----------------------|-----------|--------|
| R1 | MARKET liquida mal (precio, cash, qty) | Compra o vende mal | P0 | `tests/p0/market-orders.spec.js` |
| R2 | LIMIT: reserva o liberación incorrecta | Gasta dos veces o cash bloqueado | P0 | `tests/p0/limit-orders.spec.js` |
| R3 | Payload inválido aceptado | Orden sucia en el motor | P1 | `tests/p1/order-validation.spec.js` |
| R4 | Portafolio no cuadra con las órdenes | Opera sobre números falsos | P0 | `tests/p0/portfolio-consistency.spec.js` |
| R5 | El tap no deja la orden en pantalla, o ARS→qty mal | Ve otra cantidad o cree que no operó | UI | `maestro/` |
| R6 | Reset o tenant mezclado | Estado de otra corrida | P1 | `tests/p1/isolation.spec.js`, smoke |
| R7 | Catálogo o search con errores | Elige mal el instrumento | P2 / P3 | `tests/p2/catalog.spec.js`, `tests/p3/search.spec.js` |

**Profundidad.** P0 = plata (R1, R2, R4). P1 = validación (R3), aislamiento (R6) y **contrato** (schema / 201; no es un R aparte). P2/P3 = R7. R5 no entra a P0–P3: es Maestro. Los **tiers** (`off`…`hard`) no son prioridad: son el modo de bugs de la API. El mismo P0 se corre en los cuatro.

## Escenarios

Inventario de **tipos** de prueba que salieron de usar la API y la app: qué se le ocurre a alguien que operó el producto, no un código por fila.

Cada viñeta es una clase (p. ej. “MARKET BUY liquida cash”). Los casos concretos son los `test()` de Playwright y los YAML de Maestro. Allure es la corrida de ahora (passed/failed). La matriz documentada de API por tier: [`test-results.md`](test-results.md). El índice spec → regla está en [`traceability.md`](traceability.md).

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

La estrategia es **dónde** se aserta cada riesgo de la tabla de arriba, no un segundo inventario de casos. Las técnicas (EP, BVA, etc.) van en la sección siguiente.

La plata (R1, R2, R4) se prueba en Playwright: cash, holdings, reservas, status de la orden. `npm test` y GitHub Actions son solo esa capa. El número esperado no se toma del mismo JSON que se está mirando: `utils/calculations.js` lo calcula aparte; en LIMIT, si el status no cambió entre dos lecturas de `/orders`, se valida lo que *ese* estado tiene que cumplir. Maestro no repite BVA ni el oracle: tres smokes para lo que la API no ve (ARS→qty y que el tap deje la orden en pantalla). El resto de la app va a mano.

**P0–P3** es cuánto pesa el spec (`@p0` en `tests/p0/`, etc.). **Tiers** (`off`…`hard`) es el modo de bugs de la dummy (`X-Enable-Bugs`). El mismo P0 se corre en los cuatro; no “sube de prioridad” porque el tier sea hard.

`off` es el modo para **escribir** las aserciones, no un certificado de cero defectos. Lo consultamos y nos confirmaron que puede haber bugs de baseline: el test falla y el caso va a findings. El job de Actions usa el exit de Playwright, así que en `off` el rojo es esperado.

## Tipos de prueba

Smoke, functional, negative, contract/schema, state transition, exploratory (UI manual + Postman).

## Técnicas

P0 o P1 es **qué tan grave es el riesgo** si el caso falla (y en qué carpeta vive el spec). La **técnica** es **cómo se eligió el dato o el aserto** de *ese* test. No van atadas: un MARKET P0 puede ser el camino feliz (comprar 1 acción) y otro P0 el borde de cash (la cantidad máxima que alcanza). Los `quantity` inválidos son P1 y se arman con particiones y bordes (EP/BVA). Las LIMIT no se “esperan 2 segundos”: se lee el status dos veces y se valida el estado que quedó.

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
- **Usability** — ¿se puede operar la app sin una fricción que impida el flujo? No hay heurística formal ni suite de UX: se miró en emulador (Maestro + casos a mano). Los defectos de pantalla están en [`findings.md`](findings.md); acá no se puntúa el eje.
- **No evaluado (sin requisitos ni mediciones):** performance (tiempo/carga), autenticación (no hay login), security en profundidad (no es pentest), compatibility / maintainability / portability como puntajes.

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
| Resultado de corrida | Allure publicado: [https://luiscassol.github.io/qa-ch1/](https://luiscassol.github.io/qa-ch1/) (cada Actions lo pisa). Local: `npm run test:allure:serve` / `npm run test:report`. Artifact de backup en el run. Matriz por tier: [`test-results.md`](test-results.md) |
| Hallazgos | [`findings.md`](findings.md) |
| README (ejecución y decisiones) | [`README.md`](../README.md) |
| Contrato (opcional) | [`api-contract.md`](api-contract.md), Postman = repro |
| UI | [`manual-cases.md`](manual-cases.md), [`ui-assessment.md`](ui-assessment.md), `maestro/` |

## Límites

Restricciones que no se arreglan con más tests.

- **LIMIT sin SLA.** Fill o reject no determinístico, sin tiempo máximo. El oracle valida el estado que quedó.
- **Ganancia y retorno después de un MARKET en `off`.** La API no manda esas métricas: las calcula la app con `quantity`, `last_price` y `avg_cost`. En `off` el fill es a `last_price`, así que costo y mercado coinciden y gain/return quedan en 0. Eso es coherente, no un bug de pantalla. Con un solo precio no se puede demostrar que el PnL “se ve mal cuando debería ser distinto de cero”; el promedio ponderado tampoco se ejercita (hace falta dos compras a precios distintos).
- **Maestro.** Opt-in, no CI. Locators frágiles (LogBox, sheet, tabs). Un rojo de UI no es un rojo de la API.
- **Red caída.** En este emulador no se pudo activar modo avión; no hay caso de *Network Error*.

## Supuestos

- Tiers acumulativos (observado, no escrito en la consigna).
- Precios del catálogo estables entre lecturas de un mismo test.
- Un `CANDIDATE_ID` + reset + `workers: 1` alcanza. Dos corridas a la vez con el mismo tenant se pisan.

## Catálogo de casos

Este archivo es el criterio (qué se cubre y por qué). El inventario caso por caso — ID, riesgo y prioridad — está en [`catalog.md`](catalog.md).

Allure agrupa por la prioridad del spec (`@p0`…), que es como se corre la suite. Los IDs `API-01`…75 y `UI-M-01`…20 viven en ese markdown, no en el título del `test()`. No se renombraron los specs para no duplicar dos taxonomías (prioridad de ejecución vs índice de entrega).

Siguiente: recorte de UI (Maestro, E2E, qué quedó a mano) — [`ui-assessment.md`](ui-assessment.md).
