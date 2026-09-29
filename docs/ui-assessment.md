# Evaluación de UI

La app se levantó en un emulador Android (`com.cocos.trading`, Expo / `cocoscap/app-qa`).  
Esta nota fija **qué se automatiza en UI, qué no, y por qué**. No reemplaza a Playwright.

`npm test` sigue siendo **solo API**. Los E2E son opt-in: `npm run test:ui` (ver [`maestro/README.md`](../maestro/README.md)).

---

## Decisión

| Capa | Pregunta | Dónde |
|------|----------|--------|
| API (Playwright) | ¿Se cumple la regla de negocio? (cash, holdings, status, reservas) | `tests/` |
| UI (Maestro) | ¿El ticket y las tabs están enchufados? ¿El cliente convierte ARS→qty? | `maestro/` |

El back es la suite. El E2E **complementa** (binding + cálculo local). No copia P0/P1.

Appium cubriría el mismo árbol de accesibilidad con más infra. Para tres smokes, Maestro es proporcional. En un producto con regresión mobile grande, Appium sería la herramienta.

No se modificó `app-qa` (0 `testID` nuevos). Locators: texto y `accessibilityLabel`.

---

## Qué cubren los 3 E2E

1. **ARS → qty** — modo Pesos, $1000 en DYCA @ 45,72 → *Acciones a enviar* = 21 (`Math.floor`). La API no recibe pesos.
2. **Cableado de una MARKET** — *Enviar orden* → se ve en Portafolio y en Órdenes. Pesca un botón/sheet roto; no re-valida settlement.
3. **Reiniciar** — diálogo de la app → efectivo inicial y sin posiciones.

No hay un E2E por cada combinación Comprar/Vender × Market/Limit × Acciones/Pesos. Se cubren **controles**, no el producto cartesiano.

No se automatiza LIMIT PENDING en UI (no determinístico). Ganancia/retorno en 0 tras un MARKET en `off` es esperado (`last_price == avg_cost`).

---

## Escenarios manuales (exploratorio)

Complementan a Maestro. Misma app, `BUGS_TIER=off`, mismo `CANDIDATE_ID` que la suite **solo si no corre Playwright en paralelo**.

| ID | Flujo | Qué mirar |
|----|--------|-----------|
| UI-M-01 | Mercados → DYCA → Operar ahora → Pesos → 1000 | Acciones a enviar = 21; estimado ≈ $959,12 |
| UI-M-02 | Enviar una MARKET → Portafolio → Órdenes | Fila DYCA; historial con la orden; ganancia 0 en `off` |
| UI-M-03 | Órdenes → Reiniciar | $1.000.000 y 0 posiciones |

Observaciones de producto (no F-xx): ver entrevista / `NOTES` — ticket que no se limpia, filtros, strip 24+1≠26 (un *flat*).

---

## Cómo correr

```sh
# API (siempre)
npm test

# UI (emulador + Metro + app Cocos + Maestro CLI)
npm run test:ui
```

CI (Phase 9) corre solo la API.
