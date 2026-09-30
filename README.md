# Cocos QA Challenge — Suite de Tests de API

Suite de automatización de API para el [Cocos QA Challenge](https://github.com/cocoscap/app-qa).

## Qué incluye

El **plan** (qué y por qué) no es el **caso** (cómo replicarlo) ni el **resultado** (qué pasó en una corrida).

| | Qué es | Dónde |
|--|--|--------|
| Plan | Alcance, riesgo, por qué API vs UI | [`docs/test-plan.md`](docs/test-plan.md) |
| Casos API | Los 75 `test()` | `tests/` · índice [`docs/catalog.md`](docs/catalog.md) |
| Casos UI | 20 scripts (precondición / pasos / esperado) | [`docs/manual-cases.md`](docs/manual-cases.md) |
| Resultado API | `off` **69/6** de 75; misma suite en easy/medium/hard | [`docs/test-results.md`](docs/test-results.md) |
| Resultado UI | Maestro 3/3; UI-M **10/10** (Android, `off`) | [`docs/test-results.md`](docs/test-results.md#ui) |
| Defectos | F-01–F-10 (API) + F-11–F-20 (app; F-20 también API) | [`docs/findings.md`](docs/findings.md) |
| Decisión UI | Por qué Maestro, qué es un E2E, notas | [`docs/ui-assessment.md`](docs/ui-assessment.md) |

Suite de entrega: **75** Playwright (`npm test` y GitHub Actions). UI: **3** smokes Maestro (opt-in, no CI) + **20** manuales ([`docs/manual-cases.md`](docs/manual-cases.md)).

## Estrategia QA

**Riesgo.** Si una MARKET liquida mal o una LIMIT reserva mal, el usuario pierde dinero (cash, holdings, resolución de órdenes). En la app también hay riesgo de cliente: cantidad mal armada desde pesos, ticket que no envía, pantallas con errores. Search y catálogo importan menos que la plata, pero se cubren.

**Estrategia.** API primero: Playwright es la suite de entrega (`npm test` y GitHub Actions). Ahí está la profundidad (settlement, suficiencia, reservas, portfolio, contrato) porque es barato de repetir y es donde vive la regla. No se duplica eso en el emulador.

Después, E2E (Maestro, opt-in): smokes por lo que la API no ve — conversión monto→cantidad y que el tap deje la orden en pantalla. No son una granja ni un segundo BVA.

También se exploró la app a mano (Android, `off`): search, mercados, ticket, reset, ARS, horizontal. Los 20 casos están en [`docs/manual-cases.md`](docs/manual-cases.md).

`off` no significa “cero defectos”: si el camino base está mal, el test falla y el hallazgo se documenta.

El argumento largo empieza en [`docs/test-plan.md`](docs/test-plan.md); cada archivo indica el siguiente.

## Cómo leer el reporte

1. **Correr** — local: [Instalación](#instalación) y [Ejecución](#ejecución) (`npm run test:smoke`, después `npm test`). Sin instalar: [GitHub Actions](#github-actions) → *API tests* → *Run workflow*.
2. **Esta corrida** — HTML: `npm run test:report`. Allure: `npm run test:allure:serve`. En Actions, el Summary del run tiene el link de Allure (GitHub Pages); el artifact `playwright-report` queda de backup.
3. **Matriz documentada** — API por tier y UI Android/`off`: [`docs/test-results.md`](docs/test-results.md). Defectos: [`docs/findings.md`](docs/findings.md).

Postman es repro a mano, no la suite. Tenant, aislamiento y CI: más abajo.

## Correr la suite

### Requisitos

- Node.js >= 18
- npm >= 8

### Instalación

```sh
git clone https://github.com/luiscassol/qa-ch1.git
cd qa-ch1
npm install
npx playwright install chromium
```

### Configuración

Copiá el archivo de ejemplo y completá tus valores:

```sh
cp .env.example .env
```

| Variable        | Requerida | Descripción                                                                        |
|----------------|-----------|------------------------------------------------------------------------------------|
| `API_BASE_URL` | Sí        | Dummy del challenge: `https://dummy-api-topaz.vercel.app` (ya viene en `.env.example`). |
| `CANDIDATE_ID` | Sí        | String único que aísla tu estado en la API multi-tenant.                          |
| `BUGS_TIER`    | No        | `off` \| `easy` \| `medium` \| `hard`. Por defecto `off`.                        |

### Ejecución

```sh
# Correr todos los tests (BUGS_TIER desde .env)
npm test

# Correr por tier
npm run test:off
npm run test:easy
npm run test:medium
npm run test:hard

# Correr por prioridad
npm run test:smoke   # Criterios de entrada — correr primero
npm run test:p0      # Reglas de negocio críticas

# Ver reporte HTML (después de cualquier corrida)
npm run test:report

# Allure (después de cualquier corrida): genera el HTML y lo abre
npm run test:allure:serve

# UI (opt-in). npm install no trae Maestro ni el emulador — requisitos: sección UI
npm run test:ui
```

Dependencias de Maestro y la app: [UI](#ui).

### GitHub Actions

Workflow **API tests**: `npm ci` + los 75 de Playwright. Sin Maestro y sin UI-M. No es check *required*: un job rojo no bloquea el merge. En `off` el rojo es esperado (F-01…F-03). El job usa el exit de Playwright.

**PR / push:** se dispara solo. Tenant `ci-<run_id>`, tier `off`. No comparte estado con tu `.env`.

**A mano (sin instalar nada local):** Actions → *API tests* → *Run workflow*. Una corrida = un tenant + **un** tier (no es la matriz de cuatro de [`docs/test-results.md`](docs/test-results.md)):

1. `candidate_id` — distinto al de tu `.env` y al del emulador si están corriendo.
2. `bugs_tier` — `off` \| `easy` \| `medium` \| `hard`.

`API_BASE_URL` no se pide: en el job ya está `https://dummy-api-topaz.vercel.app`.

**Allure (link, no zip):** cada corrida genera el HTML y lo publica en `gh-pages` (pisa el reporte anterior). En el Summary del run: **Allure report** → `https://luiscassol.github.io/qa-ch1/`. Artifacts de backup: `playwright-report` y `allure-report`.

Una vez: **Settings → Pages → Deploy from a branch → `gh-pages` / (root)**. Repo **público** (en private free, Pages no hostea). Sin eso el URL 404.

## La suite

### Estructura del proyecto

```
api/          Clientes de API por dominio (instruments, orders, portfolio, search, reset)
assertions/   Aserciones de dominio (order, portfolio, error)
factories/    Factory de payloads de órdenes con valores válidos por defecto
fixtures/     Fixture de Playwright que inyecta todos los clientes en los tests
tests/        Specs organizados por dominio
utils/        Oracle de cálculos, helpers de montos, utilidad de polling
docs/         Plan, catálogo, casos UI, resultados, findings, contrato, UI assessment
postman/      Colección de Postman para exploración manual y reproducción de findings
maestro/      Smokes de UI (opt-in; no forman parte de `npm test`)
```

### Bug tiers

La API soporta defectos intencionales vía `X-Enable-Bugs`:

| Tier     | Resultado esperado                                                        |
|----------|---------------------------------------------------------------------------|
| `off`    | Suite pasa (excepto defectos del baseline documentados)                  |
| `easy`   | Fallas adicionales — check de acciones insuficientes                    |
| `medium` | Fallas adicionales — cantidad fraccional aceptada, status code incorrecto |
| `hard`   | Fallas adicionales — precio de ejecución incorrecto, MARKET como PENDING |

Ver [`docs/findings.md`](docs/findings.md) para el reporte completo de defectos.

### Postman

Repro HTTP de findings de **API** (F-01…F-10, F-20). No reemplaza Playwright ni los 20 UI-M (esos son la app).

1. Importar [`postman/cocos-api.postman_collection.json`](postman/cocos-api.postman_collection.json).
2. Importar [`postman/cocos-api.postman_environment.json`](postman/cocos-api.postman_environment.json). `baseUrl` ya es `https://dummy-api-topaz.vercel.app`. Completar `candidateId` (no reutilizar el de Playwright si la suite está corriendo). `bugsTier`: `off` \| `easy` \| `medium` \| `hard`.
3. `POST /reset` antes de un finding que mute estado. Pasos y esperado: [`docs/findings.md`](docs/findings.md). Contrato: [`docs/api-contract.md`](docs/api-contract.md).

### UI

Smokes Maestro (opt-in). `npm test` no abre el emulador. Este repo **no** instala la app.

1. **App** — clone [cocoscap/app-qa](https://github.com/cocoscap/app-qa) y seguí **su** README (emulador Android, Metro, package `com.cocos.trading`). Acá no se duplican esos pasos.
2. **Maestro CLI** — [maestro.mobile.dev](https://maestro.mobile.dev) (`curl -Ls "https://get.maestro.mobile.dev" | bash`). No viene con `npm install` de esta suite.
3. **Correr** — app en primer plano: `npm run test:ui`

Mismo `CANDIDATE_ID` que `EXPO_PUBLIC_CANDIDATE_ID` de la app. No en paralelo con Playwright sobre ese tenant.

**Manual.** Scripts: [`docs/manual-cases.md`](docs/manual-cases.md). Resultado de esa corrida: [`docs/test-results.md`](docs/test-results.md#ui). Por qué no hay más E2E: [`docs/ui-assessment.md`](docs/ui-assessment.md).

Flujos y locators: [`maestro/README.md`](maestro/README.md).

### Aislamiento

Cada corrida usa `CANDIDATE_ID` para aislar el estado. Los tests que mutan estado
llaman a `POST /reset` en `beforeEach`. La ejecución secuencial (`workers: 1`) garantiza
que no haya interferencia entre tests.

En CI se usa `CANDIDATE_ID=ci-<run_id>` (no es tu `.env`).

### Decisiones

- **Contrato inferido.** El challenge no publica un spec. Tratar la dummy como si hubiera OpenAPI sería mentir el alcance. El mapa salió del cliente de la app y de corridas reales; [`docs/api-contract.md`](docs/api-contract.md) separa lo que el equipo/consigna fija de lo que se infirió, para no asertar un contrato que nadie firmó.

- **Oracle aparte.** Si el esperado se lee del mismo JSON que se está probando, un bug de fórmula (cash, avg_cost, market value) pasa. `utils/calculations.js` recalcula por fuera (mismas reglas que el cliente, sin importar el repo de la app). El test compara contra eso, no contra sí mismo.

- **LIMIT sin `sleep`.** La dummy no da un SLA de fill: PENDING / FILLED / REJECTED no es un reloj. Un `sleep(N)` flakea o miente. Se leen dos veces `/orders`; si el status se estabilizó, se valida la invariante de *ese* estado (reserva, fill o rechazo).

- **Aislamiento.** Esta API tiene `POST /reset` (el mismo camino que Reiniciar en la app): conviene usarlo y testearlo. Un worker y un `CANDIDATE_ID` por corrida para no pisar tenants. Si no existiera `/reset`, no se asertaría contra el millón absoluto: tenant virgen por test y deltas ([`docs/architecture.md`](docs/architecture.md)). Acá no reescribimos 75 tests a deltas porque el endpoint existe.

- **HTTP de creación ≠ aserto de dinero.** Un test de settlement pregunta si cash y holdings cerraron, no si el status es 201. El 201 es contrato: vive en `contract.spec.js`. En negocio, “orden aceptada” es 200 o 201 (la orden está creada). Así un defecto de status code no apaga la matriz de plata. Lo observado en los tiers está en [F-07](docs/findings.md#f-07).
