import { describe, expect, it } from 'vitest'
import type { SerieRow } from './db'
import { chartPoints, exerciseSeries, monthView, personalRecords, streakWeeks, weekStart } from './stats'

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime()

describe('weekStart', () => {
  it('la semana arranca el lunes', () => {
    // 30/9/2026 es miércoles
    expect(new Date(weekStart(at(2026, 9, 30))).getDate()).toBe(28)
    expect(new Date(weekStart(at(2026, 9, 28))).getDate()).toBe(28)
    // domingo 27/9 pertenece a la semana del lunes 21
    expect(new Date(weekStart(at(2026, 9, 27))).getDate()).toBe(21)
  })
})

describe('racha de semanas', () => {
  const week = (d1: number, ...extra: number[]) => [at(2026, 9, d1), at(2026, 9, d1 + 2), at(2026, 9, d1 + 4), ...extra]

  it('cuenta semanas seguidas con 3 o más entrenos', () => {
    // semanas del 7, 14 y 21 de septiembre; hoy miércoles 30 sin entrenar todavía
    const ts = [...week(7), ...week(14), ...week(21)]
    expect(streakWeeks(ts, at(2026, 9, 30))).toBe(3)
  })

  it('la semana en curso suma cuando llega a 3, y no corta si todavía no', () => {
    const ts = [...week(14), ...week(21)]
    expect(streakWeeks([...ts, at(2026, 9, 28), at(2026, 9, 29), at(2026, 9, 30)], at(2026, 9, 30))).toBe(3)
    expect(streakWeeks([...ts, at(2026, 9, 28)], at(2026, 9, 30))).toBe(2)
  })

  it('una semana con menos de 3 corta la racha', () => {
    const ts = [...week(7), at(2026, 9, 15), at(2026, 9, 17), ...week(21)]
    expect(streakWeeks(ts, at(2026, 9, 30))).toBe(1)
    expect(streakWeeks([], at(2026, 9, 30))).toBe(0)
  })
})

describe('calendario del mes', () => {
  it('septiembre 2026 arranca martes y tiene 30 días', () => {
    const m = monthView([at(2026, 9, 2), at(2026, 9, 2, 18), at(2026, 9, 30), at(2026, 8, 31)], 2026, 8)
    expect(m.blanks).toBe(1)
    expect(m.daysInMonth).toBe(30)
    expect([...m.trained].sort((a, b) => a - b)).toEqual([2, 30])
    expect(m.count).toBe(3)
  })
})

const row = (entrenoId: string, hechaAt: number, pesoKg: number, reps: number, exerciseId = 'sent'): SerieRow => ({
  id: `${entrenoId}-${pesoKg}-${reps}`,
  entrenoId,
  bloqueId: exerciseId,
  exerciseId,
  ejercicio: exerciseId === 'sent' ? 'Sentadilla' : 'Remo',
  serieN: 1,
  targetReps: 8,
  reps,
  pesoKg,
  esfuerzo: null,
  hechaAt,
})

describe('evolución y récords', () => {
  const rows = [row('b', 200, 42.5, 8), row('a', 100, 40, 8), row('a', 101, 37.5, 8), row('c', 300, 45, 0), row('r', 150, 20, 10, 'remo')]

  it('mejor peso por entreno en orden cronológico, sin series de 0 reps', () => {
    expect(exerciseSeries(rows, 'sent')).toEqual([
      { at: 100, weight: 40 },
      { at: 200, weight: 42.5 },
    ])
  })

  it('récord personal por ejercicio', () => {
    expect(personalRecords(rows).map((r) => [r.name, r.weight, r.reps])).toEqual([
      ['Remo', 20, 10],
      ['Sentadilla', 42.5, 8],
    ])
  })

  it('puntos del gráfico: el más pesado arriba, el último a la derecha', () => {
    const pts = chartPoints([{ at: 1, weight: 30 }, { at: 2, weight: 40 }])
    expect(pts[0]).toEqual({ x: 12, y: 90 })
    expect(pts[1]).toEqual({ x: 330, y: 28 })
    expect(chartPoints([])).toEqual([])
    expect(chartPoints([{ at: 1, weight: 30 }])).toEqual([{ x: 171, y: 59 }])
  })
})
