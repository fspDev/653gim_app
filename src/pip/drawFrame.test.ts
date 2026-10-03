import { describe, expect, it } from 'vitest'
import { canvasSizeFor, MAX_RATIO, MIN_RATIO } from './drawFrame'

describe('canvasSizeFor', () => {
  it('cuadrada → 480×480', () => expect(canvasSizeFor(1)).toEqual({ w: 480, h: 480 }))
  it('ventana apaisada 5:4 → el lienzo tiene la misma proporción (no se estira)', () => {
    const { w, h } = canvasSizeFor(1.25)
    expect(w / h).toBeCloseTo(1.25, 2)
  })
  it('ventana alta → lienzo alto', () => {
    const { w, h } = canvasSizeFor(0.75)
    expect(h).toBeGreaterThan(w)
    expect(w / h).toBeCloseTo(0.75, 2)
  })
  it('proporciones extremas o inválidas se acotan', () => {
    expect(canvasSizeFor(5).w / canvasSizeFor(5).h).toBeCloseTo(MAX_RATIO, 2)
    expect(canvasSizeFor(0.1).w / canvasSizeFor(0.1).h).toBeCloseTo(MIN_RATIO, 2)
    expect(canvasSizeFor(NaN)).toEqual({ w: 480, h: 480 })
  })
})
