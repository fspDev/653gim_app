export const SUGGESTION_KG = 2.5

export interface PastSerie {
  exerciseId: string
  entrenoId: string
  serie: number
  reps: number
  targetReps: number
  at: number
}

/**
 * Regla del PLAN.md: +2,5 kg si en el entreno anterior de ese ejercicio se completaron
 * todas las series con las reps objetivo. Devuelve el salto (0 si no corresponde).
 */
export function suggestionFor(past: PastSerie[], exerciseId: string, seriesPlanned: number): number {
  const rows = past.filter((p) => p.exerciseId === exerciseId)
  if (rows.length === 0) return 0

  const lastAt = new Map<string, number>()
  for (const r of rows) lastAt.set(r.entrenoId, Math.max(lastAt.get(r.entrenoId) ?? 0, r.at))
  const [lastId] = [...lastAt.entries()].sort((a, b) => b[1] - a[1])[0]

  const last = rows.filter((r) => r.entrenoId === lastId)
  const done = new Set(last.filter((r) => r.reps >= r.targetReps).map((r) => r.serie))
  for (let s = 1; s <= seriesPlanned; s++) if (!done.has(s)) return 0
  return SUGGESTION_KG
}
