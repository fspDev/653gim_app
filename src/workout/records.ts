import type { SetLog } from './types'

export interface PastSet {
  exerciseId: string
  weight: number
  reps: number
}

export interface RecordHit {
  exerciseId: string
  weight: number
  reps: number
  prev: { weight: number; reps: number }
}

/** a gana a b si levanta más peso, o el mismo peso con más reps. */
const beats = (a: { weight: number; reps: number }, b: { weight: number; reps: number }) =>
  a.weight > b.weight || (a.weight === b.weight && a.reps > b.reps)

export function bestOf<T extends { weight: number; reps: number }>(sets: T[]): T | undefined {
  return sets.reduce<T | undefined>((best, s) => (!best || beats(s, best) ? s : best), undefined)
}

/**
 * Récords que rompió este entreno respecto del historial.
 * Sin historial previo de un ejercicio no hay "antes", así que no cuenta como récord.
 */
export function findRecords(history: PastSet[], logs: SetLog[]): RecordHit[] {
  const hits: RecordHit[] = []
  for (const exerciseId of new Set(logs.map((l) => l.exerciseId))) {
    const now = bestOf(logs.filter((l) => l.exerciseId === exerciseId && l.reps > 0))
    const prev = bestOf(history.filter((h) => h.exerciseId === exerciseId && h.reps > 0))
    if (now && prev && beats(now, prev)) {
      hits.push({ exerciseId, weight: now.weight, reps: now.reps, prev: { weight: prev.weight, reps: prev.reps } })
    }
  }
  return hits
}
