import { useNoteUi } from './noteContext'
import styles from './NotaEnVivo.module.css'

/**
 * La indicación del profe, siempre a la vista durante el ejercicio (hasta 2 líneas).
 * Tocándola se abre entera.
 */
export function NotaEnVivo({ note, className }: { note?: string; className?: string }) {
  const { open } = useNoteUi()
  if (!note) return null
  return (
    <button className={`${styles.nota} ${className ?? ''}`} onClick={open} aria-label={`Indicación del profe: ${note}. Tocá para ver más.`}>
      <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
      </svg>
      <span className={styles.text}>{note}</span>
    </button>
  )
}
