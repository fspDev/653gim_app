import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { EditorRutina } from './EditorRutina'
import styles from './Panel.module.css'
import { Socios } from './Socios'

/** Panel del profe (escritorio, fluido): solo para `rol = 'profe'`. */
export function Panel() {
  const { status, profile } = useAuth()

  if (status === 'loading') return null
  if (status === 'out') return <Navigate to="/ingreso" replace />
  if (status === 'local') {
    return (
      <main className={styles.note}>
        <h1 className={styles.noteTitle}>PANEL DEL PROFE</h1>
        <p>El panel necesita una cuenta de profe: salí del modo demo y entrá con tu usuario.</p>
      </main>
    )
  }
  if (!profile) return <main className={styles.note}>Cargando tu perfil…</main>
  if (profile.rol !== 'profe') return <Navigate to="/" replace />

  return (
    <div className={styles.layout}>
      <aside className={styles.side}>
        <div className={styles.logo}>653</div>
        <div className={styles.tag}>PANEL DEL PROFE</div>
        <NavLink to="/panel" end className={styles.link}>
          Socios
        </NavLink>
        {/* Sin diseño todavía (PLAN.md, pendientes de diseño de la fase 4). */}
        <span className={styles.soon} aria-disabled="true">
          Plantillas de rutina <small>pronto</small>
        </span>
        <span className={styles.soon} aria-disabled="true">
          Ejercicios <small>pronto</small>
        </span>
        <div className={styles.grow} />
        <div className={styles.who}>
          {profile.nombre || profile.email} · profe
        </div>
      </aside>
      <Routes>
        <Route index element={<Socios profeId={profile.id} />} />
        <Route path="socio/:id" element={<EditorRutina profeId={profile.id} />} />
        <Route path="*" element={<Navigate to="/panel" replace />} />
      </Routes>
    </div>
  )
}
