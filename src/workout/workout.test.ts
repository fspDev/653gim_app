import { describe, expect, it } from 'vitest'
import { DAY_B } from '../data'
import type { CircuitRun, StrengthRun, TimeRun, Workout } from './types'
import { findRecords } from './records'
import { BETWEEN_SECONDS, createWorkout, workoutReducer as reduce, type WorkoutAction } from './reducer'
import { blockProgress, kilosTotal } from './selectors'
import { suggestionFor, type PastSerie } from './suggest'

const T0 = 1_000_000
const run = (w: Workout, ...actions: WorkoutAction[]) => actions.reduce(reduce, w)
const at = (ms: number) => T0 + ms

/** Entreno parado al inicio del bloque `index`. */
function atBlock(index: number): Workout {
  let w = createWorkout(DAY_B, T0, 'w1')
  for (let i = 0; i < index; i++) {
    w = { ...w, stage: 'between', betweenEnd: T0 }
    w = reduce(w, { type: 'BETWEEN_START', now: T0 })
  }
  return w
}

describe('bloque por tiempo (bici)', () => {
  it('termina solo al llegar a la hora y pasa a "bloque listo"', () => {
    const w = run(createWorkout(DAY_B, T0), { type: 'TICK', now: at(8 * 60_000) })
    expect(w.stage).toBe('between')
    expect(w.results).toHaveLength(1)
    expect(w.betweenEnd).toBe(at(8 * 60_000) + BETWEEN_SECONDS * 1000)
  })

  it('no termina antes', () => {
    const w0 = createWorkout(DAY_B, T0)
    expect(reduce(w0, { type: 'TICK', now: at(8 * 60_000 - 1) })).toBe(w0)
  })

  it('pausa congela el tiempo y al reanudar sigue desde donde quedó', () => {
    let w = run(createWorkout(DAY_B, T0), { type: 'TIME_TOGGLE', now: at(60_000) })
    expect((w.run as TimeRun).pausedLeft).toBe(7 * 60_000)
    w = run(w, { type: 'TICK', now: at(60 * 60_000) })
    expect(w.stage).toBe('block')
    w = run(w, { type: 'TIME_TOGGLE', now: at(10 * 60_000) })
    expect((w.run as TimeRun).endAt).toBe(at(10 * 60_000) + 7 * 60_000)
  })

  it('±1 min corre el fin y −1 min por debajo de cero lo cierra', () => {
    let w = run(createWorkout(DAY_B, T0), { type: 'TIME_ADD', deltaSeconds: 60, now: T0 })
    expect((w.run as TimeRun).endAt).toBe(at(9 * 60_000))
    expect((w.run as TimeRun).total).toBe(9 * 60)
    w = run(w, { type: 'TIME_ADD', deltaSeconds: -60, now: at(8 * 60_000 + 30_000) })
    expect(w.stage).toBe('between')
  })
})

describe('bloque de fuerza', () => {
  it('HECHA anota la serie con el objetivo y arranca el descanso', () => {
    const w = run(atBlock(1), { type: 'DONE', now: at(0) })
    const r = w.run as StrengthRun
    expect(r.phase).toBe('descanso')
    expect(r.restEnd).toBe(at(90_000))
    expect(w.logs).toMatchObject([{ blockId: 'sentadilla', serie: 1, reps: 8, targetReps: 8, weight: 42.5, effort: null }])
  })

  it('el descanso termina solo y avanza la serie', () => {
    const w = run(atBlock(1), { type: 'DONE', now: at(0) }, { type: 'TICK', now: at(90_000) })
    expect(w.run).toMatchObject({ phase: 'serie', serie: 2 })
  })

  it('deshacer saca la serie anotada', () => {
    const w = run(atBlock(1), { type: 'DONE', now: at(0) }, { type: 'UNDO' })
    expect(w.logs).toHaveLength(0)
    expect(w.run).toMatchObject({ phase: 'serie', serie: 1 })
  })

  it('±15 s mueve el fin y estira el anillo; restar de más corta el descanso', () => {
    let w = run(atBlock(1), { type: 'DONE', now: at(0) }, { type: 'ADJUST_REST', deltaSeconds: 15, now: at(0) })
    expect((w.run as StrengthRun).restTotal).toBe(105)
    w = run(w, { type: 'ADJUST_REST', deltaSeconds: -15, now: at(100_000) })
    expect(w.run).toMatchObject({ phase: 'serie', serie: 2 })
  })

  it('anotar la serie corrige las reps sin tocar las demás', () => {
    let w = run(atBlock(1), { type: 'DONE', now: at(0) }, { type: 'TICK', now: at(90_000) }, { type: 'DONE', now: at(95_000) })
    w = run(w, { type: 'LOG_SET', serie: 1, reps: 7 })
    expect(w.logs.map((l) => [l.serie, l.reps])).toEqual([
      [1, 7],
      [2, 8],
    ])
  })

  it('el peso y la sugerencia (+2,5, una sola vez) cambian lo que se anota', () => {
    const day = { ...DAY_B, blocks: DAY_B.blocks.map((b) => (b.id === 'sentadilla' ? { ...b, suggestion: 2.5 } : b)) }
    let w = createWorkout(day, T0)
    w = { ...w, stage: 'between', betweenEnd: T0 }
    w = run(w, { type: 'BETWEEN_START', now: T0 }, { type: 'APPLY_SUGGESTION' }, { type: 'APPLY_SUGGESTION' }, { type: 'WEIGHT', delta: -2.5 }, { type: 'DONE', now: T0 })
    expect(w.logs[0].weight).toBe(42.5)
  })

  it('la última serie descansa y después cierra el bloque', () => {
    let w = atBlock(1)
    for (let s = 1; s <= 4; s++) w = run(w, { type: 'DONE', now: at(s * 100_000) }, { type: 'TICK', now: at(s * 100_000 + 90_000) })
    expect(w.stage).toBe('between')
    expect(w.logs).toHaveLength(4)
    expect(kilosTotal(w.logs)).toBe(4 * 8 * 42.5)
  })

  it('progreso del bloque: cuenta la serie en descanso como hecha', () => {
    const w = run(atBlock(1), { type: 'DONE', now: at(0) })
    expect(blockProgress(w)).toBe(0.25)
  })
})

