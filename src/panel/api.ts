import { authApi, store } from '../backend'
import { AuthError, type WriteOp } from '../backend/types'
import { emailFor, nextFreeUsername, problemaDni, soloDni, usernameFrom } from '../cuentas'
import { estadoCuota, type CuotaConfig, type CuotaManual, type EstadoCuota, type Pago } from '../cuotas'
import type { SerieRow } from '../db'
import { COL } from '../firebase'
import { slugify } from '../keys'
import { fromRow, type ERutina } from '../rutina/editor'
import { rutinaFromDocs, toDayDocs, type DayDoc, type ExercisePref, type RutinaMeta } from '../rutina/firestoreRutina'
import type { RemoteEntreno } from '../syncFormat'
import { uuid } from '../uuid'
import { BASE_EJERCICIOS } from './biblioteca'

/* ───────── Tipos ───────── */

/** Ficha `g653Students/{sid}`. */
export interface StudentDoc {
  nombre: string
  apellido: string
  username: string
  /** Cuenta interna con la que entra hoy (cambia cuando el profe resetea la contraseña). */
  uid: string
  email: string
  telefono: string
  objetivo: string
  /** DNI sin puntos: es la contraseña con la que entra (y vuelve a serlo si el profe la cambia). */
  dni?: string
  /** Profe que lo atiende en el gimnasio (texto libre, opcional). */
  profe?: string
  createdAt: number
  ultimoAcceso?: number
  rutina: RutinaMeta | null
  cuota: CuotaConfig
  /** Cuota marcada a mano (sin monto): al día y hasta cuándo. */
  cuotaManual?: CuotaManual | null
  exercisePrefs?: Record<string, ExercisePref>
}

export interface Estudiante extends StudentDoc {
  id: string
}

export interface Medida {
  id: string
  fecha: string
  pesoKg: number | null
  grasaPct: number | null
  cinturaCm: number | null
  nota: string
  createdAt: number
}

export interface Ejercicio {
  id: string
  nombre: string
  grupo: string | null
}

export interface Resumen {
  e: Estudiante
  /** Cuándo empezó cada entreno (los últimos 60). */
  entrenos: number[]
  pagos: Pago[]
  cuota: EstadoCuota
}

const sPath = (sid: string) => `${COL.students}/${sid}`
const sub = (sid: string, name: 'days' | 'logs' | 'pagos' | 'medidas') => `${sPath(sid)}/${name}`

const asStudent = (id: string, d: Record<string, unknown>): Estudiante => ({ id, ...(d as unknown as StudentDoc) })
const asPago = (id: string, d: Record<string, unknown>): Pago => ({ id, ...(d as unknown as Omit<Pago, 'id'>) })
const asMedida = (id: string, d: Record<string, unknown>): Medida => ({ id, ...(d as unknown as Omit<Medida, 'id'>) })

export const fullName = (e: Pick<StudentDoc, 'nombre' | 'apellido'>) => `${e.nombre} ${e.apellido}`.trim()

/* ───────── Lectura ───────── */

export async function loadEstudiantes(now = Date.now()): Promise<Resumen[]> {
  const docs = (await store.list(COL.students)).filter((d) => !esFichaProfe(d.id))
  const out = await Promise.all(
    docs.map(async (d) => {
      const e = asStudent(d.id, d.data)
      const [logs, pagos] = await Promise.all([store.list(sub(e.id, 'logs'), { orderBy: ['empezadoAt', 'desc'], limit: 60 }), store.list(sub(e.id, 'pagos'))])
      const ps = pagos.map((p) => asPago(p.id, p.data))
      return {
        e,
        entrenos: logs.map((l) => Number(l.data.empezadoAt)).filter(Boolean),
        pagos: ps,
        cuota: estadoCuota(e.cuota, ps, e.createdAt, now, e.cuotaManual),
      }
    }),
  )
  return out.sort((a, b) => fullName(a.e).localeCompare(fullName(b.e), 'es'))
}

export interface Detalle {
  e: Estudiante
  rutina: ERutina | null
  entrenos: RemoteEntreno[]
  pagos: Pago[]
  medidas: Medida[]
}

