import { useEffect, useState } from 'react'
import { store } from '../backend'
import { COL } from '../firebase'
import { rutinaFromDocs, type DayDoc, type ExercisePref, type RutinaMeta } from './firestoreRutina'
import { mapRutina, type Rutina } from './mapRutina'

const KEY = 'g653:rutina'

function readCache(sid: string): Rutina | null {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as { sid: string; rutina: Rutina | null }) : null
    return parsed?.sid === sid ? parsed.rutina : null
  } catch {
    return null
  }
}

function writeCache(sid: string, rutina: Rutina | null) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ sid, rutina }))
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

/** Baja el plan del estudiante (días + el último peso que usó en cada ejercicio). `null` = no tiene días. */
export async function fetchRutina(sid: string): Promise<Rutina | null> {
  const [days, student] = await Promise.all([store.list(`${COL.students}/${sid}/days`), store.get(`${COL.students}/${sid}`)])
  const s = student as { rutina?: RutinaMeta; exercisePrefs?: Record<string, ExercisePref> } | null
  const rutina = mapRutina(rutinaFromDocs(days.map((d) => ({ ...(d.data as Omit<DayDoc, 'id'>), id: d.id })), s?.rutina, s?.exercisePrefs))
  return rutina.days.length ? rutina : null
}

export interface RutinaState {
  rutina: Rutina | null
  /** Todavía no se sabe si hay plan (primera vez y sin guardado). */
  loading: boolean
}

/**
 * El plan guardado en el teléfono aparece al instante y funciona sin señal.
 * Al abrir, si hay conexión, se baja el publicado y reemplaza al guardado.
 */
export function useRutina(sid: string | null): RutinaState {
  const [state, setState] = useState<RutinaState>(() => {
    const cached = sid ? readCache(sid) : null
    return { rutina: cached, loading: !!sid && cached === null }
  })

  // La sesión aparece después del primer render: al cambiar de estudiante, se arranca de su caché.
  const [forSid, setForSid] = useState(sid)
  if (forSid !== sid) {
    setForSid(sid)
    const cached = sid ? readCache(sid) : null
    setState({ rutina: cached, loading: !!sid && cached === null })
  }

  useEffect(() => {
    if (!sid) return
    let cancelled = false
    fetchRutina(sid)
      .then((rutina) => {
        writeCache(sid, rutina)
        if (!cancelled) setState({ rutina, loading: false })
      })
      .catch(() => {
        // Sin conexión: nos quedamos con lo guardado.
        if (!cancelled) setState((s) => ({ ...s, loading: false }))
      })
    return () => {
      cancelled = true
    }
  }, [sid])

  return state
}
