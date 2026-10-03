import { fmtTime } from '../format'
import { blockProgress } from '../workout/selectors'
import type { Workout } from '../workout/types'
import { usePipUi } from '../pip/context'
import styles from './Header.module.css'

interface Props {
  w: Workout
  now: number
  onExit: () => void
  /** Posición absoluta (la usa el reproductor de fuerza para la transición). */
  absolute?: boolean
}

/** "X · BLOQUE n / N · reloj" y la línea de tiempo proporcional a los minutos de cada bloque. */
export function Header({ w, now, onExit, absolute }: Props) {
  const blocks = w.day.blocks
  const progress = blockProgress(w)
  const elapsed = Math.max(0, Math.floor(((w.finishedAt ?? now) - w.startedAt) / 1000))
  const cls = absolute ? styles.absolute : styles.flow
  const pip = usePipUi()

  return (
    <div className={cls}>
      <div className={styles.topbar}>
        <button className={styles.exit} aria-label="Salir del entrenamiento" onClick={onExit}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className={styles.blockCount}>
          BLOQUE {w.index + 1} / {blocks.length}
        </div>
        <div className={styles.right}>
          {pip.manual && (
            <button
              className={`${styles.pip} ${pip.open ? styles.pipOn : ''}`}
              aria-label={pip.open ? 'Cerrar ventana flotante' : 'Abrir ventana flotante'}
              aria-pressed={pip.open}
              onClick={pip.toggle}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor" />
              </svg>
              <span>{pip.open ? 'FLOTANDO' : 'FLOTANTE'}</span>
            </button>
          )}
          <div className={styles.elapsed}>{fmtTime(elapsed)}</div>
        </div>
      </div>
      <div className={styles.segments} aria-hidden="true">
        {blocks.map((b, i) => (
          <div key={b.id} className={styles.segment} style={{ flex: b.minutes }}>
            <div
              className={styles.fill}
              style={{ width: i < w.index || w.stage === 'done' ? '100%' : i === w.index ? `${progress * 100}%` : '0%' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