export async function loadEstudiante(sid: string): Promise<Detalle | null> {
  const [doc, days, logs, pagos, medidas] = await Promise.all([
    store.get(sPath(sid)),
    store.list(sub(sid, 'days')),
    store.list(sub(sid, 'logs'), { orderBy: ['empezadoAt', 'desc'], limit: 300 }),
    store.list(sub(sid, 'pagos')),
    store.list(sub(sid, 'medidas')),
  ])
  if (!doc) return null
  const e = asStudent(sid, doc)
  const dayDocs = days.map((d) => ({ ...(d.data as Omit<DayDoc, 'id'>), id: d.id }))
  // Sin las preferencias: el profe edita lo que él cargó, no el último peso del estudiante.
  const row = rutinaFromDocs(dayDocs, e.rutina)
  return {
    e,
    rutina: row.dias.length ? { ...fromRow(row), nombre: e.rutina?.nombre || 'Plan' } : null,
    entrenos: logs.map((l) => l.data as unknown as RemoteEntreno).filter((l) => l.v === 2),
    pagos: pagos.map((p) => asPago(p.id, p.data)).sort((a, b) => b.periodo.localeCompare(a.periodo) || b.createdAt - a.createdAt),
    medidas: medidas.map((m) => asMedida(m.id, m.data)).sort((a, b) => a.fecha.localeCompare(b.fecha)),
  }
}

/** Series de todos sus entrenos, en la forma que usan las estadísticas de Progreso. */
export function seriesOf(entrenos: RemoteEntreno[]): SerieRow[] {
  return entrenos.flatMap((e) => (e.series ?? []).map((s) => ({ ...s, entrenoId: e.id })))
}

/* ───────── Cuentas ───────── */

/** Crea una cuenta interna libre para el usuario: juan.perez@…, y si ya está usada, juan.perez+2@… y así. */
async function crearCuenta(username: string, clave: string, desde = 1): Promise<{ uid: string; email: string }> {
  for (let n = desde; n < desde + 30; n++) {
    const email = emailFor(username, n)
    try {
      return { uid: await authApi.createAccount(email, clave), email }
    } catch (e) {
      if (e instanceof AuthError && e.code === 'existe') continue
      throw e
    }
  }
  throw new AuthError('otro')
}

/** Número de cuenta interna de un email (juan.perez+3@… → 3). */
const numeroDe = (email: string) => Number(/\+(\d+)@/.exec(email)?.[1] ?? 1)

export interface AltaDatos {
  nombre: string
  apellido: string
  /** Con o sin puntos: se guarda solo con números y es la contraseña. */
  dni: string
  telefono: string
  profe: string
  objetivo: string
  cuota: CuotaConfig
}

export async function altaEstudiante(d: AltaDatos): Promise<{ sid: string; username: string }> {
  const base = usernameFrom(d.nombre, d.apellido)
  if (!base) throw new Error('Falta el nombre.')
  // Usuarios ya tomados (pocos estudiantes: se pregunta de a uno).
  const taken = new Set<string>()
  for (let u = base, n = 2; ; u = `${base}${n++}`) {
    if (!(await store.get(`${COL.logins}/${u}`))) break
    taken.add(u)
  }
  const dni = soloDni(d.dni)
  const problema = problemaDni(dni)
  if (problema) throw new Error(problema)
  const username = nextFreeUsername(base, (u) => taken.has(u))
  const { uid, email } = await crearCuenta(username, dni)
  const sid = uuid()
  const ficha: StudentDoc = {
    nombre: d.nombre.trim(),
    apellido: d.apellido.trim(),
    username,
    uid,
    email,
    telefono: d.telefono.trim(),
    objetivo: d.objetivo.trim(),
    dni,
    profe: d.profe.trim(),
    createdAt: Date.now(),
    rutina: null,
    cuota: d.cuota,
    // Recién anotado: al día, sin fecha hasta que el profe la cargue.
    cuotaManual: { alDia: true, vence: null },
  }
  await store.write([
    { type: 'set', path: sPath(sid), data: { ...ficha } },
    { type: 'set', path: `${COL.logins}/${username}`, data: { email, sid, rol: 'estudiante' } },
  ])
  return { sid, username }
}

/**
 * Contraseña nueva: sin servidor no se puede cambiar la de otra cuenta, así que se crea una cuenta interna
 * nueva y el usuario pasa a entrar con esa. Su ficha, plan e historial no se tocan.
 */
export async function resetClave(e: Estudiante, clave: string): Promise<void> {
  const { uid, email } = await crearCuenta(e.username, clave, numeroDe(e.email) + 1)
  await store.write([
    { type: 'update', path: sPath(e.id), data: { uid, email } },
    { type: 'set', path: `${COL.logins}/${e.username}`, data: { email, sid: e.id, rol: 'estudiante' } },
  ])
}

