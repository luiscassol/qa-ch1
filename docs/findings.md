# Findings — Cocos QA Challenge

**API:** `https://dummy-api-topaz.vercel.app`  
**Candidate:** el `CANDIDATE_ID` de la corrida (`.env` local o `ci-<run_id>` en Actions)  
**Evidencia de ejecución:** [`docs/test-results.md`](test-results.md) y [`docs/tier-results/`](tier-results/)  
**Cómo ver este documento:** en GitHub (`docs/findings.md`) o preview Markdown del editor.

Este archivo es el **reporte de defectos**. No se regenera al correr la suite: se edita cuando hay un hallazgo nuevo (por ejemplo, un escenario UI). La matriz por tier vive en `test-results.md`. Los IDs **API-xx** y **UI-M-xx** son el catálogo: [`catalog.md`](catalog.md).

**Severity** = impacto técnico o de negocio. **Priority** no la asignamos: la decide el equipo. Acá solo se justifica el impacto.

**Nota de alcance de la matriz:** `npm test` hoy son **75** tests (API-01…75). Los conteos de `test-results.md` son de una corrida de **70** (histórica). Los IDs F-01…F-10 no cambian. **F-11…F-19** son de la **app**. **F-20** se vio en la app y es `API-75`.

---

## Índice

| ID | Título | Tiers | Severity |
|----|--------|-------|----------|
| [F-01](#f-01--limit-acepta-price--0-o-null) | LIMIT acepta `price ≤ 0` o `null` (puede inflar cash) | todos | Critical |
| [F-02](#f-02--side-en-minúsculas-aceptado) | `side` en minúsculas aceptado | todos | Critical |
| [F-03](#f-03--type-en-minúsculas-aceptado) | `type` en minúsculas aceptado | todos | Critical |
| [F-04](#f-04--sell-sin-tenencia-aceptado) | SELL sin tenencia aceptado | easy+ | Critical |
| [F-05](#f-05--mirg-con-last_price--0) | MIRG con `last_price = 0` | easy+ | Normal |
| [F-06](#f-06--search-case-sensitive) | Search case-sensitive | easy+ | Normal |
| [F-07](#f-07--post-orders-devuelve-200-en-lugar-de-201) | `POST /orders` devuelve 200 en lugar de 201 | medium+ | Critical |
| [F-08](#f-08--quantity-decimal-aceptada-y-truncada) | `quantity` decimal aceptada y truncada | medium+ | Normal |
| [F-09](#f-09--avg_cost_price-ausente-en-el-holding) | `avg_cost_price` ausente en el holding | hard | Critical |
| [F-10](#f-10--market-se-ejecuta-a-un-precio--last_price) | MARKET se ejecuta a un precio ≠ `last_price` | hard | Blocker |
| [F-11](#f-11--strip-de-mercados-241--26) | Strip Mercados: 24 suben + 1 baja ≠ 26 | app `off` | Normal |
| [F-12](#f-12--search-no-encuentra-por-nombre-de-empresa) | Search no encuentra por nombre de empresa | app `off` | Normal |
| [F-13](#f-13--la-barra-de-tabs-tapa-contenido) | La barra de tabs tapa la última fila / resultados | app `off` | Normal |
| [F-14](#f-14--comprar--vender-persiste-cantidad-y-pesos) | Comprar ↔ Vender persiste cantidad/pesos | app `off` | Critical |
| [F-15](#f-15--se-puede-operar-ars-como-acción) | Se puede operar ARS (MONEDA) como acción | app `off` | Critical |
| [F-16](#f-16--el-ticket-de-venta-no-muestra-la-tenencia) | Ticket de venta (desde Mercados) no muestra tenencia | app `off` | Normal |
| [F-17](#f-17--en-horizontal-no-se-puede-cargar-la-cantidad) | En horizontal no se puede cargar la cantidad | app `off` | Normal |
| [F-18](#f-18--posición-no-encontrada-tras-vender-o-reiniciar) | “Posición no encontrada” tras vender todo o reiniciar | app `off` | Normal |
| [F-19](#f-19--orden-límite-rechazada-sin-motivo-ni-detalle) | LIMIT rechazada: sin motivo; el tap no abre ficha | app `off` | Normal |
| [F-20](#f-20--limit-sell-rechazada-descuenta-acciones-sin-acreditar-cash) | LIMIT SELL rechazada descuenta acciones sin acreditar cash | app + API `off` | Critical |
| [Observaciones](#observaciones) | Coerción, HTML en error, headers, LIMIT, cliente | — | — |

---

<a id="f-01"></a>

## F-01 — LIMIT acepta `price ≤ 0` o `null`

**Tiers:** off, easy, medium, hard (baseline; el equipo confirmó que `off` puede tener bugs).  
**Severity:** Critical — reserva o liquidación a precio no positivo corrompe cash.  
**Priority:** a definir por el equipo.  
**Confirmado:** el precio LIMIT debe ser `> 0` (respuesta del equipo + validación del form: *“un precio límite mayor a cero”*).

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `400` y body `{ "error": "…" }`. Cash no supera 1.000.000. |
| **Actual** | `201` (o `200` en medium+), `status: PENDING`, orden creada. `price: null` se persiste como `0`. En easy+ también afecta LIMIT SELL. Un `price` negativo puede **aumentar** el cash disponible (reserva negativa). |

### Reproducción

```http
POST /orders
X-Enable-Bugs: off
X-Candidate-Id: <candidate>
Content-Type: application/json

{ "instrument_id": 1, "side": "BUY", "type": "LIMIT", "quantity": 1, "price": -1 }
```

Luego `GET /portfolio`. En `off` la orden se acepta. El impacto de cash se ve con más claridad en easy/medium cuando la orden queda PENDING.

### Tests

- [`API-21`](catalog.md) — sentinel P0: `400` y `cash ≤ 1_000_000`
- [`API-58`](catalog.md), [`API-59`](catalog.md), [`API-60`](catalog.md) — LIMIT BUY `price` 0 / -1 / `null`
- [`API-61`](catalog.md), [`API-62`](catalog.md) — LIMIT SELL `price` 0 / -1 (easy+)

No se usa `test.fail()`: el fallo es el defecto.

---

<a id="f-02"></a>

## F-02 — `side` en minúsculas aceptado

**Tiers:** todos.  
**Severity:** Critical — el contrato declara `BUY` \| `SELL`; normalizar en silencio admite clientes rotos.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `400` para `"buy"` / `"sell"`. |
| **Actual** | Orden aceptada; la API persiste `"BUY"` / `"SELL"`. |

### Reproducción

```json
{ "instrument_id": 1, "side": "buy", "type": "MARKET", "quantity": 1 }
```

### Tests

- [`API-43`](catalog.md) — *side is lowercase*

---

<a id="f-03"></a>

## F-03 — `type` en minúsculas aceptado

**Tiers:** todos.  
**Severity:** Critical — mismo criterio que F-02 (`MARKET` \| `LIMIT`).  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `400` para `"market"` / `"limit"`. |
| **Actual** | Orden aceptada; la API persiste el enum en mayúsculas. |

### Tests

- [`API-48`](catalog.md) — *type is lowercase*

---

<a id="f-04"></a>

## F-04 — SELL sin tenencia aceptado

**Tiers:** easy, medium, hard.  
**Severity:** Critical — venta sin inventario (short implícito).  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `400` + `Insufficient shares` (MARKET y LIMIT). Oversell (`owned + 1`) también `400`. |
| **Actual** | MARKET SELL sin holdings → `FILLED`. LIMIT SELL sin holdings → `PENDING`. Oversell aceptado. |

### Reproducción

Tras `POST /reset`:

```json
{ "instrument_id": 1, "side": "SELL", "type": "MARKET", "quantity": 1 }
```

Header: `X-Enable-Bugs: easy`.

### Tests

- [`API-08`](catalog.md), [`API-09`](catalog.md) — MARKET SELL sin holdings; BVA oversell
- [`API-14`](catalog.md) — LIMIT SELL sin holdings

---

<a id="f-05"></a>

## F-05 — MIRG con `last_price = 0`

**Tiers:** easy, medium, hard.  
**Severity:** Normal — dato de catálogo inválido. En el cliente, `lastPrice <= 0` hace que la conversión ARS→acciones devuelva `0` (`orderValidation.ts`).  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | Todo instrumento con `last_price > 0`. |
| **Actual** | `MIRG` (id=5): `last_price: 0`, `close_price: 37.74`. Una MARKET sobre MIRG puede operar a otro precio (observado ~40.88 en discovery). |

### Tests

- [`API-66`](catalog.md) — *All instruments have a positive last_price*

---

<a id="f-06"></a>

## F-06 — Search case-sensitive

**Tiers:** easy, medium, hard.  
**Severity:** Normal — el cliente normaliza con `trim().toUpperCase()` (`searchText.ts`); si la API deja de ser case-insensitive, la UI busca `DYCA` y el usuario que tipeó `dyca` depende de esa capa.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `GET /search?query=dyca` devuelve DYCA (igual que `DYCA`). |
| **Actual** | Lista vacía. |

### Tests

- [`API-71`](catalog.md) — *Search is case-insensitive*

---

<a id="f-07"></a>

## F-07 — `POST /orders` devuelve 200 en lugar de 201

**Tiers:** medium, hard.  
**Severity:** Critical para clientes que ramifican por status HTTP. El cliente mobile de la app **no mira** el status: parsea el body.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `201 Created` al crear la orden. |
| **Actual** | `200 OK`. Body de orden válido. |

En la matriz de 70 tests esto **cascadió**: varios P0 fallaban en el `expect(201)` y no evaluaban cash/holdings. La suite actual acepta `200|201` en assertions de negocio; el `201` estricto queda en `tests/p1/contract.spec.js`. La matriz de 75 en [`test-results.md`](test-results.md) solo marca esos dos contract en `medium`/`hard`.

### Tests

- [`API-26`](catalog.md), [`API-27`](catalog.md) — POST MARKET y POST LIMIT deben ser `201`

---

<a id="f-08"></a>

## F-08 — `quantity` decimal aceptada y truncada

**Tiers:** medium, hard.  
**Severity:** Normal — el usuario pide 1.5 y se confirma 1. El form del cliente exige entero.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | `400` — `quantity must be a positive integer`. |
| **Actual** | Orden aceptada; `quantity` persistido como `1`, MARKET `FILLED`. |

### Reproducción

```json
{ "instrument_id": 1, "side": "BUY", "type": "MARKET", "quantity": 1.5 }
```

`X-Enable-Bugs: medium`.

### Tests

- [`API-38`](catalog.md) — *quantity is a float*

---

<a id="f-09"></a>

## F-09 — `avg_cost_price` ausente en el holding

**Tiers:** hard.  
**Severity:** Critical — el cliente Zod exige el campo (`portfolio.api.ts`). Si falta, la app tira `"Invalid portfolio response"` y no calcula market value / gain.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | Cada holding incluye `avg_cost_price` (number). |
| **Actual** | Campo `undefined` tras un MARKET BUY. |

Un contract sobre `holdings: []` **no detecta** esto (AJV no evalúa `items.required` en un array vacío). El test de contrato con holding cubre el hueco.

### Tests

- [`API-19`](catalog.md) — inputs para métricas client-side
- [`API-30`](catalog.md) — `GET /portfolio` con holdings

---

<a id="f-10"></a>

## F-10 — MARKET se ejecuta a un precio ≠ `last_price`

**Tiers:** hard.  
**Severity:** Blocker — settlement incorrecto: cash y `avg_cost` no coinciden con el precio de mercado del catálogo (en hard el fill observado es `close_price`).  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | MARKET `FILLED` a `last_price` del instrumento (BR-ORD-005). |
| **Actual** | Precio de la orden ≈ `close_price` (DYCA: last 45.72 vs close 50.07). El BVA de cantidad máxima (calculado con `last_price`) falla con `Insufficient cash`. Un BUY de setup puede no debitar. Dos BUY acumulados debitan más que `qty × last_price`. |

### Reproducción

```sh
BUGS_TIER=hard npx playwright test tests/p0/market-orders.spec.js --grep "fills at last_price"
```

Comparar `order.price` con `GET /instruments` → `last_price` y `close_price`.

### Tests

- [`API-04`](catalog.md) — `assertMarketOrderFilled`: `price ≈ last_price` (y ≠ `close_price` cuando difieren)
- [`API-06`](catalog.md) — BVA qty máxima calculada con `last_price`
- [`API-18`](catalog.md), [`API-20`](catalog.md) — reset tras trades; cash de varios BUY

---

<a id="f-11"></a>

## F-11 — Strip de Mercados: 24+1 ≠ 26

**Tiers:** app, `off` (no es inyección de API).  
**Plataforma:** Android, emulador.  
**Severity:** Normal — el resumen del panel miente (un instrumento *flat* no se nombra).  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | Suben + bajan + sin cambio = Total (26), o un renglón para *flat*. |
| **Actual** | Total 26, 24 suben, 1 baja (suma 25). |

### Reproducción

Mercados (tab). Leer el strip: Total / suben / bajan.

### Tests

- [`UI-M-14`](catalog.md)

---

<a id="f-12"></a>

## F-12 — Search no encuentra por nombre de empresa

**Tiers:** app, `off`.  
**Plataforma:** Android.  
**Severity:** Normal — el campo dice *Ticker o empresa*; solo matchea ticker (la API de search tampoco busca razón social).  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | Buscar el nombre de la empresa (p. ej. el de TECO2 / DYCA) devuelve el instrumento. |
| **Actual** | Vacío o sin match. El ticker y el parcial de ticker sí filtran. |

### Reproducción

Buscar → query = nombre de empresa (no ticker). Contrastar con el ticker del mismo activo.

### Tests

- [`UI-M-13`](catalog.md)

---

<a id="f-13"></a>

## F-13 — La barra de tabs tapa contenido

**Tiers:** app, `off`.  
**Plataforma:** Android.  
**Severity:** Normal — no se ve (ni se toca bien) el último ítem; en horizontal tapa resultados de search.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | La lista scrollea por encima o con padding de la tab bar (Mercados, Portafolio, Órdenes, Buscar). |
| **Actual** | Con 2+ filas, el **último** queda tapado en Portafolio y en Órdenes. En **horizontal**, Buscar: la tab tapa el resultado. |

### Reproducción

Portafolio u Órdenes con varias filas → scroll al final. Rotar a horizontal → Buscar → ver resultados vs tab.

### Tests

- [`UI-M-15`](catalog.md)

---

<a id="f-14"></a>

## F-14 — Comprar ↔ Vender persiste cantidad y pesos

**Tiers:** app, `off`.  
**Plataforma:** Android.  
**Severity:** Critical — el usuario puede enviar un SELL con la qty que armó para comprar (o al revés), sin vaciar el form.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | Al cambiar Comprar/Vender, se limpian cantidad y pesos (o se pide confirmación). |
| **Actual** | El número persiste. El ticket de venta **no** se abre desde Portafolio: se opera desde **Mercados**. |

### Reproducción

Mercados → instrumento → Operar → Comprar, cargar qty o pesos → tocar Vender (y al revés). Los campos siguen.

### Tests

- [`UI-M-10`](catalog.md)

---

<a id="f-15"></a>

## F-15 — Se puede operar ARS como acción

**Tiers:** app, `off`.  
**Plataforma:** Android.  
**Severity:** Critical — el instrumento MONEDA/ARS es el cash; “comprarlo” como acción no es un flujo de trading de acciones.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | ARS no se opera como acción (oculto, o el ticket no deja comprar/vender). |
| **Actual** | En Mercados se puede abrir y **enviar** una orden sobre ARS. Confirmado: MARKET **10 × $1,00** *Ejecutada* (orden #348104); el cash se debita. La **venta** de ARS no está en Mercados: se arma desde **Buscar**. |

### Reproducción

Mercados → ARS / MONEDA → Operar → MARKET (p. ej. 10 acciones). Órdenes: fila ARS COMPRA. Portafolio: cash menor y/o holding ARS. Vender: tab Buscar → ARS.

Evidencia: [`evidencia/f-15-compra-ars-market.png`](evidencia/f-15-compra-ars-market.png).

### Tests

- [`UI-M-11`](catalog.md)

---

<a id="f-16"></a>

## F-16 — El ticket de venta no muestra la tenencia

**Tiers:** app, `off`.  
**Plataforma:** Android.  
**Severity:** Normal — se vende a ciegas: no hay “tenés N” en el form.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | El ticket de Vender muestra la cantidad en cartera (o no deja vender más de eso con un tope visible). |
| **Actual** | La venta se arma desde **Mercados**, no desde Portafolio. El form no trae el saldo. Hay que ir a Portafolio, memorizar qty, volver a Mercados. |

### Reproducción

Tener DYCA en cartera. Mercados → DYCA → Operar → Vender. El ticket no muestra cuántas acciones hay.

### Tests

- [`UI-M-12`](catalog.md)

---

<a id="f-17"></a>

## F-17 — En horizontal no se puede cargar la cantidad

**Tiers:** app, `off`.  
**Plataforma:** Android (rotar emulador).  
**Severity:** Normal — el ticket queda inusable en landscape.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | Se puede tipear cantidad / pesos igual que en vertical. |
| **Actual** | Solo se puede elegir Comprar, Limit, Pesos o Acciones. No deja poner la cantidad. |

### Reproducción

Rotar a horizontal → Mercados → instrumento → Operar ahora → intentar cargar qty.

### Tests

- [`UI-M-16`](catalog.md)

---

<a id="f-18"></a>

## F-18 — “Posición no encontrada” tras vender o reiniciar

**Tiers:** app, `off`.  
**Plataforma:** Android.  
**Severity:** Normal — la venta/reset está bien; queda un detalle de posición huérfano en el stack.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | Tras vender todo (o Reiniciar), Portafolio muestra el dashboard (efectivo, 0 posiciones) sin modal de error. |
| **Actual** | Modal *Posición no encontrada* / *No encontramos esta posición en tu portafolio actual* → *Volver a Portafolio*. Recurrido también al **Reiniciar**. Después del CTA el dashboard es correcto: $1.000.000, 0 posiciones, valor total $0 (el valor es de tenencias, no ignora el cash). |

Evidencia: [`evidencia/f-18-posicion-no-encontrada.png`](evidencia/f-18-posicion-no-encontrada.png).

### Reproducción

Vender toda una posición (p. ej. DYCA) → ir a Órdenes (la orden está) → Portafolio. O: Reiniciar cuenta.

### Tests

- [`UI-M-17`](catalog.md) — modal post-venta / post-reset

---

<a id="f-19"></a>

## F-19 — Orden límite rechazada sin motivo ni detalle

**Tiers:** app, `off`.  
**Plataforma:** Android.  
**Severity:** Normal — se ve *Rechazada* y un monto; no hay causa ni ficha al tap.  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | Motivo de rechazo (precio, liquidez, etc.) y/o una ficha al tocar la fila. |
| **Actual** | Fila p. ej. DYCA COMPRA 21×$88 Límite *Rechazada*. El tap no abre nada. |

Evidencia: [`evidencia/f-19-orden-limit-rechazada.png`](evidencia/f-19-orden-limit-rechazada.png).

### Reproducción

LIMIT BUY lejos del mercado → Órdenes → fila *Rechazada* → tap.

### Tests

- [`UI-M-18`](catalog.md)

---

<a id="f-20"></a>

## F-20 — LIMIT SELL rechazada descuenta acciones sin acreditar cash

**Tiers:** `off` (app + API).  
**Plataforma:** Android; el invariante es de portfolio, no de pantalla.  
**Severity:** Critical — se pierde 1 acción y el cash no sube (peor que un fill: en un fill entrarían pesos).  
**Priority:** a definir por el equipo.

### Esperado vs actual

| | |
|---|---|
| **Esperado** | Tras LIMIT SELL *Rechazada*, tenencia y cash iguales que después del BUY de setup. |
| **Actual** | BUY 10 DYCA @ 45,72 → cash **999.542,80** (1.000.000 − 457,20). LIMIT SELL 1 @ 45,76 → *Rechazada*. Portafolio: **9** acciones, valor **411,48** (= 9 × 45,72). El cash **no** se acreditó. No es 457,20 − 45,76 (daría 411,44): es **una acción a last_price**. |

Evidencia: [`evidencia/f-20-portafolio-qty-tras-limit-sell-rechazada.png`](evidencia/f-20-portafolio-qty-tras-limit-sell-rechazada.png), [`evidencia/f-20-ordenes-limit-sell-rechazada.png`](evidencia/f-20-ordenes-limit-sell-rechazada.png).

### Reproducción

1. Reset / cuenta limpia. MARKET BUY 10 DYCA.  
2. LIMIT SELL 1, precio un poco por encima de `last_price` (p. ej. 45,76).  
3. Esperar a *Rechazada*. Ver Portafolio: qty y valor vs 10 × last.

### Tests

- [`UI-M-19`](catalog.md) — repro en emulador  
- [`API-75`](catalog.md) — `F-20: REJECTED LIMIT SELL must not reduce holdings`

---

## Observaciones

No son fallos de la matriz por ID, o no tienen un test dedicado. Se reportan porque la consigna pidió observaciones sobre métricas, contrato y comportamiento no documentado.

### OBS-01 — Coerción de tipos en el payload

En discovery, `quantity: true` se tomó como `1`; se aceptaron `"10"`, `"buy"`, `instrument_id: "1"`. Contradice “positive integer” / enums. **Severity:** Low. Cubierto en parte por F-02/F-03 (strings de enum); `true` no está en la decision table.

### OBS-02 — Mensajes de error inconsistentes

La API mezcla *positive number* y *positive integer*. El cliente solo traduce un set fijo (`orderErrorMessages.ts`: `Insufficient cash`, `Insufficient shares`, etc.). Un mensaje no mapeado se muestra crudo. **Severity:** Low (UX).

### OBS-03 — JSON malformado → HTML

Body no-JSON en `POST /orders` puede devolver HTML en lugar de `{ "error": "…" }`. **Severity:** Low. El cliente espera JSON.

### OBS-04 — `GET /instruments` sin `X-Candidate-Id`

El catálogo responde sin header de candidato. La consigna pide el header en todo request; es razonable en datos de referencia. **Severity:** observación.

### OBS-05 — LIMIT FILLED pisa el precio límite

Al resolverse, `price` de la orden pasa a ser el de ejecución (`last_price`). El historial pierde el límite original. **Severity:** observación (el equipo pidió reportar dónde se calculan las métricas / el precio).

### OBS-06 — Market value, gain y return no los devuelve la API

Se calculan en el cliente (`portfolioMath.ts`) a partir de `quantity`, `last_price`, `avg_cost_price`. Cocos los consideró **dentro del alcance** de la suite: se validan los inputs + oracle local, no un campo `market_value` en el JSON. F-09/F-10 rompen lo que el usuario ve sin que el servidor calcule esas métricas.

### OBS-07 — `CANCELLED` no está en la consigna ni en el cliente

La app admite `PENDING | REJECTED | FILLED`. Nuestro schema de orden incluye `CANCELLED` porque apareció en respuestas. No hay tests que lo exijan. Si se observa, es estado no documentado.

### OBS-08 — Promedio ponderado de `avg_cost_price` no ejercitable en `off`

Precios estáticos; todo MARKET fillea al mismo `last_price`. Se valida `avg_cost ≈ precio de ejecución` (detecta F-10). Limitación, no defecto.

### OBS-09 — Resolución LIMIT sin tiempo máximo

El equipo: depende de liquidez simulada; una orden puede quedar PENDING indefinidamente. La suite usa oracle por estado estable, no un SLA de tiempo.

### OBS-10 — MARKET PENDING en hard (intermitente)

En discovery, algunas MARKET quedaron `PENDING` en hard. Los bugs intermitentes son parte del ejercicio. Si se reproduce, anotar frecuencia en una recorreida (ej. N de M requests).

### OBS-11 — `ticker` ausente en holdings (hard, discovery)

Además de F-09, en discovery faltó `ticker` en algún holding. El schema y el Zod del cliente lo exigen. El contract con holdings cubre el campo.

---

## Cómo reproducir un finding

**API (F-01…F-10):**

1. `X-Enable-Bugs` = tier de la tabla (o `BUGS_TIER=<tier>` al correr Playwright).
2. `X-Candidate-Id` propio; `POST /reset` antes del escenario.
3. Payload de la sección del finding, o el test citado.
4. Evidencia de corrida: `docs/tier-results/results-<tier>.txt` y traces en fallo (`npx playwright show-trace …`).

```sh
BUGS_TIER=off    npx playwright test --reporter=list
BUGS_TIER=easy   npx playwright test --reporter=list
BUGS_TIER=medium npx playwright test --reporter=list
BUGS_TIER=hard   npx playwright test --reporter=list
```

Repro HTTP: JSON del finding, `curl`, o la carpeta **Findings** de [`postman/cocos-api.postman_collection.json`](../postman/cocos-api.postman_collection.json).

**App (F-11…F-20):** emulador Android, `off`, pasos en cada ficha. Capturas en [`evidencia/`](evidencia/). No usar el mismo `CANDIDATE_ID` si Playwright está corriendo en paralelo. F-20 también: `npx playwright test tests/p0/limit-orders.spec.js --grep "F-20"`.

---

## Relación con otros reportes

| Pregunta | Dónde |
|----------|--------|
| ¿Este bug qué casos del catálogo lo cubren? | Este archivo, bloque **Tests** (`API-xx` / `UI-M-xx` → [`catalog.md`](catalog.md)) |
| ¿Qué tests fallaron por tier? | `docs/test-results.md` + `docs/tier-results/` |
| ¿Qué es el bug y cómo lo reproduzco? | Este archivo + Postman (`postman/`) |
| ¿Cuál es el contrato (conocido vs inferido)? | `docs/api-contract.md` |
| ¿Plan / arquitectura / trazabilidad / catálogo? | `docs/test-plan.md`, `docs/architecture.md`, `docs/traceability.md`, `docs/catalog.md` |
| ¿Qué se automatiza en la UI y qué no? | `docs/ui-assessment.md` + `maestro/` |
| ¿Pasó esta corrida? | Allure (`npx allure serve allure-results`) o `npm run test:report` — locales, no commiteados |
