import { useEffect, useRef, useSyncExternalStore, type Dispatch, type ReactNode } from 'react'
import type { StrengthBlock } from '../data'
import { fmtKg, fmtTime } from '../format'
import { useSettings } from '../settings'
import { secondsLeft, WEIGHT_STEP, type WorkoutAction } from '../workout/reducer'
import type { StrengthRun, Workout } from '../workout/types'
import { Header } from './Header'
import { fitFont } from './fit'
import * as haptics from './haptics'
import { Shell, SrOnly } from './Shell'
import styles from './StrengthView.module.css'

const RING_R = 135
const RING_C = 2 * Math.PI * RING_R // 848.2
const WARN_SECONDS = 3

const DARK_QUERY = '(prefers-color-scheme: dark)'
const subscribeDark = (cb: () => void) => {
  const mq = window.matchMedia(DARK_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const systemDark = () => window.matchMedia(DARK_QUERY).matches

interface Props {
  w: Workout
  block: StrengthBlock
  run: StrengthRun
  now: number
  dispatch: Dispatch<WorkoutAction>
  onExit: () => void
  /** Abre el registro rápido de la serie. */
  onLog: () => void
  overlay?: ReactNode
  inertFrame?: boolean
}

export function StrengthView({ w, block, run, now, dispatch, onExit, onLog, overlay, inertFrame }: Props) {
  const { temaDescanso } = useSettings()
  const prefersDark = useSyncExternalStore(subscribeDark, systemDark)
  const dark = temaDescanso === 'oscuro' || (temaDescanso === 'auto' && prefersDark)
  const next = w.day.blocks[w.index + 1]
  const rest = run.phase === 'descanso'
  const remaining = rest ? secondsLeft(run.restEnd, now) : 0
  const warn = rest && remaining > 0 && remaining <= WARN_SECONDS

  useEffect(() => {
    if (warn) haptics.warn()
  }, [warn])

  // Vibración larga y beep cuando el descanso termina solo y arranca la serie siguiente (no al deshacer).
  const prev = useRef({ phase: run.phase, serie: run.serie })
  useEffect(() => {
    if (prev.current.phase === 'descanso' && run.phase === 'serie' && run.serie > prev.current.serie) haptics.restEnd()
    prev.current = { phase: run.phase, serie: run.serie }
  }, [run.phase, run.serie])

  useEffect(() => {
    if (!run.fresh) return
    const id = setTimeout(() => dispatch({ type: 'CLEAR_FRESH' }), 380)
    return () => clearTimeout(id)
  }, [run.fresh, dispatch])

  const nextIsSerie = run.serie < block.series
  const nextText = nextIsSerie
    ? `SERIE ${run.serie + 1} · ${fmtKg(run.weight)} KG`
    : next
      ? `${next.short}${next.kind === 'fuerza' ? ` · ${fmtKg(next.weight)} KG` : ''}`
      : 'FIN DEL ENTRENAMIENTO'
  const nextDetail = nextIsSerie ? `${block.reps} reps objetivo` : next ? 'siguiente bloque' : ''
  const arcOffset = rest ? RING_C * (1 - remaining / run.restTotal) : 0

  return (
    <Shell
      className={styles.stage}
      data-phase={rest ? 'descanso' : 'serie'}
      data-warn={warn}
      data-fresh={run.fresh}
      data-theme={rest && dark ? 'oscuro' : 'claro'}
      inertFrame={inertFrame}
      overlay={overlay}
    >
      {/* Anuncia el cambio de fase a lectores de pantalla; el temporizador en sí no es un aria-live. */}
      <SrOnly>{rest ? `Descanso. Serie ${run.serie} lista.` : `Serie ${run.serie} de ${block.series}.`}</SrOnly>

      <Header w={w} now={now} onExit={onExit} absolute />

      {/* Cabecera de serie */}
      <div className={`${styles.layer} ${styles.serieHead}`}>
        <div className={styles.title} style={{ fontSize: fitFont(block.name, 38) }}>
          {block.name.toUpperCase()}
        </div>
        <div className={styles.serieRow}>
          <div className={styles.serieLabel}>
            SERIE {run.serie} DE {block.series}
          </div>
          <div className={styles.dots} aria-hidden="true">
            {Array.from({ length: block.series }, (_, i) => (
              <span key={i} className={styles.dot} data-state={i + 1 < run.serie ? 'done' : i + 1 === run.serie ? 'current' : 'todo'} />
            ))}
          </div>
        </div>
      </div>

      {/* Cabecera de descanso */}
      <div className={`${styles.layer} ${styles.restHead}`}>
        <div className={styles.restEyebrow}>
          {block.short} · SERIE {run.serie} LISTA
        </div>
        <div className={styles.title}>DESCANSO</div>
      </div>

      {/* Peso: se achica y sube hacia el anillo */}
      <div className={styles.weight}>
        <div className={styles.weightNumber}>{fmtKg(run.weight)}</div>
        <div className={styles.weightUnit}>KG</div>
      </div>

      <div className={styles.adjust}>
        {block.suggestion && !run.suggestionUsed && (
          <button
            className={styles.chip}
            aria-label={`Aplicar sugerencia: sumar ${fmtKg(block.suggestion)} kilos`}
            onClick={() => dispatch({ type: 'APPLY_SUGGESTION' })}
          >
            <span className={styles.chipBadge}>+{fmtKg(block.suggestion)}</span>
            <span>la última vez completaste todo</span>
          </button>
        )}
        <div className={styles.objectiveRow}>
          <div>
            <div className={styles.objectiveLabel}>OBJETIVO</div>
            <div className={styles.objectiveValue}>{block.reps} REPS</div>
          </div>
          <div className={styles.stepper}>
            <button className={styles.round} aria-label="Bajar peso" onClick={() => dispatch({ type: 'WEIGHT', delta: -WEIGHT_STEP })}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M5 12h14" />
              </svg>
            </button>
            <button className={styles.round} aria-label="Subir peso" onClick={() => dispatch({ type: 'WEIGHT', delta: WEIGHT_STEP })}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M5 12h14M12 5v14" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Anillo */}
      <div className={styles.ring} role="timer" aria-label={`Descanso, quedan ${fmtTime(remaining)}`}>
        <svg width="300" height="300" viewBox="0 0 300 300" className={styles.ringSvg} aria-hidden="true">
          <circle className={styles.disc} cx="150" cy="150" r="104" />
          <circle className={styles.track} cx="150" cy="150" r={RING_R} fill="none" strokeWidth="18" />
          <circle
            className={styles.arc}
            cx="150"
            cy="150"
            r={RING_R}
            fill="none"
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={arcOffset}
            opacity={rest && remaining === 0 ? 0 : 1}
            transform="rotate(-90 150 150)"
          />
        </svg>
        <div className={styles.ringText}>
          <div className={styles.ringTime}>{fmtTime(remaining)}</div>
          <div className={styles.ringOf}>de {fmtTime(run.restTotal)}</div>
        </div>
      </div>

      <div className={styles.controls}>
        <button className={styles.pill} aria-label="Restar 15 segundos" onClick={() => dispatch({ type: 'ADJUST_REST', deltaSeconds: -15, now: Date.now() })}>
          −15S
        </button>
        <button className={`${styles.pill} ${styles.pillSkip}`} aria-label="Saltar descanso" onClick={() => dispatch({ type: 'FINISH_REST', now: Date.now() })}>
          SALTAR
        </button>
        <button className={styles.pill} aria-label="Sumar 15 segundos" onClick={() => dispatch({ type: 'ADJUST_REST', deltaSeconds: 15, now: Date.now() })}>
          +15S
        </button>
      </div>

      {/* Bloque inferior: HECHA en lima ↔ "Después" en negro */}
      <div className={styles.sheet}>
        <button
          className={styles.done}
          aria-label="Serie hecha"
          onClick={() => {
            haptics.tap()
            dispatch({ type: 'DONE', now: Date.now() })
          }}
        >
          <svg className={styles.doneIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 12.5l5 5 10-11" />
          </svg>
          <span className={styles.doneWord}>HECHA</span>
          <span className={styles.doneHint}>Tocá cuando termines la serie</span>
        </button>

        <div className={styles.after}>
          <div className={styles.afterLabel}>{warn ? 'PREPARATE' : 'DESPUÉS'}</div>
          <div className={styles.afterTitle} style={{ fontSize: fitFont(nextText, 36) }}>
            {nextText}
          </div>
          <div className={styles.afterDetail}>{nextDetail}</div>
          <div className={styles.afterLinks}>
            <button className={styles.link} onClick={onLog}>
              Anotar serie {run.serie}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <button className={styles.undo} onClick={() => dispatch({ type: 'UNDO' })}>
              Deshacer
            </button>
          </div>
        </div>
      </div>
    </Shell>
  )
}
