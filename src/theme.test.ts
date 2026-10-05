import { describe, expect, it } from 'vitest'
import { ACCENT, mix, PALETTES, paletteVars } from './theme'

/** Contraste WCAG entre dos colores #rrggbb. */
function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

describe('paletas', () => {
  it('mezcla colores', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it.each(PALETTES)('$nombre: texto y textos secundarios se leen sobre el fondo', (p) => {
    const v = paletteVars(p)
    expect(contrast(v['--ink'], v['--bg'])).toBeGreaterThanOrEqual(7)
    expect(contrast(v['--muted'], v['--bg'])).toBeGreaterThanOrEqual(3)
    expect(contrast(v['--dark-text'], v['--dark-bg'])).toBeGreaterThanOrEqual(7)
    // El rojo usado como texto o borde sobre el fondo de la paleta.
    expect(contrast(v['--accent-ink'], v['--bg'])).toBeGreaterThanOrEqual(4.5)
  })

  it('el texto sobre los botones rojos se lee', () => {
    expect(contrast('#ffffff', ACCENT)).toBeGreaterThanOrEqual(4.5)
  })
})
