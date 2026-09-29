# Evaluación de UI

La app se levantó en un emulador Android (`com.cocos.trading`, Expo / `cocoscap/app-qa`).  
Esta nota fija **qué se automatiza en UI, qué no, y por qué**. No reemplaza a Playwright.

`npm test` sigue siendo **solo API**. Los E2E son opt-in: `npm run test:ui` (ver [`maestro/README.md`](../maestro/README.md)).

---

## Decisión

Hay dos suites. Cada una responde una pregunta distinta.

| | API (Playwright) | UI (Maestro) |
|--|------------------|--------------|
| **Pregunta** | ¿La API cumple la regla (cash, holdings, status, reservas)? | ¿Un tap de *Enviar orden* deja la orden en Portafolio y Órdenes? ¿Cuántas acciones arma el cliente con pesos? |
| **Dónde** | `tests/` (`npm test`) | `maestro/` (`npm run test:ui`) |
| **CI** | Sí | No |

La suite de entrega es Playwright: ahí está el dinero. Maestro suma lo que la API no ve: que la pantalla muestre la orden, y el `Math.floor` de ARS→qty (la API recibe acciones, no pesos). No se vuelven a correr en el emulador los P0/P1 (BVA de cash, oversell, oracle de LIMIT).

Appium cubriría el mismo árbol de accesibilidad con más infra. Para tres smokes, Maestro es proporcional. En un producto con regresión mobile grande, Appium sería la herramienta.

No se modificó `app-qa` (0 `testID` nuevos). Locators: texto y `accessibilityLabel`.

---

## Qué cubren los 3 E2E

1. **ARS → qty** — modo Pesos, $1000 en DYCA @ 45,72 → *Acciones a enviar* = 21 (`Math.floor`). La API no recibe pesos.
2. **MARKET visible** — *Enviar orden* → se ve en Portafolio y en Órdenes. Pesca un botón/sheet roto; no re-valida settlement.
3. **Reiniciar** — diálogo de la app → efectivo inicial y sin posiciones.

El formulario de orden combina lado, tipo y pesos/acciones. Un E2E por cada cruce repetiría reglas que ya cubre la API. Los tres smokes tocan esos controles del ticket **al menos una vez**. Mercados, search, portafolio, historial y reset no se cubren duplicando ese form.

LIMIT que queda PENDING no se espera en UI: no hay tiempo de fill y el oracle ya está en Playwright. Tras un MARKET en `off`, ganancia y retorno en 0 no es un fallo de pantalla: el fill es a `last_price` y ese valor queda como costo.

---

## Escenarios manuales (exploratorio)

Complementan a Maestro. Misma app, `BUGS_TIER=off`, mismo `CANDIDATE_ID` que la suite **solo si no corre Playwright en paralelo**.

Índice: [`catalog.md`](catalog.md) (UI-M-01…20). Defectos de app: [F-11…F-20](findings.md). Capturas: [`evidencia/`](evidencia/).

**Operar es desde Mercados.** Portafolio no abre el ticket. Valor total $0 con $1.000.000 y 0 posiciones es coherente (el total es de tenencias).

| ID | Flujo | Resultado (Android, `off`) |
|----|--------|----------------------------|
| UI-M-01 | Mercados → DYCA → Pesos → 1000 | Acciones a enviar = 21; estimado coherente |
| UI-M-02 | MARKET con saldo → Órdenes | Orden creada; gain 0 en `off` |
| UI-M-03 | Órdenes → Reiniciar (confirmar) | Tras el modal de F-18 si aparece: $1.000.000, 0 posiciones, valor total $0 |
| UI-M-04 | MARKET sin saldo | *No pudimos enviar la orden*; no hay orden nueva |
| UI-M-05 | Qty no entera / LIMIT precio ≤0 | El form no deja enviar |
| UI-M-06 | LIMIT BUY lejos del mercado | Orden *Rechazada* en Órdenes (no PENDING) |
| UI-M-07 | Dos toques rápidos en *Enviar orden* | Una sola orden |
| UI-M-08 | Pesos ↔ Acciones a mitad de carga | El número no se mezcla |
| UI-M-09 | LIMIT sin precio | No deja enviar |
| UI-M-10 | Comprar, cargar qty/pesos, tocar Vender (y al revés) | Los campos persisten — [F-14](findings.md) |
| UI-M-11 | Mercados → ARS → MARKET 10 × $1 | Ejecutada; cash debitado. Venta de ARS desde **Buscar**, no Mercados — [F-15](findings.md) |
| UI-M-12 | Mercados → Vender (con tenencia en Portafolio) | El ticket no muestra N acciones — [F-16](findings.md) |
| UI-M-13 | Buscar ticker vs nombre de empresa | Ticker/parcial OK; empresa no — [F-12](findings.md) |
| UI-M-14 | Strip de Mercados | 24+1 ≠ 26 — [F-11](findings.md) |
| UI-M-15 | Scroll al último en Portafolio/Órdenes; Buscar en horizontal | Tab tapa contenido — [F-13](findings.md) |
| UI-M-16 | Horizontal → ticket | No se carga cantidad — [F-17](findings.md) |
| UI-M-17 | Vender todo una posición, o Reiniciar | Modal *Posición no encontrada* — [F-18](findings.md) |
| UI-M-18 | Fila LIMIT *Rechazada* → tap | Sin motivo; no abre ficha — [F-19](findings.md) |
| UI-M-19 | BUY 10 DYCA → LIMIT SELL 1 → *Rechazada* | Portafolio 9 acciones / 411,48 sin acreditar cash — [F-20](findings.md) |
| UI-M-20 | Órdenes → Reiniciar → Cancelar | No resetea |

También pasaron (sin fila nueva): vender sin tenencia avisa; vender más de lo que hay lo bloquea el form; cambiar de instrumento limpia qty; 2 posiciones abren el detalle correcto; search `dyca` en `off`; horizontal→vertical deja cargar qty otra vez.

Corte de red / modo avión: **no ejercitable** en este emulador (no se pudo dejar sin red). No es un “pasó”; queda fuera de alcance de esta corrida.

Tras enviar: botón *Enviar otra orden* (mismo estilo); al tocarlo limpia el form de ese instrumento y hay que completar de nuevo — no reenvía la orden. Mercados y Órdenes siguen sin filtros (no es F-xx).

---

## Cómo correr

```sh
# API (siempre)
npm test

# UI (emulador + Metro + app Cocos + Maestro CLI)
npm run test:ui
```

GitHub Actions corre solo la API. Maestro no entra al job.
