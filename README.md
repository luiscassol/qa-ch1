# Cocos QA Challenge — Suite de Tests de API

Suite de automatización de API para el [Cocos QA Challenge](https://github.com/cocoscap/app-qa).

## Estrategia QA

Enfoque API-first: todos los riesgos críticos (settlement de órdenes, suficiencia de fondos y acciones, reservas, consistencia del portfolio) están en la API. La lógica ejecutada del lado del cliente ya tiene cobertura con tests unitarios en el repositorio de la app.

La decisión de priorizar la automatización de API sobre la UI mobile está justificada en [`docs/architecture.md`](docs/architecture.md).

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
```

## Estructura del proyecto

```
api/          Clientes de API por dominio (instruments, orders, portfolio, search, reset)
assertions/   Aserciones de dominio (order, portfolio, error)
factories/    Factory de payloads de órdenes con valores válidos por defecto
fixtures/     Fixture de Playwright que inyecta todos los clientes en los tests
tests/        Specs organizados por dominio
utils/        Oracle de cálculos, helpers de montos, utilidad de polling
docs/         Test plan, arquitectura, contrato de API, findings, trazabilidad
postman/      Colección de Postman para exploración manual y reproducción de findings
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

## Aislamiento

Cada corrida usa `CANDIDATE_ID` para aislar el estado. Los tests que mutan estado
llaman a `POST /reset` en `beforeEach`. La ejecución secuencial (`workers: 1`) garantiza
que no haya interferencia entre tests.

En CI se usa `CANDIDATE_ID` con sufijo único por ejecución.

## Findings

Los defectos conocidos y observaciones están documentados en [`docs/findings.md`](docs/findings.md).
