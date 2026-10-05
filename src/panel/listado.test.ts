import { describe, expect, it } from 'vitest'
import { buildFila, countBy, lastLabel, matches } from './listado'

const now = new Date('2026-10-04T18:00:00').getTime()
const DAY = 24 * 60 * 60 * 1000
const base = { id: 's1', nombre: 'Juan', apellido: 'Pérez', username: 'juan.perez', rutina: { nombre: 'Fuerza' } }

describe('listado de estudiantes', () => {
  it('etiqueta del último entreno', () => {
    expect(lastLabel(null, now)).toBe('Nunca')
    expect(lastLabel(now - DAY, now)).toBe('Ayer')
    expect(lastLabel(now - 14 * DAY, now)).toBe('Hace 14 días')
  })

  it('arma la fila con plan, inactividad y cuota', () => {
    const f = buildFila(base, 2, [now - 12 * DAY], { tipo: 'vencida', meses: ['2026-10'] }, now)
    expect(f).toMatchObject({ nombre: 'Juan Pérez', plan: 'Fuerza · 2 días', inactivo: true, semana: 0 })
  })

  it('filtra por búsqueda, plan y cuota', () => {
    const a = buildFila(base, 2, [now - DAY], { tipo: 'al-dia', proximo: '2026-11-10' }, now)
    const b = buildFila({ ...base, id: 's2', nombre: 'Lucía', apellido: 'Gómez', username: 'lucia.gomez', rutina: null }, null, [], { tipo: 'vencida', meses: ['2026-09'] }, now)
    expect(matches(a, 'todos', 'juan')).toBe(true)
    expect(matches(b, 'todos', 'juan')).toBe(false)
    expect(countBy([a, b], 'sin-plan')).toBe(1)
    expect(countBy([a, b], 'cuota')).toBe(1)
  })
})
