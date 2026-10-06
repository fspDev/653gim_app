import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { SinAcceso } from '../auth/SinAcceso'
import { LogoMark } from '../ui/Logo'
import { Ejercicios } from './Ejercicios'
import { MiCuenta } from './MiCuenta'
import { MiRutina } from './MiRutina'
import { Estudiante } from './Estudiante'
import { Estudiantes } from './Estudiantes'
import styles from './Panel.module.css'

/** Panel del profe: estudiantes, su plan, registro, evolución y cuotas. Funciona en el celular y en la compu. */
export function Panel() {
  const { status, profile, signOut } = useAuth()

  if (status === 'loading') return null
  if (status === 'out') return <Navigate to="/ingreso" replace />
  if (status === 'sin-acceso') return <SinAcceso />
  if (!profile) return null
  if (profile.rol !== 'profe') return <Navigate to="/" replace />

  return (
    <div className={styles.layout}>
      <header className={styles.side}>
        <div className={styles.brand}>
          <LogoMark height={34} />
          <div className={styles.brandText}>
            <span className={styles.brandName}>653 GIMNASIO</span>
            <span className={styles.brandTag}>PANEL DEL PROFE</span>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Panel">
          <NavLink to="/panel" end className={styles.link}>
            Estudiantes
          </NavLink>
          <NavLink to="/panel/ejercicios" className={styles.link}>
            Ejercicios
          </NavLink>
          <NavLink to="/panel/mi-rutina" className={styles.link}>
            Mi rutina
          </NavLink>
          <NavLink to="/panel/cuenta" className={styles.link}>
            Mi cuenta
          </NavLink>
        </nav>
        <div className={styles.grow} />
        <div className={styles.who}>
          <NavLink to="/panel/cuenta" className={styles.whoName}>
            {profile.nombre} {profile.apellido}
          </NavLink>
          <button className={styles.out} onClick={() => void signOut()}>
            Salir
          </button>
        </div>
      </header>
      <Routes>
        <Route index element={<Estudiantes />} />
        <Route path="ejercicios" element={<Ejercicios />} />
        <Route path="mi-rutina/*" element={<MiRutina />} />
        <Route path="cuenta" element={<MiCuenta />} />
        <Route path="estudiante/:id/*" element={<Estudiante />} />
        <Route path="*" element={<Navigate to="/panel" replace />} />
      </Routes>
    </div>
  )
}
