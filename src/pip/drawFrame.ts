import type { PipFrame, PipTheme } from './frameModel'

export const PIP_SIZE = 480

const THEMES: Record<PipTheme, { bg: string; ink: string; muted: string; track: string; ring: string }> = {
  // Te toca: rojo entero, se ve de reojo desde la otra punta del gimnasio.
  accent: { bg: '#e3202f', ink: '#ffffff', muted: 'rgba(255,255,255,0.78)', track: 'rgba(255,255,255,0.25)', ring: '#ffffff' },
  dark: { bg: '#141414', ink: '#f4f1ea', muted: '#a39e93', track: '#2b2a27', ring: '#e3202f' },
  light: { bg: '#f4f1ea', ink: '#141414', muted: '#6b665d', track: '#dad4c8', ring: '#e3202f' },
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

export function drawFrame(ctx: CanvasRenderingContext2D, f: PipFrame) {
  const W = PIP_SIZE
  const pad = 30
  const t = THEMES[f.theme]
  ctx.save()
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, W, W)
  ctx.textBaseline = 'alphabetic'

  // Arriba: qué momento es.
  ctx.fillStyle = f.theme === 'accent' ? t.ink : f.theme === 'dark' ? t.ring : t.ink
  ctx.textAlign = 'left'
  fit(ctx, f.kicker, '800', LABEL, 34, W - pad * 2)
  ctx.fillText(f.kicker, pad, pad + 28)

  const cx = W / 2
  const cy = 200

  if (f.ring !== null) {
    const r = 112
    ctx.lineCap = 'round'
    ctx.lineWidth = 16
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
    const size = fit(ctx, f.big, '400', DISPLAY, 96, 176)
    ctx.fillText(f.big, cx, cy + size * 0.36)
    if (f.unit) {
      ctx.fillStyle = t.muted
      fit(ctx, f.unit, '800', LABEL, 22, 170)
      ctx.fillText(f.unit, cx, cy + size * 0.36 + 30)
    }
  } else {
    ctx.fillStyle = t.ink
    ctx.textAlign = 'center'
    const size = fit(ctx, f.big, '400', DISPLAY, 190, W - pad * 2)
    ctx.fillText(f.big, cx, cy + size * 0.38)
    if (f.unit) {
      ctx.fillStyle = t.muted
      fit(ctx, f.unit, '800', LABEL, 30, W - pad * 2)
      ctx.fillText(f.unit, cx, cy + size * 0.38 + 42)
    }
  }

  // Abajo: ejercicio, lo que sigue y qué hacen los botones.
  ctx.textAlign = 'left'
  ctx.fillStyle = t.ink
  fit(ctx, f.title, '400', DISPLAY, 40, W - pad * 2)
  ctx.fillText(f.title, pad, W - 84)

  ctx.fillStyle = t.muted
  fit(ctx, f.sub, '600', BODY, 21, W - pad * 2)
  ctx.fillText(f.sub, pad, W - 54)

  if (f.controls.legend) {
    ctx.fillStyle = f.theme === 'accent' ? t.ink : t.ring
    fit(ctx, f.controls.legend, '800', LABEL, 22, W - pad * 2)
    ctx.fillText(f.controls.legend, pad, W - 20)
  }
  ctx.restore()
}
