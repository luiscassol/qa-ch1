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

Se priorizó profundidad en la capa API (75 tests) por sobre amplitud en UI: ahí está el riesgo de negocio (integridad de cash, holdings y resolución de órdenes). Maestro cubre el tramo que vive en el cliente y la API no ve —conversión monto→cantidad, y que el tap deje la orden en pantalla— sin montar infraestructura E2E pesada para revalidar un comportamiento que, en última instancia, delega en esa misma API. No se re-ejecutan en el emulador los P0/P1 (BVA, oversell, oracle de LIMIT). En un producto con regresión mobile grande, Appium sería la herramienta.

No se modificó `app-qa` (0 `testID` nuevos). Locators: texto y `accessibilityLabel`.

---

## Qué cubren los E2E

Un E2E recorre un flujo en la app como lo haría un usuario: varias pantallas, un tap y lo que queda visible. No sustituye un test de API: no calcula cash ni reservas; comprueba que el camino en UI cierra.

1. **ARS → qty** — modo Pesos, $1000 en DYCA @ 45,72 → *Acciones a enviar* = 21 (`Math.floor`). La API no recibe pesos.
2. **MARKET visible** — *Enviar orden* → se ve en Portafolio y en Órdenes. Pesca un botón/sheet roto; no re-valida settlement.
3. **Reiniciar** — diálogo de la app → efectivo inicial y sin posiciones.

El formulario de orden combina lado, tipo y pesos/acciones. Un E2E por cada cruce repetiría reglas que ya cubre la API. Los tres smokes tocan esos controles del ticket **al menos una vez**. Mercados, search, portafolio, historial y reset no se cubren duplicando ese form.

LIMIT que queda PENDING no se espera en UI: no hay tiempo de fill y el oracle ya está en Playwright. Tras un MARKET en `off`, ganancia y retorno en 0 no es un fallo de pantalla: el fill es a `last_price` y ese valor queda como costo.

---

## Exploratorio (notas, no TCs)

Complementan a Maestro. Scripts: [`manual-cases.md`](manual-cases.md). **Resultado** de UI-M y Maestro: [`test-results.md`](test-results.md#ui). Índice: [`catalog.md`](catalog.md). Defectos: [F-11…F-20](findings.md). Capturas: [`evidencia/`](evidencia/).

Misma app, `BUGS_TIER=off`, mismo `CANDIDATE_ID` que Playwright **solo si no corren en paralelo**.

**Operar es desde Mercados.** Portafolio no abre el ticket. Valor total $0 con $1.000.000 y 0 posiciones es coherente (el total es de tenencias).

También se vio (sin ID UI-M): vender sin tenencia avisa; vender más de lo que hay lo bloquea el form; cambiar de instrumento limpia qty; 2 posiciones abren el detalle correcto; search `dyca` en `off`; horizontal→vertical deja cargar qty otra vez.

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
