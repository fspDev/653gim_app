import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { DAY_LIBRE } from '../data'
import { startWorkout } from '../workout/start'
import styles from './SinRutina.module.css'

/** Hoy sin rutina (SinRutina.dc.html): estado vacío con aviso al profe y un entreno libre corto mientras tanto. */
export function SinRutina() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const first = profile?.nombre.trim().split(/\s+/)[0]
  const mailto = profile?.profeEmail
    ? `mailto:${profile.profeEmail}?subject=${encodeURIComponent('Mi rutina en 653')}&body=${encodeURIComponent(`Hola${profile.profeNombre ? ` ${profile.profeNombre.split(/\s+/)[0]}` : ''}, todavía no me aparece la rutina en la app. ¿Me la cargás? Gracias.`)}`
    : null

  const start = async () => {
    await startWorkout(DAY_LIBRE)
    navigate('/entreno')
  }

  return (
    <main className={styles.page}>
      <div className={styles.logo}>653</div>
      <div className={styles.greeting}>{first ? `Buenas, ${first}.` : 'Buenas.'}</div>
      <div className={styles.eyebrow}>HOY TOCA</div>
      <div className={styles.title}>
        TODAVÍA
        <br />
        NADA.
      </div>
      <p className={styles.text}>Tu profe todavía no te armó la rutina. Apenas la cargue, aparece acá.</p>
      {mailto && (
        <a className={styles.notify} href={mailto}>
          AVISARLE A MI PROFE
        </a>
      )}

      <div className={styles.grow} />

      <section className={styles.card} aria-label="Mientras tanto">
        <div className={styles.cardLabel}>MIENTRAS TANTO</div>
        <div className={styles.cardTitle}>BICI + ELONGACIÓN · 20 MIN</div>
        <button className={styles.start} onClick={() => void start()}>
          EMPEZAR
        </button>
      </section>
    </main>
  )
}
