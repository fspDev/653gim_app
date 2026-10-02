import { useState } from 'react'
import { fmtKg } from '../format'
import type { SetLog } from '../workout/types'
import { Face } from '../ui/Face'
import { EFFORT_LABELS } from '../ui/labels'
import styles from './LogSheet.module.css'
import { Sheet } from './Sheet'

interface Props {
  serie: number
  /** Nombre corto del ejercicio ("SENTADILLA"). */
  exercise: string
  log: SetLog
  onSave: (reps: number, effort: number | null) => void
  onClose: () => void
}

/** Registro rápido (Registro.dc.html): hoja sobre el descanso, anotar no quita tiempo. */
export function LogSheet({ serie, exercise, log, onSave, onClose }: Props) {
  const [reps, setReps] = useState(log.reps)
  // effort se guarda 1–5; en pantalla es el índice 0–4.
  const [effort, setEffort] = useState<number | null>(log.effort)

  return (
    <Sheet label="Registrar serie" onClose={onClose}>
      <div className={styles.head}>
        <div className={styles.what}>
          SERIE {serie} · {exercise}
        </div>
        <div className={styles.kg}>{fmtKg(log.weight)} KG</div>
      </div>

      <div className={styles.question}>¿Cuántas hiciste?</div>
      <div className={styles.repsRow}>
        <button className={styles.round} aria-label="Una rep menos" onClick={() => setReps((r) => Math.max(0, r - 1))}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M5 12h14" />
          </svg>
        </button>
        <div className={styles.repsBox}>
          <div className={styles.reps} aria-live="polite">
            {reps}
          </div>
          <div className={styles.target}>objetivo {log.targetReps}</div>
        </div>
        <button className={styles.round} aria-label="Una rep más" onClick={() => setReps((r) => r + 1)}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M5 12h14M12 5v14" />
          </svg>
        </button>
      </div>

      <div className={styles.question} style={{ marginTop: 22 }}>
        ¿Cómo te costó?
      </div>
      <div className={styles.faces} role="radiogroup" aria-label="¿Cómo te costó?">
        {EFFORT_LABELS.map((label, i) => {
          const on = effort === i + 1
          return (
            <button key={label} className={styles.face} role="radio" aria-checked={on} aria-label={label} data-on={on} onClick={() => setEffort(on ? null : i + 1)}>
              <span className={styles.faceDisc}>
                <Face level={i} />
              </span>
              <span className={styles.faceLabel}>{label}</span>
            </button>
          )
        })}
      </div>

      <button className={styles.save} onClick={() => onSave(reps, effort)}>
        GUARDAR
      </button>
      <button className={styles.plan} onClick={() => onSave(log.targetReps, null)}>
        Como la planeé ({log.targetReps} reps)
      </button>
    </Sheet>
  )
}
