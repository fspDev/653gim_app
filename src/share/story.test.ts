import { describe, expect, it } from 'vitest'
import { DAY_B } from '../data'
import { createWorkout } from '../workout/reducer'
import { buildStory } from './story'

const finished = () => {
  const start = new Date(2026, 8, 30, 18, 0).getTime() // miércoles 30/09
  const w = createWorkout(DAY_B, start, 'w1')
  const log = (blockId: string, serie: number, reps: number, weight: number) => ({ id: `${blockId}${serie}`, blockId, exerciseId: blockId, serie, targetReps: 8, reps, weight, effort: null, at: start })
  return { ...w, stage: 'done' as const, finishedAt: start + (54 * 60 + 12) * 1000, logs: [log('sentadilla', 1, 8, 42.5), log('sentadilla', 2, 8, 42.5), log('remo', 1, 10, 24)] }
}

describe('historia de Instagram', () => {
  it('arma fecha, día, minutos y kilos con formato es-AR', () => {
    const s = buildStory(finished(), [], 6)
    expect(s).toMatchObject({ weekday: 'MIÉ', date: '30.09', day: 'DÍA B', minutes: 54, kilos: '920', series: 3, streak: 6, streakLabel: '6 SEMANAS DE RACHA' })
  })

  it('récords con el nombre del ejercicio, hasta 3, y título en singular o plural', () => {
    const hit = (exerciseId: string, weight: number) => ({ exerciseId, weight, reps: 8, prev: { weight: weight - 2.5, reps: 8 } })
    const one = buildStory(finished(), [hit('sentadilla', 42.5)], 1)
    expect(one.records).toEqual([{ name: 'Sentadilla con barra', value: '42,5 KG' }])
    expect(one.recordsTitle).toBe('1 RÉCORD NUEVO')
    expect(one.streakLabel).toBe('1 SEMANA DE RACHA')

    const many = buildStory(finished(), [hit('sentadilla', 42.5), hit('remo', 24), hit('press-banca', 37.5), hit('bici', 10)], 0)
    expect(many.records).toHaveLength(3)
    expect(many.recordsTitle).toBe('4 RÉCORDS NUEVOS')
  })
})
