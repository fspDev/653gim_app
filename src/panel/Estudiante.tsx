import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { estadoCuota, estadoLabel } from '../cuotas'
import { fullName, loadEstudiante, type Detalle } from './api'
import { Cuotas } from './Cuotas'
import { EditorPlan } from './EditorPlan'
import styles from './Estudiante.module.css'
import { Evolucion } from './Evolucion'
import { Ficha } from './Ficha'
import { cuotaTone, lastLabel } from './listado'
import { Registro } from './Registro'
import ui from './ui.module.css'

const TABS = [
  { to: '', label: 'Plan', end: true },
  { to: 'registro', label: 'Registro' },
  { to: 'evolucion', label: 'Evolución' },
  { to: 'cuotas', label: 'Cuotas', soloEstudiantes: true },
  { to: 'cuenta', label: 'Cuenta', soloEstudiantes: true },
]

export interface TabProps {
  d: Detalle
  reload: () => void
}

/** Ficha de un estudiante, o la rutina propia del profe (`propio`: sin cuotas ni cuenta). */
export function Estudiante({ sid: sidProp, propio = false }: { sid?: string; propio?: boolean }) {
  const param = useParams().id
  const sid = sidProp ?? param ?? ''
  const base = propio ? '/panel/mi-rutina' : `/panel/estudiante/${sid}`
  const [d, setD] = useState<Detalle | null | undefined>(undefined)
  const [error, setError] = useState(false)
  const [now] = useState(() => Date.now())

  const reload = useCallback(() => {
    loadEstudiante(sid)
      .then((x) => {
        setError(false)
        setD(x)
      })
      .catch(() => setError(true))
  }, [sid])

  useEffect(reload, [reload])

  const back = (
    <Link to="/panel" className={styles.back}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {propio ? 'Panel' : 'Socios'}
    </Link>
  )

  if (error && !d) {
    return (
      <main className={ui.page}>
        {back}
        <p className={ui.error} role="alert">
          No pudimos cargar al socio. Revisá la conexión y probá de nuevo.
        </p>
      </main>
    )
  }
  if (d === undefined) return <main className={ui.page}>{back}</main>
  if (d === null) return <Navigate to="/panel" replace />

  const last = d.entrenos[0]?.empezadoAt ?? null
  const cuota = estadoCuota(d.e.cuota, d.pagos, d.e.createdAt, now, d.e.cuotaManual)
  const tone = cuotaTone(cuota)

  return (
    <main className={ui.page}>
      {back}
      <div className={styles.head}>
        <div className={styles.avatar} aria-hidden="true">
          {d.e.nombre.charAt(0).toUpperCase()}
        </div>
        <div className={styles.headText}>
          <h1 className={styles.name}>{fullName(d.e).toUpperCase()}</h1>
          <div className={ui.sub}>
            {propio ? 'Tu rutina' : d.e.username} · último entreno: {lastLabel(last, now).toLowerCase()}
            {d.e.objetivo && ` · ${d.e.objetivo}`}
          </div>
        </div>
        {propio && (
          <Link to="/" className={ui.primary}>
            ENTRENAR
          </Link>
        )}
        {!propio && tone && (
          <span className={ui.badge} data-tone={tone}>
            {tone === 'alerta' && '! '}
            {estadoLabel(cuota)}
          </span>
        )}
      </div>

      <nav className={styles.tabs} aria-label="Secciones del socio">
        {TABS.filter((t) => !(propio && t.soloEstudiantes)).map((t) => (
          <NavLink key={t.label} to={`${base}${t.to ? `/${t.to}` : ''}`} end={t.end} className={styles.tab}>
            {t.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route index element={<EditorPlan d={d} reload={reload} />} />
        <Route path="registro" element={<Registro d={d} reload={reload} />} />
        <Route path="evolucion" element={<Evolucion d={d} reload={reload} />} />
        {!propio && <Route path="cuotas" element={<Cuotas d={d} reload={reload} />} />}
        {!propio && <Route path="cuenta" element={<Ficha d={d} reload={reload} />} />}
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </main>
  )
}
