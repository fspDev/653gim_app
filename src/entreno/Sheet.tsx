import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Sheet.module.css'

interface Props {
  label: string
  onClose: () => void
  children: ReactNode
}

/** Hoja inferior modal sobre la pantalla actual (Salir, Registro). Escape y tocar el fondo la cierran. */
export function Sheet({ label, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Foco al primer botón de la hoja para que el teclado y los lectores arranquen ahí.
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div ref={ref} className={styles.sheet} role="dialog" aria-modal="true" aria-label={label}>
        <div className={styles.handle} aria-hidden="true" />
        {children}
      </div>
    </>
  )
}
