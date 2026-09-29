# Cocos QA Challenge — Suite de Tests de API

Suite de automatización de API para el [Cocos QA Challenge](https://github.com/cocoscap/app-qa).

## Qué incluye

| | |
|--|--|
| Suite de entrega | **75** tests Playwright de API (`npm test` y GitHub Actions) |
| UI (Maestro) | **3** smokes, opt-in, no CI |
| UI (manual) | **20** escenarios (UI-M-01…20) — [`docs/ui-assessment.md`](docs/ui-assessment.md) |
| Defectos | **F-01–F-10** (API) + **F-11–F-20** (app; F-20 también API) — [`docs/findings.md`](docs/findings.md) |
| `off` (baseline) | **64 passed / 6 failed** en la matriz de 70 (`test-results.md`); la suite actual son 75 |
| Tiers | misma suite en `easy` / `medium` / `hard` — [`docs/test-results.md`](docs/test-results.md) |

El dinero (cash, reservas, settlement) se prueba en la API. La UI cubre lo que la API no ve (orden en pantalla, ARS→acciones). Plan: [`docs/test-plan.md`](docs/test-plan.md). Catálogo: [`docs/catalog.md`](docs/catalog.md).

## Estrategia QA

API-first: settlement, suficiencia, reservas y portfolio viven en Playwright. La lógica del cliente ya tiene unitarios en el repo de la app. Decisión API vs UI: [`docs/ui-assessment.md`](docs/ui-assessment.md), [`docs/architecture.md`](docs/architecture.md). Trazabilidad: [`docs/traceability.md`](docs/traceability.md).

## Cómo leer el entregable

Orden para recorrer el repo (correr, ver la corrida, después los docs):

1. **Correr** — local: [Instalación](#instalación) y [Ejecución](#ejecución) (`npm run test:smoke`, después `npm test`). Sin instalar: [GitHub Actions](#github-actions) → *API tests* → *Run workflow*.
2. **Esta corrida** — HTML: `npm run test:report`. Allure: `npm run test:allure` / `test:allure:open`. En Actions, el Summary del run tiene el link de Allure (GitHub Pages); el artifact `playwright-report` queda de backup.
3. **Plan** — empezar por Resumen, Riesgo y Escenarios: [`docs/test-plan.md`](docs/test-plan.md). Catálogo caso → riesgo → prioridad: [`docs/catalog.md`](docs/catalog.md).
4. **Hallazgos** — repro, esperado vs actual, severidad, evidencia: [`docs/findings.md`](docs/findings.md).
5. **Por tier** — qué falló en `off`…`hard`: [`docs/test-results.md`](docs/test-results.md).
6. **Decisión UI** — qué hay en Maestro y qué no: [`docs/ui-assessment.md`](docs/ui-assessment.md).
7. **BR → spec** — [`docs/traceability.md`](docs/traceability.md). Contrato (conocido vs inferido): [`docs/api-contract.md`](docs/api-contract.md).

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
docs/         Test plan, architecture, contrato, findings, trazabilidad, UI assessment
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

## UI (Maestro)

Opt-in. `npm test` no abre el emulador.

1. App [cocoscap/app-qa](https://github.com/cocoscap/app-qa) corriendo en Android (`com.cocos.trading`).
2. Instalar [Maestro](https://maestro.mobile.dev).
3. `npm run test:ui`

Detalle: [`maestro/README.md`](maestro/README.md) y [`docs/ui-assessment.md`](docs/ui-assessment.md).

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

**Allure (link, no zip):** cada corrida genera el HTML y lo publica en GitHub Pages. En el Summary del run: sección **Allure report** y, si Pages está activo, el environment `github-pages` con el URL (`https://luiscassol.github.io/qa-ch1/`). Cada corrida pisa el reporte anterior. El artifact `playwright-report` sigue ahí por si querés el HTML de Playwright.

Una vez: **Settings → Pages → Source: GitHub Actions**. Sin eso el job `publish-allure` falla y no hay link.

## Decisiones

- El mapa de la API salió del cliente de la app y de la dummy viva. El challenge no publica un spec de la API. [`docs/api-contract.md`](docs/api-contract.md) marca qué es consigna/equipo y qué se vio en una corrida.
- Cada test hace `POST /reset`. Un worker. Un `CANDIDATE_ID` por corrida. Si el entorno no tuviera `/reset`: tenant virgen por test y aserciones por delta ([`docs/architecture.md`](docs/architecture.md)).
- LIMIT: se valida el estado que quedó (no un fill a N segundos). Portfolio: el esperado se calcula en `utils/calculations.js`, no se copia del JSON de la API.
- **P0–P3** dice qué tan crítico es el escenario (P0 = cash y órdenes; P3 = search). **`BUGS_TIER`** (`off` … `hard`) es un flag de la API que inyecta más defectos. El mismo test P0 se corre en los cuatro modos. `off` es el modo para escribir aserciones, no “cero fallos”: si algo está mal en el camino base, la suite queda roja y el caso va a [`docs/findings.md`](docs/findings.md).
- Cada test anota qué regla cubre (`businessRule`) y con qué técnica. Allure y [`docs/traceability.md`](docs/traceability.md) son el índice. No hay TestRail/Qase: el caso es el `test()` del spec.
- La app se cubre con **tres** smokes Maestro (orden en pantalla, ARS→acciones, reset). Se corren con `npm run test:ui` si hay emulador; no van en `npm test` ni en GitHub Actions. El dinero y las reglas siguen en Playwright.

## Findings

Los defectos conocidos y observaciones están documentados en [`docs/findings.md`](docs/findings.md).
