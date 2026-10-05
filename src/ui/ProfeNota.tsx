import { youtubeLink } from '../youtube'
import styles from './ProfeNota.module.css'

/** Indicación del profe y botón al video de técnica. No muestra nada si el ejercicio no tiene ninguno. */
export function ProfeNota({ note, video, compact = false }: { note?: string; video?: string; compact?: boolean }) {
  const link = video ? youtubeLink(video) : null
  if (!note && !link) return null
  return (
    <div className={styles.box} data-compact={compact}>
      {note && (
        <p className={styles.note}>
          <svg className={styles.icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
          <span>{note}</span>
        </p>
      )}
      {link && (
        <a className={styles.video} href={link} target="_blank" rel="noreferrer">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
          VER VIDEO
        </a>
      )}
    </div>
  )
}
