import { describe, expect, it } from 'vitest'
import { targetIndex } from './dragSort'

describe('ordenar arrastrando', () => {
  // Cuatro tarjetas de 100 px: centros en 50, 150, 250 y 350.
  const mids = [50, 150, 250, 350]

  it('sin pasar el centro de la vecina, queda donde estaba', () => {
    expect(targetIndex(mids, 1, 150)).toBe(1)
    expect(targetIndex(mids, 1, 240)).toBe(1)
  })

  it('pasando centros hacia abajo o hacia arriba', () => {
    expect(targetIndex(mids, 0, 260)).toBe(2)
    expect(targetIndex(mids, 0, 999)).toBe(3)
    expect(targetIndex(mids, 3, 140)).toBe(1)
    expect(targetIndex(mids, 3, -50)).toBe(0)
  })
})
