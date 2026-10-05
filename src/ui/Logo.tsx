import styles from './Logo.module.css'

/** "653" en la tipografía de la marca, del color del texto. `accent` pinta el número con el acento. */
export function LogoMark({ height = 28, accent }: { height?: number; accent?: string }) {
  return (
    <span className={styles.mark} style={{ fontSize: height, color: accent }} aria-hidden="true">
      653
    </span>
  )
}

/** Logo completo: "653" + "GYM & FITNESS". */
export function Logo({ size = 'sm', accent }: { size?: 'sm' | 'lg'; accent?: string }) {
  return (
    <div className={styles.logo} data-size={size} role="img" aria-label="653 Gym & Fitness">
      <LogoMark height={size === 'lg' ? 150 : 30} accent={accent} />
      <div className={styles.words}>
        <span className={styles.name}>GYM &amp; FITNESS</span>
        <span className={styles.tag}>SEISCINCUENTAYTRES</span>
      </div>
    </div>
  )
}
