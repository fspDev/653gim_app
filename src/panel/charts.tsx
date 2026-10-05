import { useEffect, useId, useRef, useState } from 'react'
import styles from './charts.module.css'

/**
 * Gráficos de una sola serie (sin leyenda: el título dice qué es). Línea de 2 px en el acento, puntos de 8 px,
 * grilla tenue y tooltip al pasar o tocar. Siempre acompañados de los números en texto (tabla o lista).
 */

export interface Punto {
  /** Etiqueta del eje X y del tooltip ("12/9"). */
  label: string
  value: number
  /** Texto del tooltip ("82,5 kg · 12/9"). */
  tip: string
}

const H = 200

/** Ancho real del gráfico en px: así el texto de los ejes mide 12 px también en el celular. */
function useWidth() {
  const ref = useRef<HTMLElement>(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}
const PAD = { l: 44, r: 16, t: 16, b: 28 }

function niceTicks(lo: number, hi: number, n = 4): number[] {
  if (lo === hi) return [lo]
  const step0 = (hi - lo) / n
  const mag = 10 ** Math.floor(Math.log10(step0))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)))
  return out
}

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 })

export function LineChart({ data, label, zero = false }: { data: Punto[]; label: string; zero?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const id = useId()
  const [ref, W] = useWidth()
  if (data.length === 0) return null
  const vals = data.map((d) => d.value)
  let lo = zero ? 0 : Math.min(...vals)
  let hi = Math.max(...vals)
  if (lo === hi) {
    lo -= 1
    hi += 1
  }
  const pad = (hi - lo) * 0.12
  if (!zero) lo -= pad
  hi += pad
  const x = (i: number) => (data.length === 1 ? (PAD.l + W - PAD.r) / 2 : PAD.l + (i * (W - PAD.l - PAD.r)) / (data.length - 1))
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b)
  const ticks = niceTicks(lo, hi)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ')
  // Etiquetas del eje X: como mucho 6, repartidas.
  const every = Math.max(1, Math.ceil(data.length / Math.max(3, Math.floor(W / 90))))
  const h = hover !== null ? data[hover] : null

  return (
    <figure ref={ref} className={styles.figure} aria-labelledby={id} onMouseLeave={() => setHover(null)}>
      <figcaption id={id} className={styles.srOnly}>
        {label}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={PAD.l - 8} y={y(t)} className={styles.axis} textAnchor="end" dominantBaseline="middle">
              {fmt(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          (data.length - 1 - i) % every === 0 ? (
            <text key={i} x={x(i)} y={H - 8} className={styles.axis} textAnchor="middle">
              {d.label}
            </text>
          ) : null,
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className={styles.cross} />}
        <path d={path} className={styles.line} />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r={hover === i ? 6 : 4} className={styles.dot} />
        ))}
        {/* Zonas de toque más anchas que el punto. */}
        {data.map((_, i) => {
          const half = data.length === 1 ? W / 2 : (W - PAD.l - PAD.r) / (data.length - 1) / 2
          return <rect key={i} x={x(i) - half} y={0} width={half * 2} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        })}
      </svg>
      {h && hover !== null && (
        <div className={styles.tip} style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
          {h.tip}
        </div>
      )}
    </figure>
  )
}

/** Barras verticales (p. ej. entrenos por semana). Extremos redondeados de 4 px apoyados en la base. */
export function BarChart({ data, label }: { data: Punto[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const [ref, W] = useWidth()
  if (data.length === 0) return null
  const hi = Math.max(1, ...data.map((d) => d.value))
  const ticks = niceTicks(0, hi, Math.min(4, hi)).filter((t) => Number.isInteger(t))
  const slot = (W - PAD.l - PAD.r) / data.length
  const bw = Math.min(36, slot - 6)
  const y = (v: number) => PAD.t + ((hi - v) / hi) * (H - PAD.t - PAD.b)
  const base = H - PAD.b
  const everyBar = Math.max(1, Math.ceil(data.length / Math.max(3, Math.floor(W / 60))))
  const h = hover !== null ? data[hover] : null

  return (
    <figure ref={ref} className={styles.figure} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={PAD.l - 8} y={y(t)} className={styles.axis} textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.l + slot * i + slot / 2
          const top = y(d.value)
          const r = Math.min(4, (base - top) / 2, bw / 2)
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={PAD.l + slot * i} y={0} width={slot} height={H} fill="transparent" />
              {d.value > 0 && (
                <path
                  className={styles.bar}
                  data-active={hover === i}
                  d={`M${cx - bw / 2} ${base} V${top + r} Q${cx - bw / 2} ${top} ${cx - bw / 2 + r} ${top} H${cx + bw / 2 - r} Q${cx + bw / 2} ${top} ${cx + bw / 2} ${top + r} V${base} Z`}
                />
              )}
              {(data.length - 1 - i) % everyBar === 0 && (
                <text x={cx} y={H - 8} className={styles.axis} textAnchor="middle">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
        <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} className={styles.baseline} />
      </svg>
      {h && hover !== null && (
        <div className={styles.tip} style={{ left: `${((PAD.l + slot * hover + slot / 2) / W) * 100}%` }} role="status">
          {h.tip}
        </div>
      )}
    </figure>
  )
}
