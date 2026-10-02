import { useEffect, type Dispatch, type ReactNode } from 'react'
import { fmtTime } from '../format'
import { BETWEEN_SECONDS, type WorkoutAction } from '../workout/reducer'
import { blockStats } from '../workout/selectors'
import type { Workout } from '../workout/types'
import styles from './BetweenView.module.css'
import { blockDetail } from './describe'
import { fitFont } from './fit'
import * as haptics from './haptics'
import { Shell, SrOnly } from './Shell'

const RING_R = 38
const RING_C = 2 * Math.PI * RING_R

interface Props {
  w: Workout
  now: number
  dispatch: Dispatch<WorkoutAction>
  onExit: () => void
  overlay?: ReactNode
  inertFrame?: boolean
}

const kg = (n: number) => n.toLocaleString('es-AR')

/** Bloque listo (BloqueListo.dc.html): resumen del bloque, el que sigue y una cuenta de 5 s que arranca sola. */
export function BetweenView({ w, now, dispatch, onExit, overlay, inertFrame }: Props) {
  const done = w.day.blocks[w.index]
  const next = w.day.blocks[w.index + 1]
  const stats = blockStats(w, done.id)
  const paused = w.betweenLeft !== null
  const leftMs = paused ? w.betweenLeft! : Math.max(0, w.betweenEnd - now)
  const left = Math.ceil(leftMs / 1000)
  const frac = leftMs / (BETWEEN_SECONDS * 1000)

  // Aviso al llegar la pantalla: un bloque terminó, el siguiente ya viene.
  useEffect(() => {
    haptics.step()
  }, [])

  const cells: { value: string; label: string }[] = []
  if (done.kind === 'fuerza') {
    cells.push({ value: `${stats.series}/${done.series}`, label: 'series' })
    cells.push({ value: kg(stats.kilos), label: 'kilos' })
  } else if (done.kind === 'circuito') {
    cells.push({ value: `${done.rounds}`, label: 'rondas' })
  }
  cells.push({ value: fmtTime(stats.ms / 1000), label: 'minutos' })

  const hint = next.kind === 'fuerza' ? 'Andá preparando el equipo.' : 'Preparate.'

  return (
    <Shell className={styles.stage} inertFrame={inertFrame} overlay={overlay}>
      <SrOnly>{`${done.name} lista. Sigue ${next.name}.`}</SrOnly>

      <div className={styles.col}>
      <div className={styles.top}>
        <div className={styles.topbar}>
          <button className={styles.exit} aria-label="Salir del entrenamiento" onClick={onExit}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className={styles.count}>
            BLOQUE {w.index + 1} / {w.day.blocks.length}
          </div>
          <div className={styles.spacer} />
        </div>
        <svg className={styles.check} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4.5 12.5l5 5 10-11" />
        </svg>
        {/* Anton mide ≈ 0,42 em por letra: el nombre corto entra en una línea y "LISTA" va abajo. */}
        <div className={styles.title} style={{ fontSize: `min(calc(76px * var(--k)), ${(209 / Math.max(done.short.length, 5)).toFixed(1)}cqw)` }}>
          {done.short}
          <br />
          LISTA
        </div>
        <div className={styles.stats}>
          {cells.map((c) => (
            <div key={c.label}>
              <div className={styles.statValue}>{c.value}</div>
              <div className={styles.statLabel}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.nextLabel}>
          SIGUE · {w.index + 2} / {w.day.blocks.length}
        </div>
        <div className={styles.nextName} style={{ fontSize: fitFont(next.name, 40) }}>
          {next.name.toUpperCase()}
        </div>
        <div className={styles.nextDetail}>{blockDetail(next)}</div>
        <div className={styles.grow} />

        <div className={styles.countdown}>
          <div className={styles.ring} role="timer" aria-label={`Empieza en ${left} segundos`}>
            <svg width="88" height="88" viewBox="0 0 88 88" className={styles.ringSvg} aria-hidden="true">
              <circle className={styles.track} cx="44" cy="44" r={RING_R} fill="none" strokeWidth="8" />
              <circle
                className={styles.arc}
                cx="44"
                cy="44"
                r={RING_R}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${RING_C * frac} ${RING_C}`}
                transform="rotate(-90 44 44)"
              />
            </svg>
            <div className={styles.ringNumber}>{left}</div>
          </div>
          <div className={styles.countText}>
            {paused ? 'Cuenta en pausa. ' : `Empieza solo en ${left} ${left === 1 ? 'segundo' : 'segundos'}. `}
            {hint}
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.start} onClick={() => dispatch({ type: 'BETWEEN_START', now: Date.now() })}>
            EMPEZAR YA
          </button>
          <button
            className={styles.wait}
            aria-label={paused ? 'Seguir la cuenta' : 'Esperar, pausar la cuenta'}
            onClick={() => dispatch({ type: 'BETWEEN_TOGGLE', now: Date.now() })}
          >
            {paused ? 'SEGUÍ' : 'ESPERÁ'}
          </button>
        </div>
      </div>
      </div>
    </Shell>
  )
}
