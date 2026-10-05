/**
 * Paletas de colores: el usuario elige fondo + texto y de ese par se calculan los tonos intermedios
 * (grises, bordes, superficies), así cualquier combinación queda prolija. El acento rojo no cambia.
 */

export interface Palette {
  id: string
  nombre: string
  bg: string
  ink: string
}

/** Rojo de la marca 653. Con texto blanco encima. */
export const ACCENT = '#e3202f'

export const PALETTES: Palette[] = [
  { id: '653', nombre: '653', bg: '#f4f1ea', ink: '#141414' },
  { id: 'blanco', nombre: 'Blanco', bg: '#ffffff', ink: '#111111' },
  { id: 'perla', nombre: 'Perla', bg: '#eceef1', ink: '#1a1f26' },
  { id: 'arena', nombre: 'Arena', bg: '#efe5d5', ink: '#2b2117' },
  { id: 'menta', nombre: 'Menta', bg: '#e6f0ea', ink: '#13261c' },
  { id: 'noche', nombre: 'Noche', bg: '#141414', ink: '#f4f1ea' },
  { id: 'grafito', nombre: 'Grafito', bg: '#26272a', ink: '#f1f1f1' },
  { id: 'azul', nombre: 'Azul noche', bg: '#0f1826', ink: '#e8eef7' },
]

export const DEFAULT_PALETTE = '653'

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

/** Mezcla `a` hacia `b` en proporción `t` (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a)
  const y = hex(b)
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}

export function isDark(color: string): boolean {
  const [r, g, b] = hex(color)
  return 0.299 * r + 0.587 * g + 0.114 * b < 128
}

/** Todas las variables de color de la app para una paleta. Función pura (se testea). */
export function paletteVars(p: Palette): Record<string, string> {
  const dark = isDark(p.bg)
  return {
    '--bg': p.bg,
    '--ink': p.ink,
    '--muted': mix(p.ink, p.bg, 0.45),
    '--muted-2': mix(p.ink, p.bg, 0.6),
    '--fill': mix(p.bg, p.ink, dark ? 0.14 : 0.07),
    '--track': mix(p.bg, p.ink, dark ? 0.22 : 0.12),
    '--track-ring': mix(p.bg, p.ink, dark ? 0.16 : 0.09),
    '--line': mix(p.bg, p.ink, dark ? 0.14 : 0.08),
    // Las superficies "oscuras" (deslizar para empezar, lo que sigue): en paletas oscuras, un tono más claro.
    '--dark-bg': dark ? mix(p.bg, p.ink, 0.12) : p.ink,
    '--dark-text': dark ? p.ink : p.bg,
    '--dark-muted': dark ? mix(p.ink, p.bg, 0.4) : mix(p.bg, p.ink, 0.38),
    '--dark-fill': dark ? mix(p.bg, p.ink, 0.22) : mix(p.ink, p.bg, 0.12),
    '--dark-sheet': dark ? mix(p.bg, p.ink, 0.08) : mix(p.ink, p.bg, 0.06),
    // Las hojas inferiores siempre con los colores de la paleta, aunque atrás esté el descanso oscuro.
    '--sheet-bg': p.bg,
    '--sheet-ink': p.ink,
    '--sheet-muted': mix(p.ink, p.bg, 0.45),
    '--sheet-fill': mix(p.bg, p.ink, dark ? 0.14 : 0.07),
    // Sobre fondo claro el rojo se ajusta para leerse como texto.
    // El rojo como texto: sobre fondo oscuro se aclara un poco, sobre claro se oscurece, para que se lea.
    '--accent-ink': dark ? mix(ACCENT, '#ffffff', 0.35) : mix(ACCENT, '#000000', 0.2),
    '--page-bg': mix(p.bg, p.ink, dark ? 0.04 : 0.05),
  }
}

export const paletteOf = (id: string): Palette => PALETTES.find((p) => p.id === id) ?? PALETTES[0]

/** Aplica la paleta a toda la app (y al color de la barra del sistema). */
export function applyPalette(id: string) {
  const p = paletteOf(id)
  const root = document.documentElement
  for (const [k, v] of Object.entries(paletteVars(p))) root.style.setProperty(k, v)
  root.style.colorScheme = isDark(p.bg) ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg)
}
