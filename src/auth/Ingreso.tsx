import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { problemaClave, usernameFrom } from '../cuentas'
import { LogoCompleto } from '../ui/Logo'
import { useAuth, type LoginResult } from './context'
import styles from './Auth.module.css'

type Reason = Extract<LoginResult, { ok: false }>['reason']

const MESSAGES: Record<Reason, string> = {
  datos: 'Usuario o contraseña incorrectos. Si no te acordás, pedile a tu profe que te la resetee.',
  red: 'No hay conexión. Probá de nuevo con señal.',
  muchos: 'Demasiados intentos. Esperá unos minutos.',
  existe: 'Ya existe esa cuenta.',
  debil: 'La contraseña es muy corta.',
  'ya-hay-profe': 'La cuenta del profe ya está creada: entrá con tu usuario.',
  otro: 'No pudimos hacerte entrar. Probá de nuevo.',
}

/** Ingreso con usuario (nombre.apellido) y contraseña. La primera vez, ofrece crear la cuenta del profe. */
export function Ingreso() {
  const { status, profile, profeConfigurado } = useAuth()
  const [modo, setModo] = useState<'entrar' | 'profe'>('entrar')

  if (status === 'in' && profile) return <Navigate to={profile.rol === 'profe' ? '/panel' : '/'} replace />

  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <LogoCompleto width={220} />
      </div>
      {modo === 'entrar' ? (
        <Entrar onCrearProfe={profeConfigurado === false ? () => setModo('profe') : null} />
      ) : (
        <CrearProfe onVolver={() => setModo('entrar')} />
      )}
    </div>
  )
}

function Entrar({ onCrearProfe }: { onCrearProfe: (() => void) | null }) {
  const { login } = useAuth()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<Reason | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!usuario.trim() || !clave || sending) return
    setSending(true)
    setError(null)
    const r = await login(usuario, clave)
    setSending(false)
    if (!r.ok) setError(r.reason)
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <p className={styles.lead}>Tu rutina, la que te arma tu profe. Apretás empezar y la app te lleva.</p>
      <div className={styles.grow} />
      <label htmlFor="usuario" className={styles.label}>
        USUARIO
      </label>
      <input
        id="usuario"
        className={styles.input}
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Nombre Apellido"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
      />
      <label htmlFor="clave" className={`${styles.label} ${styles.labelGap}`}>
        CONTRASEÑA
      </label>
      <input
        id="clave"
        className={styles.input}
        type="password"
        autoComplete="current-password"
        value={clave}
        onChange={(e) => setClave(e.target.value)}
        aria-describedby="ingreso-ayuda"
        aria-invalid={error === 'datos'}
      />
      <div id="ingreso-ayuda" className={styles.help} data-error={!!error} role={error ? 'alert' : undefined}>
        {error ? MESSAGES[error] : 'Tu nombre y apellido. Si nunca la cambiaste, la contraseña es tu DNI (sin puntos).'}
      </div>
      <button className={styles.primary} type="submit" disabled={sending || !usuario.trim() || !clave}>
        {sending ? 'ENTRANDO…' : 'ENTRAR'}
      </button>
      {onCrearProfe && (
        <button type="button" className={styles.switch} onClick={onCrearProfe}>
          Primera vez: crear la cuenta del profe
        </button>
      )}
    </form>
  )
}

function CrearProfe({ onVolver }: { onVolver: () => void }) {
  const { crearProfe } = useAuth()
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [clave, setClave] = useState('')
  const [clave2, setClave2] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const username = usernameFrom(nombre, apellido)
  const problema = clave ? problemaClave(clave) : null
  const ok = !!nombre.trim() && !!apellido.trim() && !problemaClave(clave) && clave === clave2

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ok || sending) return
    setSending(true)
    setError(null)
    const r = await crearProfe({ nombre, apellido, clave })
    setSending(false)
    if (!r.ok) setError(MESSAGES[r.reason])
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <p className={styles.lead}>Cuenta del profe. Se hace una sola vez: desde ahí das de alta a tus estudiantes.</p>
      <div className={styles.grow} />
      <div className={styles.twoCols}>
        <div>
          <label htmlFor="p-nombre" className={styles.label}>
            NOMBRE
          </label>
          <input id="p-nombre" className={styles.input} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" />
        </div>
        <div>
          <label htmlFor="p-apellido" className={styles.label}>
            APELLIDO
          </label>
          <input id="p-apellido" className={styles.input} value={apellido} onChange={(e) => setApellido(e.target.value)} autoComplete="family-name" />
        </div>
      </div>
      <div className={styles.help}>{username ? `Tu usuario va a ser ${username}` : ' '}</div>
      <label htmlFor="p-clave" className={`${styles.label} ${styles.labelGap}`}>
        CONTRASEÑA
      </label>
      <input id="p-clave" className={styles.input} type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
      <label htmlFor="p-clave2" className={`${styles.label} ${styles.labelGap}`}>
        REPETILA
      </label>
      <input id="p-clave2" className={styles.input} type="password" autoComplete="new-password" value={clave2} onChange={(e) => setClave2(e.target.value)} />
      <div className={styles.help} data-error={!!error} role={error ? 'alert' : undefined}>
        {error ?? problema ?? (clave2 && clave !== clave2 ? 'Las contraseñas no coinciden.' : 'Guardala bien: no hay recuperación por mail.')}
      </div>
      <button className={styles.primary} type="submit" disabled={!ok || sending}>
        {sending ? 'CREANDO…' : 'CREAR CUENTA'}
      </button>
      <button type="button" className={styles.switch} onClick={onVolver}>
        Volver
      </button>
    </form>
  )
}
