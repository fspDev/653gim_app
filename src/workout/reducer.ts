import type { Block, CircuitBlock, Day, StrengthBlock, TimeBlock } from '../data'
import { uuid } from '../uuid'
import type { BlockRun, CircuitRun, SetLog, StrengthRun, TimeRun, Workout } from './types'

export const BETWEEN_SECONDS = 5
export const DEFAULT_REST_SECONDS = 90
export const WEIGHT_STEP = 2.5

export type WorkoutAction =
  | { type: 'TICK'; now: number }
  // fuerza
  | { type: 'DONE'; now: number }
  | { type: 'FINISH_REST'; now: number }
  | { type: 'UNDO' }
  | { type: 'ADJUST_REST'; deltaSeconds: number; now: number }
  | { type: 'WEIGHT'; delta: number }
  | { type: 'APPLY_SUGGESTION' }
  | { type: 'CLEAR_FRESH' }
  | { type: 'LOG_SET'; serie: number; reps: number; effort: number | null }
  // tiempo
  | { type: 'TIME_TOGGLE'; now: number }
  | { type: 'TIME_ADD'; deltaSeconds: number; now: number }
  // circuito
  | { type: 'CIRCUIT_NEXT'; now: number }
  | { type: 'CIRCUIT_PREV'; now: number }
  | { type: 'CIRCUIT_TOGGLE'; now: number }
  // entre bloques
  | { type: 'BETWEEN_START'; now: number }
  | { type: 'BETWEEN_TOGGLE'; now: number }
  // cierre
  | { type: 'SET_FEELING'; value: number }
  | { type: 'EXIT_SAVE'; now: number }

const round1 = (n: number) => Math.round(n * 10) / 10

/** Segundos que faltan hasta `end`, redondeados para arriba (1:30 → 1:29 → … → 0:01). */
export const secondsLeft = (end: number, now: number) => Math.max(0, Math.ceil((end - now) / 1000))

export const currentBlock = (w: Workout): Block => w.day.blocks[w.index]

function circuitStepRun(block: CircuitBlock, round: number, step: number, now: number): CircuitRun {
  const seconds = block.steps[step].seconds
  return { kind: 'circuito', round, step, stepEnd: seconds ? now + seconds * 1000 : null, pausedLeft: null }
}

export function initRun(block: Block, now: number): BlockRun {
  switch (block.kind) {
    case 'fuerza':
      return { kind: 'fuerza', phase: 'serie', serie: 1, weight: block.weight, restEnd: 0, restTotal: block.restSeconds ?? DEFAULT_REST_SECONDS, fresh: false, suggestionUsed: false }
    case 'tiempo':
      return { kind: 'tiempo', total: block.minutes * 60, endAt: now + block.minutes * 60_000, pausedLeft: null }
    case 'circuito':
      return circuitStepRun(block, 1, 0, now)
  }
}

/** `defaultRest`: descanso del Perfil para los bloques de fuerza que no traen uno propio. */
export function createWorkout(day: Day, now: number, id: string = uuid(), defaultRest = DEFAULT_REST_SECONDS): Workout {
  const blocks = day.blocks.map((b) => (b.kind === 'fuerza' ? { ...b, restSeconds: b.restSeconds ?? defaultRest } : b))
  return {
    id,
    day: { ...day, blocks },
    startedAt: now,
    index: 0,
    stage: 'block',
    run: initRun(day.blocks[0], now),
    blockStartedAt: now,
    results: [],
    logs: [],
    betweenEnd: 0,
    betweenLeft: null,
    estado: 'completo',
    finishedAt: null,
    feeling: null,
  }
}

/** El bloque en curso terminó: pasa a la cuenta de "Bloque listo", o cierra el entreno si era el último. */
function completeBlock(w: Workout, now: number): Workout {
  const block = currentBlock(w)
  const results = [...w.results, { blockId: block.id, startedAt: w.blockStartedAt, endedAt: now }]
  if (w.index >= w.day.blocks.length - 1) {
    return { ...w, results, stage: 'done', estado: 'completo', finishedAt: now }
  }
  return { ...w, results, stage: 'between', betweenEnd: now + BETWEEN_SECONDS * 1000, betweenLeft: null }
}

function startNextBlock(w: Workout, now: number): Workout {
  if (w.stage !== 'between') return w
  const index = w.index + 1
  return { ...w, index, stage: 'block', run: initRun(w.day.blocks[index], now), blockStartedAt: now, betweenLeft: null }
}

function finishRest(w: Workout, now: number): Workout {
  const block = currentBlock(w) as StrengthBlock
  const run = w.run as StrengthRun
  if (w.stage !== 'block' || run.phase !== 'descanso') return w
  if (run.serie >= block.series) return completeBlock(w, now)
  return { ...w, run: { ...run, phase: 'serie', serie: run.serie + 1, fresh: false } }
}

function advanceCircuit(w: Workout, now: number): Workout {
  const block = currentBlock(w) as CircuitBlock
  const run = w.run as CircuitRun
  if (run.step + 1 < block.steps.length) return { ...w, run: circuitStepRun(block, run.round, run.step + 1, now) }
  if (run.round < block.rounds) return { ...w, run: circuitStepRun(block, run.round + 1, 0, now) }
  return completeBlock(w, now)
}

function retreatCircuit(w: Workout, now: number): Workout {
  const block = currentBlock(w) as CircuitBlock
  const run = w.run as CircuitRun
  if (run.step > 0) return { ...w, run: circuitStepRun(block, run.round, run.step - 1, now) }
  if (run.round > 1) return { ...w, run: circuitStepRun(block, run.round - 1, block.steps.length - 1, now) }
  return { ...w, run: circuitStepRun(block, 1, 0, now) }
}

