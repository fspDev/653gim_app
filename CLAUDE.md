# 653 Gym & Fitness

App de entrenamiento con dos tipos de usuario:
- **Socios** (la app, `/`): ven el plan que les armó el profe y lo entrenan bloque por bloque (series con peso y descanso, bici por tiempo, circuitos, ventana flotante, progreso y récords). Cada ejercicio puede traer una indicación y un video de YouTube del profe.
- **Profe** (uno solo, `/panel`): da de alta socios, arma y publica su plan, ve el registro de cada entreno, la evolución (constancia, peso por ejercicio, medidas) y las cuotas. Maneja la biblioteca de ejercicios, su cuenta y su propia rutina.

**El código es el de AM Personal Trainer** (`D:\Desktop\AM-personal`, repo fspDev/AM-personal) con la marca del 653 (logo "653", acento rojo `#e3202f` con texto blanco) y sus propias colecciones. Las mejoras de una conviene llevarlas a la otra. La versión anterior (Vite sobre `gymUsers`/`gymPlans`/`gymSessions`) quedó en la rama `main` hasta el pase a producción; la de Expo, en el historial y en `D:\Desktop\GymApp\expo-viejo`.

## Datos (Firebase `somaapp-7166a`, compartido con SomaApp y AM)

Todo lo de esta versión lleva prefijo `g653` (ver `COL` en `src/firebase.ts`):
- `g653Config/profe`: `{ uid, nombre, apellido, username }`. No se puede crear desde la app (lo carga la migración).
- `g653Logins/{usuario}`: `{ email, sid, rol }`. Se lee sin sesión, de a uno.
- `g653Students/{sid}`: ficha + subcolecciones `days`, `logs`, `pagos`, `medidas`. Los socios migrados usan su uid como `sid` y conservan `dni`.
- `g653Exercises/{slug}`: biblioteca del profe.

**Cuentas:** usuario `nombre.apellido` → cuenta interna `nombre.apellido@653gym.app` (las mismas cuentas de siempre: la contraseña de los socios migrados es su DNI). En el ingreso se puede escribir "Franco Pereyra": se normaliza a `franco.pereyra`. El profe entra con `admin`.

**Migración:** `node scripts/migrar-653.mjs` (sin `--escribir` solo muestra qué haría). Copia desde las colecciones viejas (`gymUsers`, `gymPlans`, `gymSessions`, `gymExerciseLibrary`) sin tocarlas; se puede volver a correr para el pase final. Las cuotas quedan sin monto (el profe lo carga en Cuotas).

**Reglas:** `firestore.rules` es UNO para todo el proyecto (SomaApp + 653 viejo + AM + 653 nuevo). La copia de verdad es la de esta carpeta; la de AM-personal tiene que ser idéntica. Antes de desplegar, `node scripts/test-reglas.mjs`. Desplegar: `firebase deploy --only firestore:rules --project somaapp-7166a`.

En el teléfono: claves locales con prefijo `g653:` e IndexedDB `g653` (el dominio `fspdev.github.io` es compartido con otras apps).

## Convenciones

- React + TypeScript + Vite, CSS Modules con las variables de `src/index.css`/`src/theme.ts`. Sin librerías de UI.
- Textos en español rioplatense (vos), números `es-AR`. Áreas táctiles ≥ 44 px. El panel tiene que andar en el celular.
- Tiempos contra instantes de fin, nunca contando ticks. Lógica pura con tests de Vitest.
- Firestore no acepta `undefined` (se ignora con `ignoreUndefinedProperties`); preferir `null`.
- Modo demo (solo `npm run dev`, con `?demo`): servidor de mentira en el navegador, datos en `src/backend/demoSeed.ts`.

## Probar y publicar

```bash
npm run dev               # http://localhost:5173/653gim_app/  (?demo para el modo demo)
npm test
npm run deploy -- v2      # prueba en https://fspdev.github.io/653gim_app/v2/
npm run deploy -- prod    # reemplaza la app publicada
```

El deploy baja la rama `gh-pages`, cambia lo que corresponde y sube un commit nuevo (sin `--force`).
