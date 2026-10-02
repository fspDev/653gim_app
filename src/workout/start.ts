import { exerciseKey, type Day } from '../data'
import { db } from '../db'
import { getSettings } from '../settings'
import { saveActive } from './persist'
import { createWorkout } from './reducer'
import { suggestionFor } from './suggest'
import type { Workout } from './types'

/** El peso de la última serie que hizo de ese ejercicio: arranca desde ahí, como la vez anterior. */
function lastWeightOf(rows: { exerciseId: string; hechaAt: number; pesoKg: number }[], key: string): number | null {
  let best: { at: number; kg: number } | null = null
  for (const r of rows) if (r.exerciseId === key && (!best || r.hechaAt > best.at)) best = { at: r.hechaAt, kg: r.pesoKg }
  return best?.kg ?? null
}

/** Arma el entreno de hoy: sugerencias de peso según el historial, descanso por defecto del Perfil. Lo deja guardado como "en curso". */
export async function startWorkout(day: Day): Promise<Workout> {
  const rows = await db.series.toArray()
  const past = rows.map((r) => ({ exerciseId: r.exerciseId, entrenoId: r.entrenoId, serie: r.serieN, reps: r.reps, targetReps: r.targetReps, at: r.hechaAt }))
  const suggested: Day = {
    ...day,
    blocks: day.blocks.map((b) => {
      if (b.kind !== 'fuerza') return b
      const key = exerciseKey(b)
      return { ...b, weight: lastWeightOf(rows, key) ?? b.weight, suggestion: suggestionFor(past, key, b.series) || undefined }
    }),
  }
  const w = createWorkout(suggested, Date.now(), undefined, getSettings().restSeconds)
  saveActive(w)
  return w
}
