# Casos de prueba manuales (UI)

Scripts de **UI-M-01…20**: precondición, pasos y **esperado** (criterio). Para replicar, no hace falta leer una corrida.

**Resultado** de la corrida Android / `off`: [`test-results.md`](test-results.md#ui). Defectos: [`findings.md`](findings.md). Índice: [`catalog.md`](catalog.md). Decisión UI: [`ui-assessment.md`](ui-assessment.md).

Los 75 de Playwright no se reescriben acá: el `test()` es el caso.

---

## Precondiciones comunes

- Emulador Android, app Cocos (`com.cocos.trading`).
- Un `CANDIDATE_ID` que **no** esté en paralelo con Playwright.
- Operar desde **Mercados**. Portafolio no abre el ticket.
- Cuenta en $1.000.000 / 0 posiciones salvo que el caso pida tenencia (Reiniciar si hace falta).

---

<a id="ui-m-01"></a>

## UI-M-01 — Preview pesos → acciones (DYCA $1000)

**Precondición:** cuenta limpia.  
**Pasos:** Mercados → DYCA → Operar → modo Pesos → 1000.  
**Esperado:** *Acciones a enviar* = 21; estimado coherente con 21 × last (~45,72).

<a id="ui-m-02"></a>

## UI-M-02 — MARKET con saldo queda en Órdenes

**Precondición:** saldo suficiente.  
**Pasos:** Mercados → DYCA → MARKET (acciones o el preview de UI-M-01) → Enviar → tab Órdenes (y Portafolio).  
**Esperado:** hay una orden de compra; en `off` ganancia/retorno 0 (fill a last = costo).

<a id="ui-m-03"></a>

## UI-M-03 — Reiniciar restaura la cuenta

**Precondición:** al menos una orden o posición (p. ej. después de UI-M-02).  
**Pasos:** Órdenes → Reiniciar → confirmar.  
**Esperado:** $1.000.000, 0 posiciones, valor total $0 (el total es de tenencias). Sin modal de error.

<a id="ui-m-04"></a>

## UI-M-04 — MARKET sin saldo

**Precondición:** cash insuficiente (gastar o qty que no alcance).  
**Pasos:** MARKET BUY que exceda el efectivo → Enviar.  
**Esperado:** aviso *No pudimos enviar la orden*; no hay orden nueva en Órdenes.

<a id="ui-m-05"></a>

## UI-M-05 — Cantidad no entera / precio LIMIT inválido

**Precondición:** ticket abierto (DYCA).  
**Pasos:** (a) qty no entera o ≤0; (b) LIMIT, precio ≤0 o con coma inválida. Intentar enviar.  
**Esperado:** el form no deja enviar.

<a id="ui-m-06"></a>

## UI-M-06 — LIMIT BUY lejos del mercado

**Precondición:** ticket DYCA.  
**Pasos:** LIMIT BUY con precio claramente fuera de mercado → Enviar → Órdenes.  
**Esperado:** fila *Rechazada* (no se asume PENDING en UI).

<a id="ui-m-07"></a>

## UI-M-07 — Doble tap en Enviar

**Precondición:** MARKET válido, listo para enviar.  
**Pasos:** dos toques rápidos en *Enviar orden*.  
**Esperado:** una sola orden en Órdenes.

<a id="ui-m-08"></a>

## UI-M-08 — Pesos ↔ Acciones a mitad de carga

**Precondición:** ticket, modo Pesos (o Acciones).  
**Pasos:** tipear a medias → cambiar Pesos/Acciones.  
**Esperado:** no se mezcla el número (no queda un valor absurdo del otro modo).

<a id="ui-m-09"></a>

## UI-M-09 — LIMIT sin precio

**Precondición:** ticket, tipo Límite.  
**Pasos:** qty válida, precio vacío o 0 → intentar enviar.  
**Esperado:** no deja enviar.

<a id="ui-m-10"></a>

## UI-M-10 — Comprar ↔ Vender limpia el form

**Hallazgo (diseño):** [F-14](findings.md#f-14).  
**Precondición:** Mercados → instrumento → Operar.  
**Pasos:** Comprar, cargar qty o pesos → tocar Vender (y al revés).  
**Esperado:** se limpian qty/pesos (o pide confirmación).

<a id="ui-m-11"></a>

## UI-M-11 — ARS no se opera como acción

**Hallazgo (diseño):** [F-15](findings.md#f-15).  
**Precondición:** cuenta limpia.  
**Pasos:** Mercados → ARS/MONEDA → MARKET 10 × $1 → Enviar. Luego intentar vender ARS desde Mercados; si no, Buscar → ARS.  
**Esperado:** ARS no se compra/vende como acción (oculto o ticket bloqueado).

<a id="ui-m-12"></a>

## UI-M-12 — Ticket de venta muestra tenencia

**Hallazgo (diseño):** [F-16](findings.md#f-16).  
**Precondición:** tener DYCA en Portafolio (un MARKET BUY).  
**Pasos:** Mercados → DYCA → Operar → Vender.  
**Esperado:** se ve cuántas acciones hay (o un tope visible).

<a id="ui-m-13"></a>

## UI-M-13 — Search por ticker y por empresa

**Hallazgo (diseño):** [F-12](findings.md#f-12).  
**Precondición:** tab Buscar.  
**Pasos:** (a) ticker o parcial (p. ej. `DY` / `DYCA`); (b) nombre de empresa del mismo activo.  
**Esperado:** ambos devuelven el instrumento (el label dice *Ticker o empresa*).

<a id="ui-m-14"></a>

## UI-M-14 — Strip Mercados cuadra

**Hallazgo (diseño):** [F-11](findings.md#f-11).  
**Precondición:** tab Mercados.  
**Pasos:** leer Total / suben / bajan (y *flat* si existe).  
**Esperado:** suben + bajan + sin cambio = Total (26).

<a id="ui-m-15"></a>

## UI-M-15 — Tabs no tapan el último ítem

**Hallazgo (diseño):** [F-13](findings.md#f-13).  
**Precondición:** 2+ filas en Portafolio y en Órdenes.  
**Pasos:** scroll al final en cada tab. Rotar horizontal → Buscar → ver resultados vs tab bar.  
**Esperado:** la lista queda usable; el último ítem no queda tapado.

<a id="ui-m-16"></a>

## UI-M-16 — Ticket usable en horizontal

**Hallazgo (diseño):** [F-17](findings.md#f-17).  
**Precondición:** emulador en landscape.  
**Pasos:** Mercados → instrumento → Operar → cargar cantidad o pesos.  
**Esperado:** se puede tipear igual que en vertical.

<a id="ui-m-17"></a>

## UI-M-17 — Sin modal huérfano tras vender todo o Reiniciar

**Hallazgo (diseño):** [F-18](findings.md#f-18).  
**Precondición:** una posición (p. ej. DYCA).  
**Pasos:** (a) vender toda la posición → Portafolio; o (b) Reiniciar.  
**Esperado:** dashboard correcto, sin modal *Posición no encontrada*.

<a id="ui-m-18"></a>

## UI-M-18 — LIMIT rechazada tiene motivo / ficha

**Hallazgo (diseño):** [F-19](findings.md#f-19).  
**Precondición:** una LIMIT *Rechazada* (como UI-M-06).  
**Pasos:** Órdenes → tap en la fila.  
**Esperado:** motivo de rechazo y/o ficha de la orden.

<a id="ui-m-19"></a>

## UI-M-19 — LIMIT SELL rechazada no rompe holdings

**Hallazgo (diseño):** [F-20](findings.md#f-20). Mismo invariante: [`API-75`](catalog.md).  
**Precondición:** reset.  
**Pasos:** MARKET BUY 10 DYCA → LIMIT SELL 1 un poco sobre last (p. ej. 45,76) → esperar *Rechazada* → Portafolio.  
**Esperado:** 10 acciones y el cash post-BUY (no se pierde 1 acción ni se acredita de más).

<a id="ui-m-20"></a>

## UI-M-20 — Reiniciar → Cancelar no resetea

**Precondición:** cuenta con movimiento (no limpia).  
**Pasos:** Órdenes → Reiniciar → Cancelar.  
**Esperado:** cash y posiciones iguales que antes.
