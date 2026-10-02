import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { COL, db } from '../firebase'
import { rutinaFromFirestore, type DayDoc, type ExercisePref } from './firestoreRutina'
import { mapRutina, type Rutina } from './mapRutina'

const KEY = '653:rutina'

function readCache(userId: string): Rutina | null {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as { userId: string; rutina: Rutina | null }) : null
    return parsed?.userId === userId ? parsed.rutina : null
  } catch {
    return null
  }
}

function writeCache(userId: string, rutina: Rutina | null) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId, rutina }))
  } catch {
    /* sin espacio: se vuelve a bajar la próxima vez */
  }
}

export function clearRutinaCache() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nada que limpiar */
  }
}

/** Baja la rutina del socio (días + sus preferencias de peso y descanso). `null` = no tiene días; lanza si falla la lectura. */
export async function fetchRutina(userId: string): Promise<Rutina | null> {
  const [daysSnap, userSnap] = await Promise.all([getDocs(collection(db, COL.plans, userId, 'days')), getDoc(doc(db, COL.users, userId))])
  const days = daysSnap.docs.map((d) => ({ ...(d.data() as Omit<DayDoc, 'id'>), id: d.id }))
  const user = userSnap.data() as { rutina?: { nombre?: string; version?: number }; exercisePrefs?: Record<string, ExercisePref> } | undefined
  const rutina = mapRutina(rutinaFromFirestore(days, user?.rutina, user?.exercisePrefs))
  return rutina.days.length ? rutina : null
}

export interface RutinaState {
  rutina: Rutina | null
  /** Todavía no se sabe si hay rutina (primera vez y sin guardada). */
  loading: boolean
}

/**
 * La rutina guardada en el teléfono aparece al instante y funciona sin señal.
 * Al abrir, si hay conexión, se baja la publicada y reemplaza a la guardada.
 */
export function useRutina(userId: string | null): RutinaState {
  const [state, setState] = useState<RutinaState>(() => {
    const cached = userId ? readCache(userId) : null
    return { rutina: cached, loading: !!userId && cached === null }
  })

  // La sesión de Firebase aparece después del primer render: al cambiar de usuario, se arranca de su caché.
  const [forUser, setForUser] = useState(userId)
  if (forUser !== userId) {
    setForUser(userId)
    const cached = userId ? readCache(userId) : null
    setState({ rutina: cached, loading: !!userId && cached === null })
  }

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchRutina(userId)
      .then((rutina) => {
        writeCache(userId, rutina)
        if (!cancelled) setState({ rutina, loading: false })
      })
      .catch(() => {
        // Sin conexión: nos quedamos con lo que hay guardado.
        if (!cancelled) setState((s) => ({ ...s, loading: false }))
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  return state
}
