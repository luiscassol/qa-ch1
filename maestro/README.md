# Maestro — smokes de UI

Tres flujos contra la app Android. **No** forman parte de `npm test`.

## Requisitos

1. App [cocoscap/app-qa](https://github.com/cocoscap/app-qa) instalada en un emulador (package `com.cocos.trading`).
2. Metro corriendo (`bun run android` o `bun start` + app abierta).
3. [Maestro CLI](https://maestro.mobile.dev): `curl -Ls "https://get.maestro.mobile.dev" | bash`
4. Mismo `EXPO_PUBLIC_CANDIDATE_ID` que uses a mano. No corras Playwright en paralelo sobre ese tenant.

## Ejecutar

Desde la raíz de este repo, con el emulador y la app en primer plano:

```sh
npm run test:ui
```

(`01`, `02` y `03` solamente; el subflow no se corre como test aparte.)

Reporte local (no es Allure):

```sh
maestro test maestro/ --debug-output maestro/debug --format junit --output maestro/junit-report.xml
```

Ahí quedan screenshots del fallo, jerarquía y XML. También: `~/.maestro/tests/`.

Si en el detalle del instrumento hay un chip **Debug** / **Activo local** o la barra
amarilla *Open debugger to view warnings*, cerrala (la X de la derecha). Es LogBox
de Expo, no de Cocos, y tapa *Operar ahora*. El subflow intenta cerrarla solo.

o:

```sh
maestro test maestro/
```

Un flujo:

```sh
maestro test maestro/01-ars-to-qty.yaml
```

Para ver locators (equivalente al Inspect):

```sh
maestro studio
```

## Flujos

| Archivo | Qué afirma |
|---------|------------|
| `01-ars-to-qty.yaml` | Pesos $1000 en DYCA → 21 acciones a enviar |
| `02-buy-wiring.yaml` | Una MARKET aparece en Portafolio y Órdenes |
| `03-reset.yaml` | Reiniciar deja efectivo inicial |

Si un tap falla (tabs nativos), ajustar con Studio. No agregar `testID` en `app-qa` para este challenge.
