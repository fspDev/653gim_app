import { useState } from 'react'
import { fmtKg } from '../format'
import type { SetLog } from '../workout/types'
import styles from './LogSheet.module.css'
import { Sheet } from './Sheet'

interface Props {
  serie: number
  /** Nombre corto del ejercicio ("SENTADILLA"). */
  exercise: string
  log: SetLog
  onSave: (reps: number) => void
  onClose: () => void
}

/** Registro rápido (Registro.dc.html): hoja sobre el descanso, anotar no quita tiempo. */
export function LogSheet({ serie, exercise, log, onSave, onClose }: Props) {
  const [reps, setReps] = useState(log.reps)

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

      <button className={styles.save} onClick={() => onSave(reps)}>
        GUARDAR
      </button>
      <button className={styles.plan} onClick={() => onSave(log.targetReps)}>
        Como la planeé ({log.targetReps} reps)
      </button>
    </Sheet>
  )
}
