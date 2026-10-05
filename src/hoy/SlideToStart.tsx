import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import styles from './SlideToStart.module.css'

interface Props {
  label: string
  ariaLabel: string
  onComplete: () => void
}

const THRESHOLD = 0.9

/** "Deslizá para empezar": se arrastra el círculo rojo hasta el final. Enter / espacio también lo activan. */
export function SlideToStart({ label, ariaLabel, onComplete }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; max: number } | null>(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [done, setDone] = useState(false)
  // Recorrido del círculo en px; se mide al empezar a arrastrar.
  const [range, setRange] = useState(240)

  const complete = () => {
    setDone(true)
    onComplete()
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (done || !track.current) return
    const knob = e.currentTarget.getBoundingClientRect().width
    const max = track.current.getBoundingClientRect().width - knob - 16
    drag.current = { startX: e.clientX, max }
    setRange(max)
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    setX(Math.min(drag.current.max, Math.max(0, e.clientX - drag.current.startX)))
  }
  const onUp = () => {
    if (!drag.current) return
    const { max } = drag.current
    drag.current = null
    setDragging(false)
    if (x >= max * THRESHOLD) {
      setX(max)
      complete()
    } else {
      setX(0)
    }
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      complete()
    }
  }

  // El texto se apaga a medida que el círculo lo tapa.
  const fade = 1 - Math.min(1, x / (range * 0.6))

  return (
    <div ref={track} className={styles.track} role="button" tabIndex={0} aria-label={ariaLabel} onKeyDown={onKey}>
      <div
        className={styles.knob}
        style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : 'transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      </div>
      <span className={styles.label} style={{ opacity: fade }}>
        {label}
      </span>
      <span className={styles.chevrons} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 6l6 6-6 6" />
          <path d="M12 6l6 6-6 6" />
        </svg>
      </span>
    </div>
  )
}
