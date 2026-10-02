import type { Dispatch, ReactNode } from 'react'
import type { CircuitBlock, CircuitStep } from '../data'
import { fmtTime } from '../format'
import { secondsLeft, type WorkoutAction } from '../workout/reducer'
import type { CircuitRun, Workout } from '../workout/types'
import styles from './CircuitView.module.css'
import { fitFont } from './fit'
import { Header } from './Header'
import { Shell, SrOnly } from './Shell'

interface Props {
  w: Workout
  block: CircuitBlock
  run: CircuitRun
  now: number
  dispatch: Dispatch<WorkoutAction>
  onExit: () => void
  overlay?: ReactNode
  inertFrame?: boolean
}

const stepLabel = (s: CircuitStep) => (s.seconds ? `${s.seconds} s` : `${s.reps} reps`)

/** Circuito guiado (Core.dc.html): rondas con pasos por tiempo o por reps; anterior / pausa / siguiente. */
export function CircuitView({ w, block, run, now, dispatch, onExit, overlay, inertFrame }: Props) {
  const step = block.steps[run.step]
  const isTimed = step.seconds !== undefined
  const paused = run.pausedLeft !== null
  const left = !isTimed ? 0 : paused ? Math.ceil(run.pausedLeft! / 1000) : secondsLeft(run.stepEnd!, now)
  const pct = isTimed ? Math.min(100, Math.max(0, (1 - left / step.seconds!) * 100)) : 0

  return (
    <Shell className={styles.stage} inertFrame={inertFrame} overlay={overlay}>
      <SrOnly>{`${step.name}. Ronda ${run.round} de ${block.rounds}.`}</SrOnly>
      <Header w={w} now={now} onExit={onExit} />

      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.block}>{block.name.toUpperCase()}</span>
          <span>
            RONDA {run.round} DE {block.rounds}
          </span>
        </div>
        <div className={styles.name} style={{ fontSize: fitFont(step.name, 40) }}>
          {step.name.toUpperCase()}
        </div>

        {isTimed ? (
          <div className={styles.time} role="timer" aria-label={`Quedan ${fmtTime(left)}`}>
            {fmtTime(left)}
          </div>
        ) : (
          <div className={styles.time}>
            {step.reps}
            <span className={styles.repsUnit}>REPS</span>
          </div>
        )}
        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: isTimed ? `${pct}%` : '0%' }} />
        </div>

        <ul className={styles.steps}>
          {block.steps.map((s, i) => {
            const state = i < run.step ? 'done' : i === run.step ? 'now' : 'next'
            return (
              <li key={i} className={styles.step} data-state={state}>
                <span className={styles.dot} aria-hidden="true">
                  {state === 'done' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4.5 12.5l5 5 10-11" />
                    </svg>
                  )}
                </span>
                <span className={styles.stepName}>{s.name}</span>
                <span className={styles.stepDur}>{stepLabel(s)}</span>
              </li>
            )
          })}
        </ul>

        <div className={styles.controls}>
          <button className={styles.side} aria-label="Ejercicio anterior" onClick={() => dispatch({ type: 'CIRCUIT_PREV', now: Date.now() })}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 6h2v12H7zM20 6v12l-9-6z" />
            </svg>
          </button>
          {isTimed ? (
            <button className={styles.main} aria-label={paused ? 'Reanudar' : 'Pausar'} onClick={() => dispatch({ type: 'CIRCUIT_TOGGLE', now: Date.now() })}>
              {paused ? (
                <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              )}
            </button>
          ) : (
            // Un paso por reps no tiene cuenta que pausar: el botón central confirma que terminaste.
            <button className={styles.main} aria-label="Terminé las reps" onClick={() => dispatch({ type: 'CIRCUIT_NEXT', now: Date.now() })}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
            </button>
          )}
          <button className={styles.side} aria-label="Ejercicio siguiente" onClick={() => dispatch({ type: 'CIRCUIT_NEXT', now: Date.now() })}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 6h2v12h-2zM4 6v12l9-6z" />
            </svg>
          </button>
        </div>
      </div>
    </Shell>
  )
}
