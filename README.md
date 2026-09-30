# Cocos QA Challenge — Suite de Tests de API

Suite de automatización de API para el [Cocos QA Challenge](https://github.com/cocoscap/app-qa).

## Qué incluye

El **plan** (qué y por qué) no es el **caso** (cómo replicarlo) ni el **resultado** (qué pasó en una corrida).

| | Qué es | Dónde |
|--|--------|--------|
| Plan | Alcance, riesgo, por qué API vs UI | [`docs/test-plan.md`](docs/test-plan.md) |
| Casos API | Los 75 `test()` | `tests/` · índice [`docs/catalog.md`](docs/catalog.md) |
| Casos UI | 20 scripts (precondición / pasos / esperado) | [`docs/manual-cases.md`](docs/manual-cases.md) |
| Resultado API | `off` **69/6** de 75; misma suite en easy/medium/hard | [`docs/test-results.md`](docs/test-results.md) |
| Resultado UI | Maestro 3/3; UI-M **10/10** (Android, `off`) | [`docs/test-results.md`](docs/test-results.md#ui) |
| Defectos | F-01–F-10 (API) + F-11–F-20 (app; F-20 también API) | [`docs/findings.md`](docs/findings.md) |
| Decisión UI | Por qué Maestro, qué es un E2E, notas | [`docs/ui-assessment.md`](docs/ui-assessment.md) |

Suite de entrega: **75** Playwright (`npm test` y GitHub Actions). Maestro: **3** smokes, opt-in, no CI.

El dinero (cash, reservas, settlement) se prueba en la API. La UI cubre lo que la API no ve (orden en pantalla, ARS→acciones).

## Estrategia QA

API-first: settlement, suficiencia, reservas y portfolio viven en Playwright. La lógica del cliente ya tiene unitarios en el repo de la app. Decisión API vs UI: [`docs/ui-assessment.md`](docs/ui-assessment.md), [`docs/architecture.md`](docs/architecture.md). Trazabilidad: [`docs/traceability.md`](docs/traceability.md).

## Cómo leer el entregable

1. **Correr** — local: [Instalación](#instalación) y [Ejecución](#ejecución) (`npm run test:smoke`, después `npm test`). Sin instalar: [GitHub Actions](#github-actions) → *API tests* → *Run workflow*.
2. **Resultado de esta corrida** — HTML: `npm run test:report`. Allure: `npm run test:allure` / `test:allure:open`. En Actions, el Summary del run tiene el link de Allure (GitHub Pages); el artifact `playwright-report` queda de backup.
3. **Resultado documentado** — matriz API por tier y UI Android/`off`: [`docs/test-results.md`](docs/test-results.md).
4. **Plan** — Resumen, Riesgo y Escenarios: [`docs/test-plan.md`](docs/test-plan.md).
5. **Casos** — índice [`docs/catalog.md`](docs/catalog.md). API = el `test()`. UI manual = [`docs/manual-cases.md`](docs/manual-cases.md) (no es el resultado).
6. **Hallazgos** — repro, esperado vs actual, severidad: [`docs/findings.md`](docs/findings.md).
7. **Decisión UI** — qué se automatiza y qué no: [`docs/ui-assessment.md`](docs/ui-assessment.md).
8. **BR → spec** — [`docs/traceability.md`](docs/traceability.md). Contrato: [`docs/api-contract.md`](docs/api-contract.md).

Postman es repro a mano, no la suite. Tenant, aislamiento y CI: más abajo.

## Requisitos

- Node.js >= 18
- npm >= 8

## Instalación

```sh
git clone https://github.com/luiscassol/qa-ch1.git
cd qa-ch1
npm install
npx playwright install chromium
```

## Configuración

Copiá el archivo de ejemplo y completá tus valores:

```sh
cp .env.example .env
```

| Variable        | Requerida | Descripción                                                                        |
|----------------|-----------|------------------------------------------------------------------------------------|
| `API_BASE_URL` | Sí        | URL base de la API.                                                               |
| `CANDIDATE_ID` | Sí        | String único que aísla tu estado en la API multi-tenant.                          |
| `BUGS_TIER`    | No        | `off` \| `easy` \| `medium` \| `hard`. Por defecto `off`.                        |

## Ejecución

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

# Allure: generar HTML estático en allure-report/ (después de npm test)
npm run test:allure
npm run test:allure:open
# o servir sin dejar la carpeta: npm run test:allure:serve

# UI (opt-in: emulador Android + app Cocos + Maestro CLI)
npm run test:ui
```

## Estructura del proyecto

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

## Bug tiers

La API soporta defectos intencionales vía `X-Enable-Bugs`:

| Tier     | Resultado esperado                                                        |
|----------|---------------------------------------------------------------------------|
| `off`    | Suite pasa (excepto defectos del baseline documentados)                  |
| `easy`   | Fallas adicionales — check de acciones insuficientes                    |
| `medium` | Fallas adicionales — cantidad fraccional aceptada, status code incorrecto |
| `hard`   | Fallas adicionales — precio de ejecución incorrecto, MARKET como PENDING |

Ver [`docs/findings.md`](docs/findings.md) para el reporte completo de defectos.

## Postman

Exploración y repro manual (no reemplaza Playwright):

1. Importar [`postman/cocos-api.postman_collection.json`](postman/cocos-api.postman_collection.json)
2. Importar [`postman/cocos-api.postman_environment.json`](postman/cocos-api.postman_environment.json) y completar `candidateId`
3. Contrato conocido vs inferido: [`docs/api-contract.md`](docs/api-contract.md)

## UI

**Maestro** (3 smokes, opt-in). `npm test` no abre el emulador.

1. App [cocoscap/app-qa](https://github.com/cocoscap/app-qa) corriendo en Android (`com.cocos.trading`).
2. Instalar [Maestro](https://maestro.mobile.dev).
3. `npm run test:ui`

**Manual.** Scripts: [`docs/manual-cases.md`](docs/manual-cases.md). Resultado de esa corrida: [`docs/test-results.md`](docs/test-results.md#ui). Por qué no hay más E2E: [`docs/ui-assessment.md`](docs/ui-assessment.md).

Detalle Maestro: [`maestro/README.md`](maestro/README.md).

## Aislamiento

Cada corrida usa `CANDIDATE_ID` para aislar el estado. Los tests que mutan estado
llaman a `POST /reset` en `beforeEach`. La ejecución secuencial (`workers: 1`) garantiza
que no haya interferencia entre tests.

En CI se usa `CANDIDATE_ID=ci-<run_id>` (no es tu `.env`).

## GitHub Actions

Workflow **API tests**: `npm ci` + Playwright de API (sin Maestro). No es check *required*: un job rojo no bloquea el merge. El job usa el exit de Playwright (rojo si hay tests fallidos).

**PR / push:** se dispara solo. Tenant `ci-<run_id>`: no comparte estado con tu `CANDIDATE_ID` local.

**A mano (sin instalar nada local):** Actions → *API tests* → *Run workflow*:

1. `candidate_id` — string distinto al de tu `.env` (si la suite o la app están corriendo, no reutilizar el mismo tenant).
2. `bugs_tier` — `off` \| `easy` \| `medium` \| `hard`.

Mismas variables que `.env` (`CANDIDATE_ID`, `BUGS_TIER`, `API_BASE_URL`).

**Allure (link, no zip):** cada corrida genera el HTML y lo publica en la branch `gh-pages`. En el Summary del run: sección **Allure report** con el URL (`https://luiscassol.github.io/qa-ch1/`). Cada corrida pisa el reporte anterior. El artifact `playwright-report` sigue ahí por si querés el HTML de Playwright.

Una vez (después de la primera corrida que cree `gh-pages`): **Settings → Pages → Deploy from a branch → `gh-pages` / (root)**. Sin eso el URL 404.

## Decisiones

- El mapa de la API salió del cliente de la app y de la dummy viva. El challenge no publica un spec de la API. [`docs/api-contract.md`](docs/api-contract.md) marca qué es consigna/equipo y qué se vio en una corrida.
- Cada test hace `POST /reset`. Un worker. Un `CANDIDATE_ID` por corrida. Si el entorno no tuviera `/reset`: tenant virgen por test y aserciones por delta ([`docs/architecture.md`](docs/architecture.md)).
- LIMIT: se valida el estado que quedó (no un fill a N segundos). Portfolio: el esperado se calcula en `utils/calculations.js`, no se copia del JSON de la API.
- **P0–P3** dice qué tan crítico es el escenario (P0 = cash y órdenes; P3 = search). **`BUGS_TIER`** (`off` … `hard`) es un flag de la API que inyecta más defectos. El mismo test P0 se corre en los cuatro modos. `off` es el modo para escribir aserciones, no “cero fallos”: si algo está mal en el camino base, la suite queda roja y el caso va a [`docs/findings.md`](docs/findings.md).
- Cada test de API anota qué regla cubre (`businessRule`) y con qué técnica. Allure y [`docs/traceability.md`](docs/traceability.md) son el índice. No hay TMS (p. ej. TestRail): el caso de API es el `test()`; el de UI manual es [`docs/manual-cases.md`](docs/manual-cases.md). El veredicto de una corrida no vive en el script: está en [`docs/test-results.md`](docs/test-results.md).
- La app se cubre con **tres** smokes Maestro (orden en pantalla, ARS→acciones, reset) más los 20 UI-M. Maestro: `npm run test:ui` si hay emulador; no va en `npm test` ni en GitHub Actions. El dinero y las reglas siguen en Playwright.

## Findings

Los defectos conocidos y observaciones están documentados en [`docs/findings.md`](docs/findings.md).
