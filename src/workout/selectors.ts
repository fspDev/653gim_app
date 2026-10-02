import type { SetLog, Workout } from './types'

/** Σ reps × peso, redondeado a kilo entero. */
export const kilosTotal = (logs: SetLog[]) => Math.round(logs.reduce((sum, l) => sum + l.reps * l.weight, 0))

export interface BlockStats {
  series: number
  kilos: number
  ms: number
}

export function blockStats(w: Workout, blockId: string): BlockStats {
  const logs = w.logs.filter((l) => l.blockId === blockId)
  const result = w.results.find((r) => r.blockId === blockId)
  return { series: logs.length, kilos: kilosTotal(logs), ms: result ? result.endedAt - result.startedAt : 0 }
}

/** Fracción 0–1 del bloque en curso, para la barra de segmentos de arriba. */
export function blockProgress(w: Workout): number {
  const block = w.day.blocks[w.index]
  const run = w.run
  if (w.stage !== 'block') return 1
  if (block.kind === 'fuerza' && run.kind === 'fuerza') {
    return (run.serie - 1 + (run.phase === 'descanso' ? 1 : 0)) / block.series
  }
  if (block.kind === 'circuito' && run.kind === 'circuito') {
    return ((run.round - 1) * block.steps.length + run.step) / (block.rounds * block.steps.length)
  }
  return 0
}
