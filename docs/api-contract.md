# Contrato de la API

**Base URL:** `https://dummy-api-topaz.vercel.app`  
**Cliente de referencia:** repo de la app (`cocoscap/app-qa`) — schemas Zod en `src/features/*/api/*.ts`.

Este documento **no es un OpenAPI inventado**. Separa lo **conocido** (consigna + confirmación del equipo + lo que el cliente parsea) de lo **inferido** (respuestas observadas en `off` y en los tiers).

La automatización está en Playwright (`schemas/*.json`). Postman es solo exploración y repro manual: [`postman/cocos-api.postman_collection.json`](../postman/cocos-api.postman_collection.json).

---

## Cómo importar Postman

1. Importar `postman/cocos-api.postman_collection.json`.
2. Importar `postman/cocos-api.postman_environment.json`.
3. En el environment, poner tu `candidateId` (el mismo criterio que `.env`) y el `bugsTier` de la corrida.
4. Antes de un finding que mute estado: `POST /reset`.

---

## Headers (conocido)

| Header | Obligatorio | Valores |
|--------|-------------|---------|
| `X-Candidate-Id` | Sí en endpoints con estado | String no vacío; aísla cash, holdings y órdenes |
| `X-Enable-Bugs` | Sí | `off` \| `easy` \| `medium` \| `hard` (case-insensitive en la práctica) |
| `Content-Type` | En POST con body | `application/json` |

**Inferido:** `GET /instruments` responde sin `X-Candidate-Id` (OBS-04). El catálogo es dato de referencia, no estado del candidato.

---

## Endpoints

| Método | Path | Status conocido (off) | Body |
|--------|------|------------------------|------|
| `GET` | `/instruments` | 200 | Array de instrumentos |
| `GET` | `/search?query=` | 200 | Array (mismo shape que instrumentos; puede ser `[]`) |
| `GET` | `/portfolio` | 200 | `{ cash, holdings[] }` |
| `GET` | `/orders` | 200 | Array de órdenes |
| `POST` | `/orders` | **201** al crear (contrato REST + tests de contract) | Orden o `{ error }` |
| `POST` | `/reset` | 200 | **Conocido vía cliente:** `{ ok: true }` |

**Inferido / tiers:** en medium+ `POST /orders` puede devolver **200** (F-07). En hard, holdings pueden omitir campos (F-09).

No hay OpenAPI publicado por el challenge. Los JSON Schema del repo (`schemas/`) documentan lo que la suite valida.

---

## Instrumento (conocido + observado)

Campos observados y usados por el cliente: `id`, `ticker`, `name`, `type`, `last_price`, `close_price`.

**Conocido:** `last_price` alimenta MARKET y la conversión ARS→qty en el form (`Math.floor(amount / lastPrice)`).  
**Inferido:** en easy+ `MIRG` puede traer `last_price: 0` (F-05). Search en `off` es substring de ticker, case-insensitive; en easy+ se vuelve case-sensitive (F-06). Search por nombre no está documentado; en discovery no matcheaba.

---

## Orden — request (conocido)

```json
{
  "instrument_id": 1,
  "side": "BUY",
  "type": "MARKET",
  "quantity": 1
}
```

LIMIT **conocido:** `price` obligatorio y numérico; el form y el Zod del cliente exigen `price > 0`.

| Campo | Conocido | Inferido |
|-------|----------|----------|
| `instrument_id` | Entero positivo; inexistente → 400 `Instrument not found` | — |
| `side` | `BUY` \| `SELL` | Minúsculas se aceptan y normalizan (F-02, todos los tiers) |
| `type` | `MARKET` \| `LIMIT` | Igual con minúsculas (F-03) |
| `quantity` | Entero ≥ 1 | `1.5` se trunca a `1` en medium+ (F-08); `true` se vio como `1` en discovery (OBS-01) |
| `price` | Requerido en LIMIT | `0` / `-1` / `null` aceptados en off (F-01); `null` se persiste como `0` |

---

## Orden — response (conocido vs inferido)

**Conocido (cliente Zod):** `id`, `status` ∈ `PENDING` \| `REJECTED` \| `FILLED`. Historial también: `instrument_id`, `side`, `type`, `quantity`, `price`, `created_at`.

| Tema | Conocido | Inferido |
|------|----------|----------|
| MARKET en off | `FILLED` inmediato a `last_price` | En hard el fill puede ser `close_price` (F-10); a veces MARKET queda `PENDING` (OBS-10) |
| LIMIT al crear | `PENDING` | Después: FILLED o REJECTED, no determinístico, sin SLA de tiempo (equipo) |
| Precio en LIMIT FILLED | — | El campo `price` se pisa con el de ejecución (OBS-05) |
| `CANCELLED` | No está en consigna ni en el cliente | Apareció en respuestas; el schema de la suite lo admite; no se testea como regla |
| `candidate_id` | — | La API lo devuelve; el cliente no lo usa |
| Status HTTP crear | 201 | 200 en medium+ (F-07). El cliente mobile **no** lee el status, solo el body |

Error de negocio **conocido** (mensajes que el cliente traduce): `Insufficient cash`, `Insufficient shares`, `quantity must be a positive integer`, `Instrument not found`, `LIMIT orders require a numeric price`.

---

## Portfolio (conocido)

```json
{
  "cash": 1000000,
  "holdings": [
    {
      "instrument_id": 1,
      "ticker": "DYCA",
      "quantity": 1,
      "last_price": 45.72,
      "close_price": 50.07,
      "avg_cost_price": 45.72
    }
  ]
}
```

**Conocido (equipo):** `market_value`, `gain` y `return` **no** vienen en la API. El cliente los calcula (`portfolioMath.ts`) con `quantity`, `last_price`, `avg_cost_price`.

**Conocido:** cash inicial 1.000.000; reset deja holdings y órdenes vacíos; cash disponible es neto de reservas PENDING.

**Inferido:** en hard puede faltar `avg_cost_price` (F-09) o `ticker` (OBS-11). Un schema sobre `holdings: []` no detecta eso.

---

## Reset (conocido)

`POST /reset` → `200` y `{ "ok": true }` (Zod del cliente). Restaura cash, holdings y historial de **ese** `X-Candidate-Id`.

---

## Qué no está en este contrato

- OpenAPI generado o “oficial” — no lo hay.
- Performance, auth más allá de los dos headers, paginación.
- Garantía de que LIMIT se resuelva en N segundos.

Siguiente: qué spec cubre qué regla — [`traceability.md`](traceability.md).
