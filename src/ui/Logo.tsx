import logo from '../assets/logo653.png'
import logoOscuro from '../assets/logo653-oscuro.png'
import marca from '../assets/marca653.png'
import marcaOscuro from '../assets/marca653-oscuro.png'
import styles from './Logo.module.css'

/**
 * El logo es una imagen (scripts/logo.ps1) con una versión para fondo claro y otra con los grises aclarados
 * para fondo oscuro. Se elige según la paleta (`data-scheme` en <html>); `inverse` es para superficies que van
 * al revés del fondo (el encabezado oscuro del resumen sobre una paleta clara, por ejemplo).
 */
function Img({ claro, oscuro, height, width, inverse }: { claro: string; oscuro: string; height?: number; width?: number; inverse: boolean }) {
  return (
    <span className={styles.img} data-inverse={inverse} aria-hidden="true">
      <img className={styles.claro} src={claro} alt="" height={height} width={width} />
      <img className={styles.oscuro} src={oscuro} alt="" height={height} width={width} />
    </span>
  )
}

/** El "653" del logo, sin "gym & fitness". */
export function LogoMark({ height = 28, inverse = false }: { height?: number; inverse?: boolean }) {
  return <Img claro={marca} oscuro={marcaOscuro} height={height} inverse={inverse} />
}

/** El logo completo, tal cual el original. */
export function LogoCompleto({ width = 200, inverse = false }: { width?: number; inverse?: boolean }) {
  return (
    <div role="img" aria-label="653 Gimnasio">
      <Img claro={logo} oscuro={logoOscuro} width={width} inverse={inverse} />
    </div>
  )
}

/** Encabezados: la marca + "GIMNASIO". `lg` es el logo completo (tarjeta para compartir). */
export function Logo({ size = 'sm', inverse = false }: { size?: 'sm' | 'lg'; inverse?: boolean }) {
  if (size === 'lg') return <LogoCompleto width={420} inverse={inverse} />
  return (
    <div className={styles.logo} role="img" aria-label="653 Gimnasio">
      <LogoMark height={30} inverse={inverse} />
      <span className={styles.name}>GIMNASIO</span>
    </div>
  )
}