/** Cambia el DNI y, con él, la contraseña (misma mecánica que `resetClave`). */
export async function cambiarDni(e: Estudiante, dniTexto: string): Promise<void> {
  const dni = soloDni(dniTexto)
  const problema = problemaDni(dni)
  if (problema) throw new Error(problema)
  await resetClave(e, dni)
  await store.write([{ type: 'update', path: sPath(e.id), data: { dni } }])
}

export async function updateFicha(sid: string, patch: Pick<StudentDoc, 'nombre' | 'apellido' | 'telefono' | 'objetivo'> & { profe: string; cuotaManual: CuotaManual }) {
  await store.write([
    {
      type: 'update',
      path: sPath(sid),
      data: {
        nombre: patch.nombre.trim(),
        apellido: patch.apellido.trim(),
        telefono: patch.telefono.trim(),
        objetivo: patch.objetivo.trim(),
        profe: patch.profe.trim(),
        cuotaManual: patch.cuotaManual,
      },
    },
  ])
}

/** Borra todo del estudiante. Su cuenta interna queda sin acceso (sin servidor no se puede borrar). */
export async function bajaEstudiante(e: Estudiante): Promise<void> {
  const subs = await Promise.all((['days', 'logs', 'pagos', 'medidas'] as const).map((n) => store.list(sub(e.id, n)).then((docs) => docs.map((d) => `${sub(e.id, n)}/${d.id}`))))
  const ops: WriteOp[] = subs.flat().map((path) => ({ type: 'delete', path }))
  ops.push({ type: 'delete', path: sPath(e.id) }, { type: 'delete', path: `${COL.logins}/${e.username}` })
  await store.write(ops)
}

/* ───────── Plan ───────── */

export function planVacio(): ERutina {
  return { id: 'rutina', nombre: 'Plan', dias: [{ id: uuid(), letra: 'A', bloques: [] }] }
}

/**
 * Guarda y publica: cada día se escribe entero (con los mismos ids, así el historial sigue apuntando a los
 * mismos bloques), se borran los días quitados y sube la versión. El estudiante lo ve al abrir la app.
 */
export async function publicarPlan(sid: string, rutina: ERutina, version: number): Promise<number> {
  const now = Date.now()
  const docs = toDayDocs(rutina, now)
  const keep = new Set(docs.map((d) => d.id))
  const server = await store.list(sub(sid, 'days'))
  const next = version + 1
  const ops: WriteOp[] = docs.map(({ id, ...data }) => ({ type: 'set', path: `${sub(sid, 'days')}/${id}`, data }))
  for (const d of server) if (!keep.has(d.id)) ops.push({ type: 'delete', path: `${sub(sid, 'days')}/${d.id}` })
  ops.push({ type: 'update', path: sPath(sid), data: { rutina: { nombre: rutina.nombre.trim() || 'Plan', version: next, publicadaAt: now, dias: docs.length } } })
  await store.write(ops)

  // Biblioteca: cada ejercicio de fuerza queda para el próximo plan.
  const lib: WriteOp[] = rutina.dias
    .flatMap((d) => d.bloques)
    .filter((b) => b.tipo === 'fuerza' && b.nombre.trim())
    .map((b) => ({
      type: 'set',
      path: `${COL.exercises}/${b.ejercicioId || slugify(b.nombre)}`,
      data: { nombre: b.nombre.trim(), updatedAt: now },
      merge: true,
    }))
  if (lib.length) await store.write(lib).catch(() => {})
  return next
}

/* ───────── Biblioteca ───────── */

export const GRUPOS = ['Piernas', 'Glúteos', 'Pecho', 'Espalda', 'Hombros', 'Brazos', 'Core', 'Cardio', 'Movilidad']

