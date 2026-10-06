import styles from './ProfeNota.module.css'

/** Indicación del profe. No muestra nada si el ejercicio no tiene. */
export function ProfeNota({ note, compact = false }: { note?: string; compact?: boolean }) {
  if (!note) return null
  return (
    <div className={styles.box} data-compact={compact}>
      <p className={styles.note}>
        <svg className={styles.icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
        </svg>
        <span>{note}</span>
      </p>
    </div>
  )
}
