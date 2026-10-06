import type { PipFrame, PipTheme } from './frameModel'

/** Lado de referencia del lienzo: el otro lado sale de la proporción real de la ventana. */
export const PIP_SIZE = 480
export const MIN_RATIO = 0.6
export const MAX_RATIO = 1.6
/** Proporción con la que arranca el lienzo (la ventana de Android salió 5:4). */
export const START_RATIO = 1.25

/** Tamaño del lienzo para una ventana de esa proporción (ancho / alto). */
export function canvasSizeFor(ratio: number): { w: number; h: number } {
  const r = Math.min(MAX_RATIO, Math.max(MIN_RATIO, Number.isFinite(ratio) && ratio > 0 ? ratio : 1))
  return r >= 1 ? { w: Math.round(PIP_SIZE * r), h: PIP_SIZE } : { w: PIP_SIZE, h: Math.round(PIP_SIZE / r) }
}

const THEMES: Record<PipTheme, { bg: string; ink: string; muted: string; track: string; ring: string }> = {
  // Te toca: rojo entero, se ve de reojo desde la otra punta del gimnasio.
  accent: { bg: '#e8192f', ink: '#ffffff', muted: 'rgba(255,255,255,0.78)', track: 'rgba(255,255,255,0.25)', ring: '#ffffff' },
  dark: { bg: '#1f1f1f', ink: '#ffffff', muted: '#aeaeae', track: '#3a3a3a', ring: '#e8192f' },
  light: { bg: '#ffffff', ink: '#2b2b2b', muted: '#8a8a8a', track: '#e6e6e6', ring: '#e8192f' },
}

const DISPLAY = 'Anton, Impact, sans-serif'
const LABEL = '"Barlow Condensed", "Arial Narrow", sans-serif'
const BODY = 'Inter, system-ui, sans-serif'

/** Achica la letra hasta que el texto entra en `maxWidth`. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: string, family: string, size: number, maxWidth: number): number {
  let s = size
  ctx.font = `${weight} ${s}px ${family}`
  while (s > 10 && ctx.measureText(text).width > maxWidth) {
    s -= 2
    ctx.font = `${weight} ${s}px ${family}`
  }
  return s
}

/**
 * Dibuja el cuadro en el lienzo, sea cual sea su proporción: se diseña sobre un ancho fijo de 480 y el
 * alto sobrante o faltante se reparte (el aro y el número ocupan el espacio libre del medio).
 */
export function drawFrame(ctx: CanvasRenderingContext2D, f: PipFrame) {
  const pxW = ctx.canvas.width
  const pxH = ctx.canvas.height
  const W = 480
  const H = (pxH / pxW) * W
  const pad = 30
  const t = THEMES[f.theme]
  ctx.save()
  ctx.setTransform(pxW / W, 0, 0, pxW / W, 0, 0)
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  // Arriba: qué momento es.
  ctx.fillStyle = f.theme === 'dark' ? t.ring : t.ink
  ctx.textAlign = 'left'
  fit(ctx, f.kicker, '800', LABEL, 34, W - pad * 2)
  ctx.fillText(f.kicker, pad, pad + 28)

  // Zona libre del medio, entre el título de arriba y el bloque de texto de abajo.
  const top = 76
  const bottom = H - 124
  const free = Math.max(60, bottom - top)
  const cx = W / 2
  const cy = top + free / 2

  if (f.ring !== null) {
    const r = Math.min(112, free / 2 - 8)
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(8, r * 0.14)
    ctx.strokeStyle = t.track
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    if (f.ring > 0) {
      ctx.strokeStyle = f.paused ? t.muted : t.ring
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f.ring)
      ctx.stroke()
    }
    ctx.fillStyle = t.ink
    ctx.textAlign = 'center'
    const size = fit(ctx, f.big, '400', DISPLAY, r * 0.86, r * 1.57)
    ctx.fillText(f.big, cx, cy + size * 0.36)
    if (f.unit) {
      ctx.fillStyle = t.muted
      fit(ctx, f.unit, '800', LABEL, Math.max(14, r * 0.2), r * 1.5)
      ctx.fillText(f.unit, cx, cy + size * 0.36 + Math.max(20, r * 0.27))
    }
  } else {
    ctx.fillStyle = t.ink
    ctx.textAlign = 'center'
    const size = fit(ctx, f.big, '400', DISPLAY, Math.min(190, free * 0.8), W - pad * 2)
    const unitGap = f.unit ? 22 : 0
    const base = cy + (size * 0.38 - unitGap / 2)
    ctx.fillText(f.big, cx, base)
    if (f.unit) {
      ctx.fillStyle = t.muted
      fit(ctx, f.unit, '800', LABEL, 30, W - pad * 2)
      ctx.fillText(f.unit, cx, base + 42)
    }
  }

  // Abajo: ejercicio, lo que sigue y qué hacen los botones.
  ctx.textAlign = 'left'
  ctx.fillStyle = t.ink
  fit(ctx, f.title, '400', DISPLAY, 40, W - pad * 2)
  ctx.fillText(f.title, pad, H - 84)

  ctx.fillStyle = t.muted
  fit(ctx, f.sub, '600', BODY, 21, W - pad * 2)
  ctx.fillText(f.sub, pad, H - 54)

  if (f.controls.legend) {
    ctx.fillStyle = f.theme === 'dark' ? t.ring : t.ink
    fit(ctx, f.controls.legend, '800', LABEL, 22, W - pad * 2)
    ctx.fillText(f.controls.legend, pad, H - 20)
  }
  ctx.restore()
}
