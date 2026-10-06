import type { Dispatch, ReactNode } from 'react'
import type { TimeBlock } from '../data'
import { fmtTime } from '../format'
import { secondsLeft, type WorkoutAction } from '../workout/reducer'
import type { TimeRun, Workout } from '../workout/types'
import { blockDetail } from './describe'
import { fitFont } from './fit'
import { Header } from './Header'
import { NotaEnVivo } from './NotaEnVivo'
import { Shell, SrOnly } from './Shell'
import styles from './TimeView.module.css'

interface Props {
  w: Workout
  block: TimeBlock
  run: TimeRun
  now: number
  dispatch: Dispatch<WorkoutAction>
  onExit: () => void
  overlay?: ReactNode
  inertFrame?: boolean
}

/** Bloque por tiempo (Bici.dc.html): cuenta regresiva, pausa, ±1 min y el siguiente bloque asomando abajo. */
export function TimeView({ w, block, run, now, dispatch, onExit, overlay, inertFrame }: Props) {
  const next = w.day.blocks[w.index + 1]
  const paused = run.pausedLeft !== null
  const left = paused ? Math.ceil(run.pausedLeft! / 1000) : secondsLeft(run.endAt, now)
  const pct = Math.min(100, Math.max(0, (1 - left / run.total) * 100))

  return (
    <Shell className={styles.stage} inertFrame={inertFrame} overlay={overlay}>
      <SrOnly>{paused ? `${block.name} en pausa.` : `${block.name}.`}</SrOnly>
      <div className={styles.col}>
      <Header w={w} now={now} onExit={onExit} />

      <div className={styles.body}>
        <div className={styles.name} style={{ fontSize: fitFont(block.name, 44) }}>
          {block.name.toUpperCase()}
        </div>
        {block.subtitle && <div className={styles.subtitle}>{block.subtitle}</div>}
        <NotaEnVivo note={block.note} className={styles.nota} />
        <div className={styles.time} role="timer" aria-label={`Quedan ${fmtTime(left)}`}>
          {fmtTime(left)}
        </div>
        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: `${pct}%` }} />
        </div>
        <div className={styles.barMeta}>
          <span>{block.hint}</span>
          <span>de {fmtTime(run.total)}</span>
        </div>

        <div className={styles.controls}>
          <button className={styles.pill} aria-label="Restar un minuto" onClick={() => dispatch({ type: 'TIME_ADD', deltaSeconds: -60, now: Date.now() })}>
            −1 MIN
          </button>
          <button className={styles.main} aria-label={paused ? 'Reanudar' : 'Pausar'} onClick={() => dispatch({ type: 'TIME_TOGGLE', now: Date.now() })}>
            {paused ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            )}
          </button>
          <button className={styles.pill} aria-label="Sumar un minuto" onClick={() => dispatch({ type: 'TIME_ADD', deltaSeconds: 60, now: Date.now() })}>
            +1 MIN
          </button>
        </div>
      </div>

      {next && (
        <div className={styles.next}>
          <div className={styles.nextTop}>
            <div className={styles.nextLabel}>
              SIGUIENTE · {w.index + 2} / {w.day.blocks.length}
            </div>
            <div className={styles.nextIn}>en {fmtTime(left)}</div>
          </div>
          <div className={styles.nextName} style={{ fontSize: fitFont(next.name, 32) }}>
            {next.name.toUpperCase()}
          </div>
          <div className={styles.nextDetail}>{blockDetail(next)}</div>
        </div>
      )}
      </div>
    </Shell>
  )
}
