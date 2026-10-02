import { prefKey, slugify } from '../keys'
import type { BloqueRow, DiaRow, RutinaRow } from './mapRutina'

/** Ejercicio de un día cargado con la app anterior (grupos core/fuerza). */
export interface LegacyExercise {
  id: string
  name: string
  sets: number
  reps: number
  restSeconds: number
  order?: number
}

/** Documento `gymPlans/{uid}/days/{dayId}`. Los días armados con el panel nuevo traen `bloques`; los viejos, `groups`. */
export interface DayDoc {
  id: string
  label?: string
  order?: number
  letra?: string
  bloques?: BloqueRow[]
  groups?: { core?: LegacyExercise[]; fuerza?: LegacyExercise[] }
  warmupMinutes?: number
  cooldownMinutes?: number
}

export interface ExercisePref {
  weight?: number
  restSeconds?: number
  durationSeconds?: number
}

export const DEFAULT_WARMUP_MIN = 5
export const DEFAULT_COOLDOWN_MIN = 5

const empty = {
  ejercicio_id: null,
  series: null,
  reps: null,
  peso_kg: null,
  descanso_s: null,
  minutos: null,
  rondas: null,
  pasos: null,
} satisfies Partial<BloqueRow>

export const warmupBlock = (dayId: string, minutos: number, orden: number): BloqueRow => ({
  ...empty,
  id: `${dayId}-warmup`,
  orden,
  tipo: 'tiempo',
  nombre: 'Bici fija',
  minutos,
  subtitulo: 'Calentamiento',
  indicacion: 'Ritmo suave · 70–80 rpm',
})

export const cooldownBlock = (dayId: string, minutos: number, orden: number): BloqueRow => ({
  ...empty,
  id: `${dayId}-cooldown`,
  orden,
  tipo: 'tiempo',
  nombre: 'Bici y elongación',
  minutos,
  subtitulo: 'Final',
  indicacion: 'Pedaleo suave y elongá al terminar',
})

/** "Día 1" → "1"; "Día B" → "B"; si no, la posición. */
export function letraOf(d: DayDoc, index: number): string {
  if (d.letra) return d.letra
  const m = /^d[ií]a\s+(\S+)$/i.exec((d.label ?? '').trim())
  return m ? m[1].toUpperCase() : String(index + 1)
}

/** Día viejo → bloques: bici al principio, los ejercicios de core y fuerza, bici + elongación al final. */
export function legacyBloques(d: DayDoc): BloqueRow[] {
  const warm = d.warmupMinutes ?? DEFAULT_WARMUP_MIN
  const cool = d.cooldownMinutes ?? DEFAULT_COOLDOWN_MIN
  const exercises = [...(d.groups?.core ?? []), ...(d.groups?.fuerza ?? [])]
  const out: BloqueRow[] = []
  if (warm > 0) out.push(warmupBlock(d.id, warm, 0))
  for (const ex of exercises) {
    out.push({
      ...empty,
      id: ex.id,
      orden: out.length,
      tipo: 'fuerza',
      ejercicio_id: slugify(ex.name),
      nombre: ex.name,
      series: ex.sets,
      reps: ex.reps,
      descanso_s: ex.restSeconds,
    })
  }
  if (cool > 0) out.push(cooldownBlock(d.id, cool, out.length))
  return out
}

/**
 * Los días guardados en Firestore → la forma que entiende `mapRutina` (y el editor del panel).
 * Las preferencias del socio (último peso y descanso que usó en cada ejercicio) pisan lo cargado por el profe.
 */
export function rutinaFromFirestore(
  days: DayDoc[],
  meta: { nombre?: string; version?: number } | undefined,
  prefs: Record<string, ExercisePref> | undefined,
): RutinaRow {
  const dias: DiaRow[] = [...days]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((d, i) => {
      const bloques = (Array.isArray(d.bloques) ? d.bloques : legacyBloques(d)).map((b, orden): BloqueRow => {
        const pref = b.tipo === 'fuerza' ? prefs?.[prefKey(b.nombre)] : undefined
        if (!pref) return { ...b, orden }
        return {
          ...b,
          orden,
          peso_kg: pref.weight ?? b.peso_kg,
          descanso_s: pref.restSeconds ?? b.descanso_s,
        }
      })
      return { id: d.id, letra: letraOf(d, i), orden: i + 1, bloques }
    })
  return {
    id: 'rutina',
    nombre: meta?.nombre || 'Rutina',
    dias_por_semana: dias.length,
    version: meta?.version ?? 0,
    publicada_at: dias.length ? new Date(0).toISOString() : null,
    dias,
  }
}