export async function loadEjercicios(): Promise<Ejercicio[]> {
  const docs = await store.list(COL.exercises)
  const byId = new Map<string, Ejercicio>(BASE_EJERCICIOS.map((e) => [e.id, { ...e }]))
  for (const d of docs) {
    // Los de base no se pueden borrar del código: al eliminarlos quedan marcados como ocultos.
    if (d.data.oculto) {
      byId.delete(d.id)
      continue
    }
    const prev = byId.get(d.id)
    byId.set(d.id, { id: d.id, nombre: String(d.data.nombre ?? prev?.nombre ?? d.id), grupo: (d.data.grupo as string) ?? prev?.grupo ?? null })
  }
  return [...byId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * Crea o edita un ejercicio. Al renombrarlo se conserva el id (la clave del historial); los planes ya
 * armados guardan su propia copia del nombre, así que no cambian.
 */
export async function guardarEjercicio(e: { nombre: string; grupo: string | null }, id = slugify(e.nombre)): Promise<string> {
  await store.write([
    { type: 'set', path: `${COL.exercises}/${id}`, data: { nombre: e.nombre.trim(), grupo: e.grupo?.trim() || null, oculto: false, updatedAt: Date.now() }, merge: true },
  ])
  return id
}

/** Lo saca de la biblioteca. Los planes que ya lo usan no cambian. */
export async function eliminarEjercicio(id: string): Promise<void> {
  await store.write([{ type: 'set', path: `${COL.exercises}/${id}`, data: { oculto: true, updatedAt: Date.now() }, merge: true }])
}

/* ───────── El profe ───────── */

/** La rutina propia del profe vive en una ficha como la de un estudiante, con id fijo. */
export const fichaProfeId = (uid: string) => `yo-${uid}`
export const esFichaProfe = (sid: string) => sid.startsWith('yo-')

/** Crea la ficha propia del profe si todavía no existe y devuelve su id. */
export async function asegurarFichaProfe(p: { id: string; nombre: string; apellido: string; username: string }): Promise<string> {
  const sid = fichaProfeId(p.id)
  const doc = await store.get(sPath(sid))
  if (!doc || !doc.nombre) {
    const ficha: StudentDoc = {
      nombre: p.nombre,
      apellido: p.apellido,
      username: p.username,
      uid: p.id,
      email: '',
      telefono: '',
      objetivo: '',
      createdAt: Date.now(),
      rutina: null,
      cuota: { monto: 0, dia: 10 },
    }
    // merge: si ya entrenó antes de armar la ficha, conserva sus últimos pesos.
    await store.write([{ type: 'set', path: sPath(sid), data: { ...ficha, ...(doc?.rutina ? { rutina: doc.rutina } : {}) }, merge: true }])
  }
  return sid
}

/**
 * Nombre y usuario del profe. El usuario nuevo apunta a la misma cuenta interna (no cambia la contraseña);
 * el viejo deja de servir.
 */
export async function guardarCuentaProfe(actual: { id: string; username: string }, d: { nombre: string; apellido: string; username: string }): Promise<void> {
  const username = d.username
  const ops: WriteOp[] = []
  if (username !== actual.username) {
    if (await store.get(`${COL.logins}/${username}`)) throw new Error('Ese usuario ya lo usa un estudiante.')
    const old = (await store.get(`${COL.logins}/${actual.username}`)) as { email?: string } | null
    ops.push(
      { type: 'set', path: `${COL.logins}/${username}`, data: { email: old?.email ?? emailFor(actual.username), rol: 'profe' } },
      { type: 'delete', path: `${COL.logins}/${actual.username}` },
    )
  }
  ops.push({ type: 'update', path: `${COL.config}/profe`, data: { nombre: d.nombre.trim(), apellido: d.apellido.trim(), username } })
  if (await store.get(sPath(fichaProfeId(actual.id)))) ops.push({ type: 'update', path: sPath(fichaProfeId(actual.id)), data: { nombre: d.nombre.trim(), apellido: d.apellido.trim(), username } })
  await store.write(ops)
}

/* ───────── Cuotas ───────── */

export async function guardarCuota(sid: string, cuota: CuotaConfig) {
  await store.write([{ type: 'update', path: sPath(sid), data: { cuota } }])
}

export async function registrarPago(sid: string, p: Omit<Pago, 'id' | 'createdAt'>): Promise<void> {
  await store.write([{ type: 'set', path: `${sub(sid, 'pagos')}/${uuid()}`, data: { ...p, createdAt: Date.now() } }])
}

export async function borrarPago(sid: string, id: string) {
  await store.write([{ type: 'delete', path: `${sub(sid, 'pagos')}/${id}` }])
}

/* ───────── Medidas ───────── */

export async function guardarMedida(sid: string, m: Omit<Medida, 'id' | 'createdAt'>): Promise<void> {
  await store.write([{ type: 'set', path: `${sub(sid, 'medidas')}/${uuid()}`, data: { ...m, createdAt: Date.now() } }])
}

export async function borrarMedida(sid: string, id: string) {
  await store.write([{ type: 'delete', path: `${sub(sid, 'medidas')}/${id}` }])
}