describe('circuito (plancha + core)', () => {
  const core = () => atBlock(6)

  it('los pasos por tiempo avanzan solos; el de reps espera', () => {
    let w = core()
    expect((w.run as CircuitRun).stepEnd).toBe(T0 + 45_000)
    w = run(w, { type: 'TICK', now: at(45_000) }, { type: 'TICK', now: at(75_000) }, { type: 'TICK', now: at(105_000) })
    expect(w.run).toMatchObject({ round: 1, step: 3, stepEnd: null })
    expect(run(w, { type: 'TICK', now: at(10 * 60_000) })).toBe(w)
  })

  it('siguiente en el último paso abre la ronda siguiente; en la última ronda cierra el bloque', () => {
    let w: Workout = { ...core(), run: { kind: 'circuito', round: 1, step: 3, stepEnd: null, pausedLeft: null } }
    w = run(w, { type: 'CIRCUIT_NEXT', now: T0 })
    expect(w.run).toMatchObject({ round: 2, step: 0 })
    w = { ...w, run: { kind: 'circuito', round: 3, step: 3, stepEnd: null, pausedLeft: null } }
    expect(run(w, { type: 'CIRCUIT_NEXT', now: T0 }).stage).toBe('between')
  })

  it('anterior vuelve un paso, o a la ronda previa, o reinicia el primero', () => {
    let w = run(core(), { type: 'CIRCUIT_NEXT', now: T0 }, { type: 'CIRCUIT_PREV', now: at(5000) })
    expect(w.run).toMatchObject({ round: 1, step: 0, stepEnd: at(5000) + 45_000 })
    w = { ...w, run: { kind: 'circuito', round: 2, step: 0, stepEnd: T0, pausedLeft: null } }
    expect(run(w, { type: 'CIRCUIT_PREV', now: T0 }).run).toMatchObject({ round: 1, step: 3 })
  })

  it('pausa solo aplica a pasos por tiempo', () => {
    const reps = { ...core(), run: { kind: 'circuito', round: 1, step: 3, stepEnd: null, pausedLeft: null } as CircuitRun }
    expect(run(reps, { type: 'CIRCUIT_TOGGLE', now: T0 })).toBe(reps)
    const paused = run(core(), { type: 'CIRCUIT_TOGGLE', now: at(10_000) })
    expect((paused.run as CircuitRun).pausedLeft).toBe(35_000)
    expect(run(paused, { type: 'TICK', now: at(999_999) })).toBe(paused)
  })
})

describe('entre bloques y cierre', () => {
  it('la cuenta arranca sola, se puede frenar con ESPERÁ y saltear con EMPEZAR YA', () => {
    const between = run(createWorkout(DAY_B, T0), { type: 'TICK', now: at(8 * 60_000) })
    const end = between.betweenEnd
    expect(run(between, { type: 'TICK', now: end }).stage).toBe('block')

    const paused = run(between, { type: 'BETWEEN_TOGGLE', now: end - 3000 })
    expect(paused.betweenLeft).toBe(3000)
    expect(run(paused, { type: 'TICK', now: end + 60_000 }).stage).toBe('between')
    expect(run(paused, { type: 'BETWEEN_TOGGLE', now: end + 60_000 }).betweenEnd).toBe(end + 63_000)

    expect(run(between, { type: 'BETWEEN_START', now: end - 4000 }).index).toBe(1)
  })

  it('el último bloque cierra el entreno como completo', () => {
    const w = run(atBlock(7), { type: 'TICK', now: at(5 * 60_000) })
    expect(w).toMatchObject({ stage: 'done', estado: 'completo', finishedAt: at(5 * 60_000) })
    expect(w.results).toHaveLength(1)
  })

  it('guardar y terminar a mitad de entreno lo deja parcial; después solo acepta la sensación', () => {
    let w = run(atBlock(2), { type: 'EXIT_SAVE', now: at(1000) })
    expect(w).toMatchObject({ stage: 'done', estado: 'parcial' })
    w = run(w, { type: 'DONE', now: at(2000) }, { type: 'SET_FEELING', value: 2 })
    expect(w.feeling).toBe(2)
    expect(w.logs).toHaveLength(0)
  })
})

