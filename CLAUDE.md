# 653 Gimnasio (2.0)

App de entrenamiento con dos tipos de usuario:
- **Socios** (la app, `/`): ven el plan que les armó el profe y lo entrenan bloque por bloque (series con peso y descanso, bici por tiempo, circuitos, ventana flotante, progreso y récords), en el orden que quieran: al terminar un bloque eligen cuál sigue. Cada ejercicio puede traer una indicación del profe.
- **Profe** (uno solo, `/panel`): da de alta socios, arma y publica su plan, ve el registro de cada entreno, la evolución (constancia, peso por ejercicio, medidas) y las cuotas. Maneja la biblioteca de ejercicios, su cuenta y su propia rutina.

**AM Personal Trainer es el modelo** (repo fspDev/AM-personal): esta app es su código adaptado al 653, con sus propias colecciones. Lo nuevo de AM se trae acá, salvo lo que el 653 no usa: **sin video de YouTube ni RPE por serie**.

Lo propio del 653 (lo que AM no tiene):
- Los socios entran con nombre y apellido y su **DNI** como contraseña (`soloDni`/`problemaDni` en `src/cuentas.ts`). El profe "cambia el DNI" desde la Ficha: la contraseña vuelve a ser el DNI (`cambiarDni` en `src/panel/api.ts`).
- Ficha con **profe** asignado (texto libre) y **cuota marcada a mano** (`cuotaManual`: al día + pagada hasta). Si el socio tiene monto cargado, mandan los pagos como en AM (`estadoCuota` en `src/cuotas.ts`).
- Filtro "Entrenaron esta semana" en Socios y **arrastrar para ordenar** los bloques del plan (`src/panel/dragSort.ts`, con puntero: anda con el dedo).

**Marca:** logo original en `marca/logo653-original.png`; `powershell -File scripts/logo.ps1` genera las versiones para fondo claro y oscuro (`src/assets`) y los íconos (`public`). Colores del logo: rojo `#e8192f` (con texto blanco), grafito `#2b2b2b` y fondo blanco (`src/theme.ts`). El logo elige su versión según `data-scheme` en `<html>`.

La versión anterior (Vite sobre `gymUsers`/`gymPlans`/`gymSessions`) quedó en la rama `main` hasta el pase a producción; la de Expo, en el historial y en `D:\Desktop\GymApp\expo-viejo`.

## Datos (Firebase `somaapp-7166a`, compartido con SomaApp y AM)

Todo lo de esta versión lleva prefijo `g653` (ver `COL` en `src/firebase.ts`):
- `g653Config/profe`: `{ uid, nombre, apellido, username }`. No se puede crear desde la app (lo carga la migración).
- `g653Logins/{usuario}`: `{ email, sid, rol }`. Se lee sin sesión, de a uno.
- `g653Students/{sid}`: ficha (`dni`, `profe`, `cuota`, `cuotaManual`…) + subcolecciones `days`, `logs`, `pagos`, `medidas`. Los socios migrados usan su uid como `sid`.
- `g653Exercises/{slug}`: biblioteca del profe.

**Cuentas:** usuario `nombre.apellido` → cuenta interna `nombre.apellido@653gym.app` (las mismas cuentas de siempre: la contraseña de los socios migrados es su DNI). En el ingreso se puede escribir "Franco Pereyra": se normaliza a `franco.pereyra`. El profe entra con `admin`.

**Migración:** `node scripts/migrar-653.mjs` (sin `--escribir` solo muestra qué haría). Copia desde las colecciones viejas (`gymUsers`, `gymPlans`, `gymSessions`, `gymExerciseLibrary`) sin tocarlas; se puede volver a correr para el pase final. Las cuotas pasan sin monto, con el estado a mano de la app vieja (`feeStatus`/`feeDueDate` → `cuotaManual`), y el profe de cada socio (`coachName`) pasa a `profe`.

**Reglas:** `firestore.rules` es UNO para todo el proyecto (SomaApp + 653 viejo + AM + 653 nuevo). La copia de verdad es la de esta carpeta; la de AM-personal tiene que ser idéntica. Antes de desplegar, `node scripts/test-reglas.mjs`. Desplegar: `firebase deploy --only firestore:rules --project somaapp-7166a`.

En el teléfono: claves locales con prefijo `g653:` e IndexedDB `g653` (el dominio `fspdev.github.io` es compartido con otras apps).

## Convenciones

- React + TypeScript + Vite, CSS Modules con las variables de `src/index.css`/`src/theme.ts`. Sin librerías de UI.
- Textos en español rioplatense (vos), números `es-AR`. Áreas táctiles ≥ 44 px. El panel tiene que andar en el celular.
- Tiempos contra instantes de fin, nunca contando ticks. Lógica pura con tests de Vitest.
- Firestore no acepta `undefined` (se ignora con `ignoreUndefinedProperties`); preferir `null`.
- Modo demo (solo `npm run dev`, con `?demo`): servidor de mentira en el navegador, datos en `src/backend/demoSeed.ts` (profe `admin` / `demo1234`; los socios entran con su DNI).
- En la interfaz se dice **socio**, no estudiante (en el código quedan los nombres de AM: `Estudiante`, `rol: 'estudiante'`).

## Probar y publicar

```bash
npm run dev               # http://localhost:5173/653gim_app/  (?demo para el modo demo)
npm test
npm run deploy -- v2      # prueba en https://fspdev.github.io/653gim_app/v2/
npm run deploy -- prod    # reemplaza la app publicada
```

El deploy baja la rama `gh-pages`, cambia lo que corresponde y sube un commit nuevo (sin `--force`).
