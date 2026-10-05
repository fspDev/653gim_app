import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { DAY_LIBRE } from '../data'
import { startWorkout } from '../workout/start'
import { Logo } from '../ui/Logo'
import styles from './SinRutina.module.css'

/** Hoy sin plan: el profe todavía no lo publicó; mientras tanto, un entreno libre corto. */
export function SinRutina() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const first = profile?.nombre.trim().split(/\s+/)[0]

  const start = async () => {
    await startWorkout(DAY_LIBRE)
    navigate('/entreno')
  }

  return (
    <main className={styles.page}>
      <Logo />
      <div className={styles.greeting}>{first ? `Buenas, ${first}.` : 'Buenas.'}</div>
      <div className={styles.eyebrow}>HOY TOCA</div>
      <div className={styles.title}>
        TODAVÍA
        <br />
        NADA.
      </div>
      {profile?.rol === 'profe' ? (
        <>
          <p className={styles.text}>Todavía no armaste tu rutina. La armás desde el panel, igual que la de tus estudiantes.</p>
          <button className={styles.notify} onClick={() => navigate('/panel/mi-rutina')}>
            ARMAR MI RUTINA
          </button>
        </>
      ) : (
        <p className={styles.text}>
          {profile?.profeNombre ? `${profile.profeNombre.split(/\s+/)[0]} todavía` : 'Tu profe todavía'} no te armó el plan. Apenas lo publique, aparece acá.
        </p>
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
