# Architecture

Playwright Test, JavaScript CommonJS, API-only en el default (`npm test`).

```
tests/  →  fixtures (clientes)  →  api/*  →  HTTP
              ↓
        assertions/ + utils/calculations.js (oracle)
```

- **Clients** (`api/`): un módulo por recurso. Equivalente a page objects para API.
- **Factory:** payloads con defaults; el spec solo overridea lo del escenario.
- **Oracle:** valor esperado independiente de la respuesta bajo prueba. `utils/calculations.js` copia las fórmulas de `portfolioMath.ts` **sin importar** el repo de la app.
- **LIMIT:** dos lecturas de `/orders`; si el status coincide, se valida esa invariante (no `sleep`).
- **HTTP:** negocio 200\|201; **201** solo en contract (F-07).
- **Aislamiento (esta dummy):** `workers: 1` + `POST /reset` en `beforeEach`. En CI, `CANDIDATE_ID=ci-<run_id>` (o el input del dispatch). `/reset` es parte del producto (el botón Reiniciar de la app lo llama); la suite lo usa y lo testea.
- **Aislamiento si no existiera `/reset`:** cada test (o cada job) nace un `X-Candidate-Id` nuevo — cuenta virgen a 1.000.000 — y se aserta por **delta** (cash/holdings después vs antes), nunca contra el millón absoluto. El botón Reiniciar de la UI seguiría siendo el único reset, y se probaría aparte (Maestro / UI-M). Acá no reescribimos 75 tests a deltas: el endpoint existe y conviene ejercitarlo.
- **UI:** YAML en `maestro/`. No entra a `npm test` ni al job de PR más que como repo.
