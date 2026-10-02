import { deleteApp, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, deleteUser, getAuth, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { COL, db, firebaseConfig, slugify, usernameToEmail } from '../firebase'
import { rutinaFromFirestore, type DayDoc, type LegacyExercise } from '../rutina/firestoreRutina'
import type { RemoteEntreno } from '../syncFormat'
import { uuid } from '../uuid'
import { fromRow, toRows, type ERutina } from './editor'
import type { SocioEntreno, SocioProfile, SocioRutina } from './listado'

/** Ficha del socio en `gymUsers/{uid}` (la misma de la app anterior). */
export interface SocioDoc {
  role: 'client' | 'admin'
  firstName: string
  lastName: string
  username?: string
  dni?: string
  phone?: string
  coachName?: string
  planType?: string
  feeStatus?: 'ok' | 'overdue'
  feeDueDate?: string
  rutina?: { nombre?: string; version?: number; publicadaAt?: number }
}

const days = (uid: string) => collection(db, COL.plans, uid, 'days')
const logs = (uid: string) => collection(db, COL.sessions, uid, 'logs')

interface LogDoc extends Partial<Omit<RemoteEntreno, 'v' | 'exercises'>> {
  v?: number
  date?: string
  dayId?: string
  startedAt?: number
  exercises?: { sets?: unknown[] }[]
}

/** Cuándo empezó ese entreno; `null` si es un día que la app anterior abrió pero no se hizo nada. */
function trainedAt(d: LogDoc): number | null {
  if (d.v === 2) return d.empezadoAt ?? null
  const any = (d.exercises ?? []).some((e) => (e.sets?.length ?? 0) > 0)
  if (!any) return null
  return d.startedAt ?? (d.date ? new Date(`${d.date}T12:00:00`).getTime() : null)
}

const fullName = (s: SocioDoc) => `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()

export interface SocioExtra {
  phone: string
  dni: string
  coachName: string
  feeOk: boolean
  feeDueDate: string
}

export async function loadSocios(_profeId: string) {
  void _profeId
  const snap = await getDocs(query(collection(db, COL.users), where('role', '==', 'client')))
  const socios = snap.docs.map((d) => ({ id: d.id, ...(d.data() as SocioDoc) }))

  const perSocio = await Promise.all(
    socios.map(async (s) => {
      const [dSnap, lSnap] = await Promise.all([getDocs(days(s.id)), getDocs(query(logs(s.id), orderBy('date', 'desc'), limit(60)))])
      const dayDocs = dSnap.docs.map((d) => ({ ...(d.data() as DayDoc), id: d.id }))
      const conBloques = rutinaFromFirestore(dayDocs, s.rutina, undefined).dias.filter((d) => d.bloques.some((b) => b.tipo !== 'tiempo'))
      const rutina: SocioRutina | null = conBloques.length
        ? {
            socio_id: s.id,
            nombre: s.rutina?.nombre || 'Rutina',
            dias_por_semana: conBloques.length,
            publicada_at: new Date(s.rutina?.publicadaAt ?? 0).toISOString(),
            creado_at: new Date(0).toISOString(),
          }
        : null
      const entrenos: SocioEntreno[] = lSnap.docs
        .map((d) => trainedAt(d.data() as LogDoc))
        .filter((t): t is number => t !== null)
        .map((t) => ({ socio_id: s.id, empezado_at: new Date(t).toISOString() }))
      return { rutina, entrenos }
    }),
  )

  const profiles: (SocioProfile & SocioExtra)[] = socios
    .map((s) => ({
      id: s.id,
      nombre: fullName(s),
      email: s.phone ? `Tel. ${s.phone}` : `DNI ${s.dni ?? '—'}`,
      phone: s.phone ?? '',
      dni: s.dni ?? '',
      coachName: s.coachName ?? '',
      feeOk: (s.feeStatus ?? 'ok') === 'ok',
      feeDueDate: s.feeDueDate ?? '',
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return {
    profiles,
    rutinas: perSocio.map((p) => p.rutina).filter((r): r is SocioRutina => r !== null),
    entrenos: perSocio.flatMap((p) => p.entrenos),
  }
}

export interface EditorData {
  socio: { id: string; nombre: string; email: string } | null
  rutina: ERutina | null
  publicada: boolean
  version: number
  lastAt: number | null
}

export async function loadEditor(socioId: string, _profeId: string): Promise<EditorData> {
  void _profeId
  const [uSnap, dSnap, lSnap] = await Promise.all([
    getDoc(doc(db, COL.users, socioId)),
    getDocs(days(socioId)),
    getDocs(query(logs(socioId), orderBy('date', 'desc'), limit(30))),
  ])
  const socio = uSnap.exists() ? (uSnap.data() as SocioDoc) : null
  const dayDocs = dSnap.docs.map((d) => ({ ...(d.data() as DayDoc), id: d.id }))
  const row = rutinaFromFirestore(dayDocs, socio?.rutina, undefined)
  const last = lSnap.docs.map((d) => trainedAt(d.data() as LogDoc)).filter((t): t is number => t !== null)
  return {
    socio: socio ? { id: socioId, nombre: fullName(socio), email: socio.phone ? `Tel. ${socio.phone}` : `DNI ${socio.dni ?? '—'}` } : null,
    rutina: row.dias.length ? { ...fromRow(row), nombre: socio?.rutina?.nombre || 'Rutina' } : null,
    publicada: row.dias.length > 0,
    version: socio?.rutina?.version ?? 0,
    lastAt: last.length ? Math.max(...last) : null,
  }
}

/** Crea una rutina con el Día A vacío para un socio que todavía no tiene días. */
export async function createRutina(socioId: string, _profeId: string): Promise<ERutina> {
  void _profeId
  const id = uuid()
  await setDoc(doc(days(socioId), id), { letra: 'A', label: 'Día A', order: 1, bloques: [], updatedAt: Date.now() })
  return { id: 'rutina', nombre: 'Rutina', dias: [{ id, letra: 'A', bloques: [] }] }
}

/** Para que la app anterior siga mostrando la rutina mientras conviven: los bloques de fuerza como su grupo "fuerza". */
function legacyFields(bloques: ReturnType<typeof toRows>['bloques']) {
  const fuerza: LegacyExercise[] = bloques
    .filter((b) => b.tipo === 'fuerza')
    .map((b, i) => ({ id: b.id, name: b.nombre, sets: b.series ?? 3, reps: b.reps ?? 10, restSeconds: b.descanso_s ?? 90, order: i + 1 }))
  const first = bloques[0]
  const lastB = bloques[bloques.length - 1]
  return {
    groups: { core: [], fuerza },
    warmupMinutes: first?.tipo === 'tiempo' ? (first.minutos ?? 0) : 0,
    cooldownMinutes: lastB && lastB !== first && lastB.tipo === 'tiempo' ? (lastB.minutos ?? 0) : 0,
  }
}

/**
 * Guarda y publica: cada día se escribe entero (con los mismos ids, así el historial sigue apuntando
 * a los mismos bloques), se borran los días quitados y sube la `version`. El socio la toma al abrir la app.
 */
export async function saveAndPublish(socioId: string, rutina: ERutina, saved: ERutina | null, version: number): Promise<number> {
  const { dias, bloques } = toRows(rutina)
  const batch = writeBatch(db)
  for (const d of dias) {
    const own = bloques.filter((b) => b.dia_id === d.id).map(({ dia_id: _dia, ...b }) => {
      void _dia
      return b
    })
    batch.set(doc(days(socioId), d.id), {
      letra: d.letra,
      label: `Día ${d.letra}`,
      order: d.orden,
      bloques: own,
      ...legacyFields(bloques.filter((b) => b.dia_id === d.id)),
      updatedAt: Date.now(),
    })
  }
  const keep = new Set(dias.map((d) => d.id))
  for (const d of saved?.dias ?? []) if (!keep.has(d.id)) batch.delete(doc(days(socioId), d.id))
  // Días que existían en el servidor pero no estaban en lo que se cargó (p. ej. vacíos de la app anterior).
  const server = await getDocs(days(socioId))
  for (const d of server.docs) if (!keep.has(d.id)) batch.delete(d.ref)

  const next = version + 1
  batch.set(doc(db, COL.users, socioId), { rutina: { nombre: rutina.nombre.trim() || 'Rutina', version: next, publicadaAt: Date.now() } }, { merge: true })
  await batch.commit()

  // Biblioteca compartida: cada ejercicio de fuerza queda para la próxima rutina.
  await Promise.all(
    bloques
      .filter((b) => b.tipo === 'fuerza' && b.nombre.trim())
      .map((b) =>
        setDoc(
          doc(db, COL.library, b.ejercicio_id || slugify(b.nombre)),
          { name: b.nombre.trim(), defaultSets: b.series, defaultReps: b.reps, defaultRestSeconds: b.descanso_s, useCount: increment(1), updatedAt: Date.now() },
          { merge: true },
        ).catch(() => {}),
      ),
  )
  return next
}

export interface Ejercicio {
  id: string
  nombre: string
  grupo: string | null
  equipo: string | null
}

export async function loadEjercicios(): Promise<Ejercicio[]> {
  const snap = await getDocs(query(collection(db, COL.library), orderBy('useCount', 'desc'), limit(300)))
  return snap.docs
    .map((d) => ({ id: d.id, nombre: (d.data().name as string) ?? d.id, grupo: null, equipo: null }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export interface UltimaVez {
  completo: boolean
  /** La serie más dura que anotó (esfuerzo 4–5), si hubo. */
  dura: { bloqueId: string | null; serie: number; esfuerzo: number } | null
}

export async function loadUltimaVez(socioId: string, diaId: string): Promise<UltimaVez | null> {
  const snap = await getDocs(query(logs(socioId), orderBy('date', 'desc'), limit(40)))
  const last = snap.docs.map((d) => d.data() as LogDoc).find((d) => d.dayId === diaId && trainedAt(d) !== null)
  if (!last) return null
  if (last.v !== 2) {
    const ex = last.exercises ?? []
    return { completo: ex.every((e) => (e.sets?.length ?? 0) >= ((e as { targetSets?: number }).targetSets ?? 0)), dura: null }
  }
  const hard = (last.series ?? []).filter((s) => (s.esfuerzo ?? 0) >= 4).sort((a, b) => (b.esfuerzo ?? 0) - (a.esfuerzo ?? 0))[0]
  return {
    completo: last.estado === 'completo',
    dura: hard ? { bloqueId: hard.bloqueId, serie: hard.serieN, esfuerzo: hard.esfuerzo ?? 0 } : null,
  }
}

/* ───────── Cuentas de socios (sin servidor propio: se usa una segunda instancia de Firebase) ───────── */

async function withSecondary<T>(fn: (auth: ReturnType<typeof getAuth>) => Promise<T>): Promise<T> {
  const app = initializeApp(firebaseConfig, `secundaria-${Date.now()}`)
  const auth = getAuth(app)
  try {
    return await fn(auth)
  } finally {
    await signOut(auth).catch(() => {})
    await deleteApp(app)
  }
}

export interface AltaDatos {
  nombre: string
  apellido: string
  dni: string
  telefono: string
  profe: string
}

/** Crea la cuenta del socio (usuario = nombre y apellido, contraseña = DNI) sin cerrar la sesión del profe. */
export async function altaSocio(d: AltaDatos): Promise<void> {
  const username = `${d.nombre.trim()} ${d.apellido.trim()}`
  const dni = d.dni.replace(/\D/g, '')
  if (dni.length < 6) throw new Error('El DNI tiene que tener al menos 6 números.')
  await withSecondary(async (auth) => {
    let uid: string
    try {
      uid = (await createUserWithEmailAndPassword(auth, usernameToEmail(username), dni)).user.uid
    } catch (e) {
      if ((e as { code?: string }).code?.includes('email-already-in-use')) throw new Error('Ya hay un socio con ese nombre y apellido.')
      throw new Error('No pudimos crear la cuenta. Probá de nuevo.')
    }
    await setDoc(doc(db, COL.users, uid), {
      role: 'client',
      firstName: d.nombre.trim(),
      lastName: d.apellido.trim(),
      username,
      dni,
      phone: d.telefono.trim(),
      coachName: d.profe.trim(),
      planType: 'weekly',
      weeklyDays: [],
      sessionTime: '18:30',
      feeStatus: 'ok',
      notifPrefs: { restEnd: true, gymReminder: true, feeReminder: false },
      createdAt: Date.now(),
    })
  })
}

export async function updateFicha(socioId: string, patch: { phone: string; coachName: string; feeOk: boolean; feeDueDate: string }) {
  await updateDoc(doc(db, COL.users, socioId), {
    phone: patch.phone.trim(),
    coachName: patch.coachName.trim(),
    feeStatus: patch.feeOk ? 'ok' : 'overdue',
    feeDueDate: patch.feeDueDate.trim(),
  })
}

async function socioDoc(socioId: string): Promise<SocioDoc> {
  const snap = await getDoc(doc(db, COL.users, socioId))
  if (!snap.exists()) throw new Error('No encontramos al socio.')
  return snap.data() as SocioDoc
}

/** Cambia el DNI (la contraseña). Firebase pide la actual para hacerlo sin servidor propio. */
export async function cambiarDni(socioId: string, nuevo: string): Promise<void> {
  const dni = nuevo.replace(/\D/g, '')
  if (dni.length < 6) throw new Error('El DNI tiene que tener al menos 6 números.')
  const s = await socioDoc(socioId)
  await withSecondary(async (auth) => {
    const cred = await signInWithEmailAndPassword(auth, usernameToEmail(s.username || fullName(s)), s.dni ?? '')
    await updatePassword(cred.user, dni)
  })
  await updateDoc(doc(db, COL.users, socioId), { dni })
}

/** Borra todo del socio: rutina, historial, ficha y su cuenta. */
export async function borrarSocio(socioId: string): Promise<void> {
  const s = await socioDoc(socioId)
  const [d, l] = await Promise.all([getDocs(days(socioId)), getDocs(logs(socioId))])
  await Promise.all([...d.docs, ...l.docs].map((x) => deleteDoc(x.ref)))
  await deleteDoc(doc(db, COL.users, socioId))
  await withSecondary(async (auth) => {
    const cred = await signInWithEmailAndPassword(auth, usernameToEmail(s.username || fullName(s)), s.dni ?? '')
    await deleteUser(cred.user)
  }).catch(() => {
    /* si la contraseña no coincide, igual ya no quedan datos */
  })
}
