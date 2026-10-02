import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'
import styles from './Shell.module.css'

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Congela la zona útil (hay una hoja modal encima). */
  inertFrame?: boolean
  /** Hoja o capa que se dibuja sobre la zona útil. */
  overlay?: ReactNode
}

const DESIGN_HEIGHT = 844
const MIN_K = 0.62

/**
 * Pantalla de alto completo (100dvh), hasta 480 px de ancho, con zona útil bajo el notch.
 * Mide el alto real y expone `--h` (px) y `--k` (alto / 844, entre 0,62 y 1) para que cada vista
 * escale sus medidas verticales: el diseño es de 844 px y con las barras del navegador quedan 640–760.
 */
export function Shell({ children, inertFrame, overlay, className, ...rest }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const f = frame.current
    const s = stage.current
    if (!f || !s) return
    const apply = () => {
      const h = f.getBoundingClientRect().height
      s.style.setProperty('--h', `${h}px`)
      s.style.setProperty('--k', String(Math.min(1, Math.max(MIN_K, h / DESIGN_HEIGHT))))
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(f)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={stage} className={`${styles.stage} ${className ?? ''}`} {...rest}>
      <div ref={frame} className={styles.frame} inert={inertFrame}>
        {children}
      </div>
      {overlay}
    </div>
  )
}

export function SrOnly({ children }: { children: ReactNode }) {
  return (
    <span className={styles.srOnly} aria-live="polite">
      {children}
    </span>
  )
}
