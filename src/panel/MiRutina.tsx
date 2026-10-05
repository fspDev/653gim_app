import { useEffect, useState } from 'react'
import { useAuth } from '../auth/context'
import { asegurarFichaProfe } from './api'
import { Estudiante } from './Estudiante'
import ui from './ui.module.css'

/** La rutina propia del profe: la arma con el mismo editor y la entrena con la app. */
export function MiRutina() {
  const { profile } = useAuth()
  const [sid, setSid] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!profile) return
    asegurarFichaProfe(profile)
      .then(setSid)
      .catch(() => setError(true))
  }, [profile])

  if (error) {
    return (
      <main className={ui.page}>
        <p className={ui.error}>No pudimos abrir tu rutina. Revisá la conexión y probá de nuevo.</p>
      </main>
    )
  }
  if (!sid) return <main className={ui.page} />
  return <Estudiante sid={sid} propio />
}
