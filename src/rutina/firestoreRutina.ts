import { prefKey } from '../keys'
import type { BloqueRow, DiaRow, RutinaRow } from './mapRutina'
import { toRows, type ERutina } from './editor'

/** Documento `g653Students/{sid}/days/{dayId}`. */
export interface DayDoc {
  id: string
  letra?: string
  order?: number
  bloques?: BloqueRow[]
  updatedAt?: number
}

/** `g653Students/{sid}.rutina`: nombre y cuándo la publicó el profe por última vez. */
export interface RutinaMeta {
  nombre?: string
  version?: number
  publicadaAt?: number
  /** Días del plan (para el listado del panel). */
  dias?: number
}

/** Último peso que usó el estudiante en un ejercicio (`exercisePrefs`). */
export interface ExercisePref {
  weight?: number
  updatedAt?: number
}

/**
 * Los días guardados → la forma que entiende `mapRutina` (y el editor del panel).
 * El último peso que usó el estudiante pisa el del plan, salvo que el profe haya publicado después:
 * si el profe cambia el peso, manda el profe.
 */
export function rutinaFromDocs(days: DayDoc[], meta: RutinaMeta | null | undefined, prefs?: Record<string, ExercisePref>): RutinaRow {
  const publicada = meta?.publicadaAt ?? 0
  const dias: DiaRow[] = [...days]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((d, i) => ({
      id: d.id,
      letra: d.letra || String(i + 1),
      orden: i + 1,
      bloques: (d.bloques ?? []).map((b, orden): BloqueRow => {
        const pref = b.tipo === 'fuerza' ? prefs?.[prefKey(b.nombre)] : undefined
        const usePref = pref?.weight !== undefined && (pref.updatedAt ?? 0) > publicada
        return { ...b, orden, peso_kg: usePref ? pref!.weight! : b.peso_kg }
      }),
    }))
  return {
    id: 'rutina',
    nombre: meta?.nombre || 'Plan',
    dias_por_semana: dias.length,
    version: meta?.version ?? 0,
    publicada_at: publicada ? new Date(publicada).toISOString() : null,
    dias,
  }
}

/** La rutina del editor → un documento por día, listos para guardar. */
export function toDayDocs(r: ERutina, now = Date.now()): DayDoc[] {
  const { dias, bloques } = toRows(r)
  return dias.map((d) => ({
    id: d.id,
    letra: d.letra,
    order: d.orden,
    updatedAt: now,
    bloques: bloques
      .filter((b) => b.dia_id === d.id)
      .map(({ dia_id: _dia, ...b }) => {
        void _dia
        return b
      }),
  }))
}
