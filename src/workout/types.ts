import type { Day } from '../data'

export interface SetLog {
  id: string
  blockId: string
  /** Hasta la fase 3 es el slug del bloque. */
  exerciseId: string
  serie: number
  targetReps: number
  reps: number
  weight: number
  /** 1 (Fácil) – 5 (Al límite); null si no se anotó. */
  effort: number | null
  at: number
}

export interface BlockResult {
  blockId: string
  startedAt: number
  endedAt: number
}

export interface StrengthRun {
  kind: 'fuerza'
  /** serie → descanso → serie. */
  phase: 'serie' | 'descanso'
  /** 1-based. */
  serie: number
  weight: number
  /** Instante (ms epoch) en que termina el descanso. */
  restEnd: number
  /** Duración de referencia del anillo, en segundos. */
  restTotal: number
  /** Los primeros ms del descanso: el disco lima todavía se está ahuecando. */
  fresh: boolean
  suggestionUsed: boolean
}

export interface TimeRun {
  kind: 'tiempo'
  /** Duración de referencia de la barra, en segundos. */
  total: number
  endAt: number
  /** ms que quedaban al pausar; null si corre. */
  pausedLeft: number | null
}

export interface CircuitRun {
  kind: 'circuito'
  /** 1-based. */
  round: number
  /** 0-based. */
  step: number
  /** Fin del paso por tiempo; null si el paso es por reps. */
  stepEnd: number | null
  pausedLeft: number | null
}

export type BlockRun = StrengthRun | TimeRun | CircuitRun

export type Stage = 'block' | 'between' | 'done'

export interface Workout {
  id: string
  /** Copia del día al empezar: el entreno sigue igual aunque cambie la rutina. */
  day: Day
  startedAt: number
  index: number
  stage: Stage
  run: BlockRun
  blockStartedAt: number
  results: BlockResult[]
  logs: SetLog[]
  /** Cuenta de "Bloque listo". */
  betweenEnd: number
  betweenLeft: number | null
  estado: 'completo' | 'parcial'
  finishedAt: number | null
  /** 1 (Con energía) – 5 (Fundido). */
  feeling: number | null
}
