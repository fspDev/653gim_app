import type { EntrenoRow, SerieRow } from './db'
import { localDateKey, slugify } from './keys'

/** Entreno guardado en `gymSessions/{uid}/logs/{id}` por esta app. */
export interface RemoteEntreno extends Omit<EntrenoRow, 'synced'> {
  v: 2
  date: string
  startedAt: number
  series: Omit<SerieRow, 'entrenoId'>[]
  /** Misma forma que los registros de la app anterior, para que su panel y su historial los sigan leyendo. */
  exercises: LegacySessionExercise[]
}

interface LegacySet {
  weight?: number
  reps?: number
  completedAt?: number
}

interface LegacySessionExercise {
  exerciseId: string
  name: string
  group?: string
  kind?: string
  targetSets: number
  reps: number
  sets: LegacySet[]
}

/** Registro de un día de la app anterior (`logs/{AAAA-MM-DD}`). */
export interface LegacySession {
  date?: string
  dayId?: string
  startedAt?: number
  exercises?: LegacySessionExercise[]
}

export function toRemote(e: EntrenoRow, series: SerieRow[]): RemoteEntreno {
  const { synced: _synced, ...rest } = e
  void _synced
  const byBlock = new Map<string, SerieRow[]>()
  for (const s of series) byBlock.set(s.bloqueId, [...(byBlock.get(s.bloqueId) ?? []), s])
  return {
    ...rest,
    v: 2,
    date: localDateKey(e.empezadoAt),
    startedAt: e.empezadoAt,
    series: series.map(({ entrenoId: _id, ...s }) => {
      void _id
      return s
    }),
    exercises: [...byBlock.values()].map((list) => ({
      exerciseId: list[0].bloqueId,
      name: list[0].ejercicio,
      group: 'fuerza',
      targetSets: Math.max(...list.map((s) => s.serieN)),
      reps: list[0].targetReps,
      sets: list.map((s) => ({ weight: s.pesoKg, reps: s.reps, completedAt: s.hechaAt })),
    })),
  }
}

/** Un día de la app anterior → filas locales. `null` si ese día no se hizo ninguna serie. */
export function fromLegacy(docId: string, s: LegacySession): { entreno: EntrenoRow; series: SerieRow[] } | null {
  const id = `legacy-${docId}`
  const lifts = (s.exercises ?? []).filter((ex) => ex.kind !== 'timed' && ex.sets?.length)
  const series: SerieRow[] = lifts.flatMap((ex) =>
    ex.sets.map((st, i) => ({
      id: `${id}-${ex.exerciseId}-${i + 1}`,
      entrenoId: id,
      bloqueId: ex.exerciseId,
      exerciseId: slugify(ex.name),
      ejercicio: ex.name,
      serieN: i + 1,
      targetReps: ex.reps ?? 0,
      reps: st.reps ?? ex.reps ?? 0,
      pesoKg: st.weight ?? 0,
      esfuerzo: null,
      hechaAt: st.completedAt ?? s.startedAt ?? 0,
    })),
  )
  if (series.length === 0) return null
  const times = series.map((r) => r.hechaAt).filter(Boolean)
  const all = s.exercises ?? []
  const done = all.filter((ex) => (ex.sets?.length ?? 0) >= ex.targetSets).length
  const start = s.startedAt ?? Math.min(...times)
  return {
    entreno: {
      id,
      dayId: s.dayId ?? '',
      dayLetter: '',
      dayName: 'Entreno',
      empezadoAt: start,
      terminadoAt: Math.max(start, ...times),
      estado: done === all.length ? 'completo' : 'parcial',
      sensacion: null,
      kilosTotal: series.reduce((k, r) => k + r.pesoKg * r.reps, 0),
      bloquesHechos: done,
      bloquesTotal: all.length,
      synced: 1,
    },
    series,
  }
}

export function fromRemote(r: RemoteEntreno): { entreno: EntrenoRow; series: SerieRow[] } {
  const { v: _v, date: _d, startedAt: _s, series, exercises: _e, ...rest } = r
  void _v
  void _d
  void _s
  void _e
  return { entreno: { ...rest, synced: 1 }, series: series.map((s) => ({ ...s, entrenoId: r.id })) }
}