describe('récords', () => {
  const set = (exerciseId: string, weight: number, reps: number) => ({ exerciseId, weight, reps })
  const log = (exerciseId: string, weight: number, reps: number) => ({ exerciseId, weight, reps }) as never

  it('más peso, o mismo peso con más reps', () => {
    const hist = [set('sent', 40, 8), set('sent', 40, 6), set('remo', 22, 10)]
    const hits = findRecords(hist, [log('sent', 42.5, 8), log('remo', 22, 11)])
    expect(hits.map((h) => [h.exerciseId, h.weight, h.reps, h.prev])).toEqual([
      ['sent', 42.5, 8, { weight: 40, reps: 8 }],
      ['remo', 22, 11, { weight: 22, reps: 10 }],
    ])
  })

  it('sin historial o sin mejora no hay récord', () => {
    expect(findRecords([], [log('sent', 42.5, 8)])).toEqual([])
    expect(findRecords([set('sent', 45, 8)], [log('sent', 42.5, 8)])).toEqual([])
    expect(findRecords([set('sent', 40, 8)], [log('sent', 80, 0)])).toEqual([])
  })
})

describe('sugerencia de peso', () => {
  const s = (entrenoId: string, serie: number, reps: number, at: number, exerciseId = 'sent'): PastSerie => ({ exerciseId, entrenoId, serie, reps, targetReps: 8, at })
  const full = (id: string, at: number, reps = 8) => [1, 2, 3, 4].map((n) => s(id, n, reps, at + n))

  it('+2,5 si el entreno anterior completó todas las series con las reps', () => {
    expect(suggestionFor(full('a', 100), 'sent', 4)).toBe(2.5)
  })

  it('nada si faltó una serie, una rep, o no hay historial', () => {
    expect(suggestionFor(full('a', 100).slice(0, 3), 'sent', 4)).toBe(0)
    expect(suggestionFor([...full('a', 100).slice(0, 3), s('a', 4, 7, 104)], 'sent', 4)).toBe(0)
    expect(suggestionFor([], 'sent', 4)).toBe(0)
  })

  it('mira solo el último entreno de ese ejercicio', () => {
    const past = [...full('viejo', 100), ...full('nuevo', 200, 6), ...full('otro', 300).map((r) => ({ ...r, exerciseId: 'remo' }))]
    expect(suggestionFor(past, 'sent', 4)).toBe(0)
  })
})

describe('orden libre de bloques', () => {
  it('elegir uno pendiente lo pone a continuación y lo arranca', () => {
    // Bici lista → "bloque listo"; se elige el circuito de core en vez de la sentadilla.
    let w = run(createWorkout(DAY_B, T0, 'w1'), { type: 'TICK', now: at(8 * 60_000) })
    w = reduce(w, { type: 'PICK_BLOCK', blockId: 'plancha', now: at(8 * 60_000) })
    expect(w.stage).toBe('block')
    expect(w.day.blocks[w.index].id).toBe('plancha')
    expect(w.day.blocks).toHaveLength(DAY_B.blocks.length)
    // El resto conserva su orden y sentadilla pasa a ser la que sigue.
    expect(w.day.blocks[w.index + 1].id).toBe('sentadilla')
  })

  it('se puede elegir de nuevo en la pausa siguiente y el orden queda como se hizo', () => {
    let w = run(createWorkout(DAY_B, T0, 'w1'), { type: 'TICK', now: at(8 * 60_000) })
    w = reduce(w, { type: 'PICK_BLOCK', blockId: 'elongacion', now: at(8 * 60_000) })
    // La elongación (por tiempo, 5 min) termina y se elige el peso muerto.
    w = reduce(w, { type: 'TICK', now: at(13 * 60_000) })
    expect(w.stage).toBe('between')
    w = reduce(w, { type: 'PICK_BLOCK', blockId: 'peso-muerto', now: at(14 * 60_000) })
    expect(w.day.blocks.slice(0, 3).map((b) => b.id)).toEqual(['bici', 'elongacion', 'peso-muerto'])
    expect(w.results.map((r) => r.blockId)).toEqual(['bici', 'elongacion'])
  })

  it('elegir un bloque que ya se hizo no cambia nada', () => {
    const w = run(createWorkout(DAY_B, T0, 'w1'), { type: 'TICK', now: at(8 * 60_000) })
    const same = reduce(w, { type: 'PICK_BLOCK', blockId: 'bici', now: at(8 * 60_000) })
    expect(same.day.blocks.map((b) => b.id)).toEqual(DAY_B.blocks.map((b) => b.id))
  })
})
