import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { normalizeUsername, problemaClave } from '../cuentas'
import { updateSettings, useSettings } from '../settings'
import { PALETTES } from '../theme'
import { guardarCuentaProfe } from './api'
import styles from './MiCuenta.module.css'
import ui from './ui.module.css'

/** Configuración del profe: nombre, usuario, contraseña y colores. */
export function MiCuenta() {
  const { profile } = useAuth()
  if (!profile) return null
  return (
    <main className={ui.page} style={{ maxWidth: 680 }}>
      <h1 className={ui.title}>MI CUENTA</h1>
      <div className={ui.sub}>Tus datos para entrar al panel y a la app.</div>
      <Datos />
      <Clave />
      <Colores />
      <h2 className={ui.section}>MI ENTRENO</h2>
      <p className={ui.hint}>Con la misma cuenta podés entrenar tu propia rutina en la app, como un estudiante.</p>
      <div className={ui.actions} style={{ justifyContent: 'flex-start' }}>
        <Link to="/panel/mi-rutina" className={ui.ghost}>
          Armar mi rutina
        </Link>
        <Link to="/" className={ui.primary}>
          ABRIR LA APP
        </Link>
      </div>
    </main>
  )
}

function Datos() {
  const { profile, refreshProfile } = useAuth()
  const [nombre, setNombre] = useState(profile?.nombre ?? '')
  const [apellido, setApellido] = useState(profile?.apellido ?? '')
  const [usuario, setUsuario] = useState(profile?.username ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!profile) return null
  const username = normalizeUsername(usuario)
  const dirty = nombre.trim() !== profile.nombre || apellido.trim() !== profile.apellido || username !== profile.username
  const ok = dirty && !!nombre.trim() && username.length >= 3

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    setMsg(null)
    try {
      await guardarCuentaProfe(profile, { nombre, apellido, username })
      setMsg({ ok: true, text: username !== profile.username ? `✓ Guardado. Desde ahora entrás con ${username}.` : '✓ Guardado.' })
      refreshProfile()
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error && err.message.includes('usuario') ? err.message : 'No se pudo guardar. Probá de nuevo.' })
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit}>
      <h2 className={ui.section}>DATOS</h2>
      <div className={ui.cols2}>
        <label>
          <span className={ui.label} style={{ marginTop: 0 }}>
            NOMBRE
          </span>
          <input className={ui.input} value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" />
        </label>
        <label>
          <span className={ui.label} style={{ marginTop: 0 }}>
            APELLIDO
          </span>
          <input className={ui.input} value={apellido} onChange={(e) => setApellido(e.target.value)} autoComplete="family-name" />
        </label>
      </div>
      <label>
        <span className={ui.label}>USUARIO</span>
        <input className={ui.input} value={usuario} onChange={(e) => setUsuario(e.target.value)} autoCapitalize="none" spellCheck={false} />
      </label>
      <div className={ui.hint} style={{ marginTop: 6 }}>
        {username !== profile.username && username ? `Vas a entrar con: ${username}` : 'Con este usuario entrás al panel y a la app.'}
      </div>
      {msg && <p className={msg.ok ? ui.ok : ui.error}>{msg.text}</p>}
      <div className={ui.actions}>
        <button type="submit" className={ui.secondary} disabled={!ok || busy}>
          {busy ? 'GUARDANDO…' : 'GUARDAR'}
        </button>
      </div>
    </form>
  )
}

function Clave() {
  const { cambiarClave } = useAuth()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const problema = nueva ? problemaClave(nueva) : null
  const ok = !!actual && !problemaClave(nueva) && nueva === repetir

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    setMsg(null)
    const r = await cambiarClave(actual, nueva)
    setBusy(false)
    if (r.ok) {
      setMsg({ ok: true, text: '✓ Contraseña cambiada.' })
      setActual('')
      setNueva('')
      setRepetir('')
    } else setMsg({ ok: false, text: r.reason === 'datos' ? 'La contraseña actual no es esa.' : r.reason === 'red' ? 'No hay conexión.' : 'No se pudo cambiar.' })
  }

  return (
    <form onSubmit={submit}>
      <h2 className={ui.section}>CONTRASEÑA</h2>
      <label>
        <span className={ui.label} style={{ marginTop: 0 }}>
          ACTUAL
        </span>
        <input className={ui.input} type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
      </label>
      <div className={ui.cols2}>
        <label>
          <span className={ui.label}>NUEVA</span>
          <input className={ui.input} type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </label>
        <label>
          <span className={ui.label}>REPETILA</span>
          <input className={ui.input} type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        </label>
      </div>
      <div className={ui.hint} style={{ marginTop: 6 }}>
        {problema ?? (repetir && nueva !== repetir ? 'No coinciden.' : 'No hay recuperación por mail: guardala bien.')}
      </div>
      {msg && <p className={msg.ok ? ui.ok : ui.error}>{msg.text}</p>}
      <div className={ui.actions}>
        <button type="submit" className={ui.secondary} disabled={!ok || busy}>
          {busy ? 'CAMBIANDO…' : 'CAMBIAR CONTRASEÑA'}
        </button>
      </div>
    </form>
  )
}

function Colores() {
  const { paleta } = useSettings()
  return (
    <>
      <h2 className={ui.section}>COLORES</h2>
      <p className={ui.hint}>Se guardan en este dispositivo.</p>
      <div className={styles.palettes} role="radiogroup" aria-label="Colores de fondo y texto">
        {PALETTES.map((p) => (
          <button key={p.id} className={styles.palette} role="radio" aria-checked={paleta === p.id} onClick={() => updateSettings({ paleta: p.id })}>
            <span className={styles.swatch} style={{ background: p.bg, color: p.ink }}>
              Aa
            </span>
            <span className={styles.name}>{p.nombre}</span>
          </button>
        ))}
      </div>
    </>
  )
}
