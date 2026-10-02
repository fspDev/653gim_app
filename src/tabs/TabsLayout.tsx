import { NavLink, Outlet } from 'react-router-dom'
import styles from './TabsLayout.module.css'

const ICON = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const TABS = [
  { to: '/', label: 'Hoy', end: true, icon: <path d="M8 5v14l11-7z" /> },
  { to: '/progreso', label: 'Progreso', end: false, icon: <path d="M4 18l5-6 4 3 7-9" /> },
  {
    to: '/perfil',
    label: 'Perfil',
    end: false,
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </>
    ),
  },
]

/** Hoy / Progreso / Perfil con la barra de navegación de abajo. */
export function TabsLayout() {
  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <Outlet />
      </div>
      <nav className={styles.nav} aria-label="Principal">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={styles.tab}>
            <svg {...ICON} aria-hidden="true">
              {t.icon}
            </svg>
            {t.label}
            <span className={styles.bar} />
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