/** Misma lógica de pausa para el bloque por tiempo y para los pasos por tiempo del circuito. */
function toggle(endAt: number | null, pausedLeft: number | null, now: number) {
  if (pausedLeft !== null) return { endAt: now + pausedLeft, pausedLeft: null }
  if (endAt !== null) return { endAt, pausedLeft: Math.max(0, endAt - now) }
  return { endAt, pausedLeft }
}

export function workoutReducer(w: Workout, action: WorkoutAction): Workout {
  if (w.stage === 'done') {
    return action.type === 'SET_FEELING' ? { ...w, feeling: action.value } : w
  }

  if (w.stage === 'between') {
    switch (action.type) {
      case 'TICK':
        return w.betweenLeft === null && action.now >= w.betweenEnd ? startNextBlock(w, action.now) : w
      case 'BETWEEN_START':
        return startNextBlock(w, action.now)
      case 'BETWEEN_TOGGLE': {
        if (w.betweenLeft !== null) return { ...w, betweenEnd: action.now + w.betweenLeft, betweenLeft: null }
        return { ...w, betweenLeft: Math.max(0, w.betweenEnd - action.now) }
      }
      case 'EXIT_SAVE':
        return { ...w, stage: 'done', estado: 'parcial', finishedAt: action.now }
      default:
        return w
    }
  }

  // stage === 'block'
  if (action.type === 'EXIT_SAVE') return { ...w, stage: 'done', estado: 'parcial', finishedAt: action.now }

  const block = currentBlock(w)
  const run = w.run

  if (block.kind === 'fuerza' && run.kind === 'fuerza') {
    switch (action.type) {
      case 'TICK':
        return run.phase === 'descanso' && action.now >= run.restEnd ? finishRest(w, action.now) : w

      case 'DONE': {
        if (run.phase !== 'serie') return w
        const rest = block.restSeconds ?? DEFAULT_REST_SECONDS
        // Se anota con los valores objetivo; "Anotar serie" los corrige después.
        const log: SetLog = {
          id: uuid(),
          blockId: block.id,
          exerciseId: block.exerciseId ?? block.id,
          serie: run.serie,
          targetReps: block.reps,
          reps: block.reps,
          weight: run.weight,
          effort: null,
          at: action.now,
        }
        return {
          ...w,
          logs: [...w.logs, log],
          run: { ...run, phase: 'descanso', restEnd: action.now + rest * 1000, restTotal: rest, fresh: true },
        }
      }

      case 'FINISH_REST':
        return finishRest(w, action.now)

      // Sin diálogo al tocar HECHA: se corrige desde el descanso.
      case 'UNDO':
        if (run.phase !== 'descanso') return w
        return {
          ...w,
          logs: w.logs.filter((l) => !(l.blockId === block.id && l.serie === run.serie)),
          run: { ...run, phase: 'serie', fresh: false },
        }

      case 'ADJUST_REST': {
        if (run.phase !== 'descanso') return w
        const restEnd = run.restEnd + action.deltaSeconds * 1000
        const left = secondsLeft(restEnd, action.now)
        if (restEnd - action.now <= 0) return finishRest(w, action.now)
        return { ...w, run: { ...run, restEnd, restTotal: Math.max(run.restTotal, left) } }
      }

      case 'WEIGHT':
        return { ...w, run: { ...run, weight: Math.max(0, round1(run.weight + action.delta)) } }

      case 'APPLY_SUGGESTION':
        if (run.suggestionUsed || !block.suggestion) return w
        return { ...w, run: { ...run, weight: round1(run.weight + block.suggestion), suggestionUsed: true } }

      case 'CLEAR_FRESH':
        return run.fresh ? { ...w, run: { ...run, fresh: false } } : w

      case 'LOG_SET':
        return {
          ...w,
          logs: w.logs.map((l) =>
            l.blockId === block.id && l.serie === action.serie ? { ...l, reps: Math.max(0, action.reps), effort: action.effort } : l,
          ),
        }

      default:
        return w
    }
  }

  if (block.kind === 'tiempo' && run.kind === 'tiempo') {
    return reduceTime(w, block, run, action)
  }

  if (block.kind === 'circuito' && run.kind === 'circuito') {
    switch (action.type) {
      case 'TICK':
        return run.stepEnd !== null && run.pausedLeft === null && action.now >= run.stepEnd ? advanceCircuit(w, action.now) : w
      case 'CIRCUIT_NEXT':
        return advanceCircuit(w, action.now)
      case 'CIRCUIT_PREV':
        return retreatCircuit(w, action.now)
      case 'CIRCUIT_TOGGLE': {
        if (run.stepEnd === null) return w
        return { ...w, run: { ...run, ...toggle(run.stepEnd, run.pausedLeft, action.now) } }
      }
      default:
        return w
    }
  }

  return w
}

function reduceTime(w: Workout, _block: TimeBlock, run: TimeRun, action: WorkoutAction): Workout {
  switch (action.type) {
    case 'TICK':
      return run.pausedLeft === null && action.now >= run.endAt ? completeBlock(w, action.now) : w
    case 'TIME_TOGGLE':
      return { ...w, run: { ...run, ...toggle(run.endAt, run.pausedLeft, action.now) } as TimeRun }
    case 'TIME_ADD': {
      const delta = action.deltaSeconds * 1000
      const paused = run.pausedLeft !== null
      const leftMs = paused ? run.pausedLeft! + delta : run.endAt + delta - action.now
      if (leftMs <= 0) return completeBlock(w, action.now)
      const total = Math.max(run.total, Math.ceil(leftMs / 1000))
      return { ...w, run: paused ? { ...run, total, pausedLeft: leftMs } : { ...run, total, endAt: run.endAt + delta } }
    }
    default:
      return w
  }
}
