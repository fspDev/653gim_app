# 653 Gym & Fitness

App de entrenamiento para los socios (reproductor bloque por bloque) y panel del profe en `/panel`.
Interfaz y lógica de entreno tomadas de 653 Serie (`D:\Desktop\Juego Natán\653-serie`), con los datos y las cuentas de la app anterior (Expo, rama `main`).

## Stack y datos

- React + TypeScript + Vite, CSS Modules con los tokens de `src/index.css`. Sin librerías de UI.
- Firebase (proyecto compartido `somaapp-7166a`: todo lo nuestro lleva prefijo `gym`).
  - `gymUsers/{uid}`: ficha (`role` client|admin, nombre, DNI, teléfono, cuota, `exercisePrefs`, `rutina` {nombre, version}).
  - `gymPlans/{uid}/days/{dayId}`: días. Los del panel nuevo traen `bloques`; los viejos, `groups` (+ `warmupMinutes`/`cooldownMinutes`). Ver `src/rutina/firestoreRutina.ts`.
  - `gymSessions/{uid}/logs/{id}`: entrenos (`v: 2`) y días de la app anterior (id = fecha). Ver `src/syncFormat.ts`.
- Socios entran con nombre y apellido + DNI (cuenta interna `slug@653gym.app`); el profe con usuario `Admin`.

## Convenciones

- Textos en español rioplatense (vos). Números con formato `es-AR`.
- El acento es el rojo de la marca (`--accent`), siempre con texto blanco encima (`--on-accent`).
- Áreas táctiles ≥ 44 px; `aria-label` en botones de solo ícono.
- Tiempos contra instantes de fin (`Date.now()`), nunca contando ticks.
- Lógica pura (reducer, récords, sugerencias, formatos de datos, ventana flotante) con tests de Vitest.
- El entreno nunca depende de la conexión: primero local (IndexedDB) y después se sincroniza.
- Firestore no acepta `undefined`: usar `null`.

## Probar y publicar

```bash
npm run dev        # http://localhost:5173/653gim_app/  (con ?demo: sin cuenta, rutina de ejemplo; solo en desarrollo)
npm test
npm run deploy -- v2     # versión de prueba en https://fspdev.github.io/653gim_app/v2/
npm run deploy -- prod   # reemplaza la app publicada en https://fspdev.github.io/653gim_app/
```

El deploy baja la rama `gh-pages`, cambia lo que corresponde y sube un commit nuevo (sin `--force`). Escribe `.nojekyll`: sin él GitHub Pages no sirve las carpetas que empiezan con `_`.
