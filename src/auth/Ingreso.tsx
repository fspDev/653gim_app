import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './context'
import styles from './Auth.module.css'

const MESSAGES = {
  datos: 'Revisá los datos: tienen que estar igual que en recepción.',
  red: 'No hay conexión. Probá de nuevo con señal.',
  muchos: 'Demasiados intentos. Esperá unos minutos.',
  otro: 'No pudimos hacerte entrar. Probá de nuevo.',
}

/** Ingreso: nombre y apellido + DNI (las mismas cuentas de siempre). El profe entra con su usuario. */
export function Ingreso() {
  const { status, profile, loginSocio, loginProfe } = useAuth()
  const [modo, setModo] = useState<'socio' | 'profe'>('socio')
  const [nombre, setNombre] = useState('')
  const [clave, setClave] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<keyof typeof MESSAGES | null>(null)

  if (status === 'in' && profile) return <Navigate to={profile.rol === 'profe' ? '/panel' : '/'} replace />

  const esSocio = modo === 'socio'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || !clave.trim() || sending) return
    setSending(true)
    setError(null)
    const r = esSocio ? await loginSocio(nombre, clave) : await loginProfe(nombre, clave)
    setSending(false)
    if (!r.ok) setError(r.reason)
  }

  const cambiar = () => {
    setModo(esSocio ? 'profe' : 'socio')
    setNombre('')
    setClave('')
    setError(null)
  }

  return (
    <form className={styles.page} onSubmit={submit} noValidate>
      <div className={styles.logo}>653</div>
      <div className={styles.serie}>{esSocio ? 'GYM & FITNESS' : 'PANEL DEL PROFE'}</div>
      <p className={styles.lead}>
        {esSocio ? 'Tus entrenos, los que te arma tu profe. Apretás empezar y la app te lleva.' : 'Armá rutinas y seguí a tus socios.'}
      </p>
      <div className={styles.grow} />

      <label htmlFor="nombre" className={styles.label}>
        {esSocio ? 'NOMBRE Y APELLIDO' : 'USUARIO'}
      </label>
      <input
        id="nombre"
        className={styles.input}
        type="text"
        autoComplete="username"
        autoCapitalize={esSocio ? 'words' : 'none'}
        placeholder={esSocio ? 'Como te anotaron en recepción' : 'Admin'}
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <label htmlFor="clave" className={`${styles.label} ${styles.labelGap}`}>
        {esSocio ? 'DNI' : 'CONTRASEÑA'}
      </label>
      <input
        id="clave"
        className={styles.input}
        type="password"
        inputMode={esSocio ? 'numeric' : undefined}
        autoComplete="current-password"
        value={clave}
        onChange={(e) => setClave(e.target.value)}
        aria-describedby="ingreso-ayuda"
        aria-invalid={error === 'datos'}
      />
      <div id="ingreso-ayuda" className={styles.help} role={error ? 'alert' : undefined}>
        {error ? MESSAGES[error] : esSocio ? 'Sin puntos, como figura en tu documento.' : ' '}
      </div>
      <button className={styles.primary} type="submit" disabled={sending || !nombre.trim() || !clave.trim()}>
        {sending ? 'ENTRANDO…' : 'ENTRAR'}
      </button>
      <button type="button" className={`${styles.foot} ${styles.switch}`} onClick={cambiar}>
        {esSocio ? 'Soy profe' : 'Soy socio'}
      </button>
    </form>
  )
}
