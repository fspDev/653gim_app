import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { generarClave, problemaClave } from '../cuentas'
import { bajaEstudiante, resetClave, updateFicha } from './api'
import { Credenciales, Dialog } from './Dialog'
import type { TabProps } from './Estudiante'
import ui from './ui.module.css'

/** Datos del estudiante, su usuario, contraseña nueva y baja. */
export function Ficha({ d, reload }: TabProps) {
  const e = d.e
  const navigate = useNavigate()
  const [f, setF] = useState({ nombre: e.nombre, apellido: e.apellido, telefono: e.telefono ?? '', objetivo: e.objetivo ?? '' })
  const [msg, setMsg] = useState<string | null>(null)
  const [reset, setReset] = useState(false)
  const [baja, setBaja] = useState(false)
  const [busy, setBusy] = useState(false)
  const dirty = f.nombre !== e.nombre || f.apellido !== e.apellido || f.telefono !== (e.telefono ?? '') || f.objetivo !== (e.objetivo ?? '')

  const guardar = async (ev: FormEvent) => {
    ev.preventDefault()
    setMsg(null)
    try {
      await updateFicha(e.id, f)
      setMsg('✓ Guardado')
      reload()
    } catch {
      setMsg('No se pudo guardar. Probá de nuevo.')
    }
  }

  return (
    <section style={{ maxWidth: 620 }}>
      <h2 className={ui.section}>DATOS</h2>
      <form onSubmit={guardar}>
        <div className={ui.cols2}>
          <label>
            <span className={ui.label} style={{ marginTop: 0 }}>
              NOMBRE
            </span>
            <input className={ui.input} value={f.nombre} onChange={(x) => setF({ ...f, nombre: x.target.value })} />
          </label>
          <label>
            <span className={ui.label} style={{ marginTop: 0 }}>
              APELLIDO
            </span>
            <input className={ui.input} value={f.apellido} onChange={(x) => setF({ ...f, apellido: x.target.value })} />
          </label>
        </div>
        <label>
          <span className={ui.label}>TELÉFONO (WHATSAPP)</span>
          <input className={ui.input} inputMode="tel" value={f.telefono} onChange={(x) => setF({ ...f, telefono: x.target.value })} />
        </label>
        <label>
          <span className={ui.label}>OBJETIVO</span>
          <textarea className={ui.textarea} rows={2} value={f.objetivo} onChange={(x) => setF({ ...f, objetivo: x.target.value })} />
        </label>
        <div className={ui.actions}>
          {msg && <span className={ui.hint}>{msg}</span>}
          <button type="submit" className={ui.secondary} disabled={!dirty || !f.nombre.trim()}>
            GUARDAR
          </button>
        </div>
      </form>

      <h2 className={ui.section}>CUENTA</h2>
      <div className={ui.card}>
        <div className={ui.credLabel}>Usuario</div>
        <div className={ui.credValue}>{e.username}</div>
        <p className={ui.hint}>
          Entra con este usuario y su contraseña. Si se la olvidó, generale una nueva: la anterior deja de funcionar y conserva su plan e historial.
          {f.nombre !== e.nombre || f.apellido !== e.apellido ? ' Cambiar el nombre no cambia el usuario.' : ''}
        </p>
        <div className={ui.actions} style={{ justifyContent: 'flex-start' }}>
          <button className={ui.secondary} onClick={() => setReset(true)}>
            NUEVA CONTRASEÑA
          </button>
        </div>
      </div>

      <h2 className={ui.section}>BAJA</h2>
      <p className={ui.hint}>Borra su ficha, su plan, su historial, sus pagos y sus medidas. No se puede deshacer.</p>
      <div className={ui.actions} style={{ justifyContent: 'flex-start' }}>
        <button className={ui.danger} onClick={() => setBaja(true)}>
          Dar de baja
        </button>
      </div>

      {reset && <ResetDialog d={d} onClose={() => (setReset(false), reload())} />}
      {baja && (
        <Dialog title="¿DAR DE BAJA?" text={`Se borra todo lo de ${e.nombre} ${e.apellido}: plan, entrenos, pagos y medidas. No se puede deshacer.`} onClose={() => setBaja(false)}>
          <div className={ui.actions}>
            <button className={ui.link} onClick={() => setBaja(false)}>
              No
            </button>
            <button
              className={ui.danger}
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await bajaEstudiante(e)
                  navigate('/panel', { replace: true })
                } catch {
                  setBusy(false)
                  setBaja(false)
                  setMsg('No se pudo dar de baja. Probá de nuevo.')
                }
              }}
            >
              {busy ? 'BORRANDO…' : 'SÍ, DAR DE BAJA'}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  )
}

function ResetDialog({ d, onClose }: Pick<TabProps, 'd'> & { onClose: () => void }) {
  const [clave, setClave] = useState(generarClave)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  const problema = problemaClave(clave)

  if (hecho) {
    return (
      <Dialog title="CONTRASEÑA NUEVA" text={`Pasale estos datos a ${d.e.nombre}. La contraseña anterior ya no sirve.`} onClose={onClose}>
        <Credenciales username={d.e.username} clave={clave} nombre={d.e.nombre} telefono={d.e.telefono} />
        <div className={ui.actions}>
          <button className={ui.secondary} onClick={onClose}>
            CERRAR
          </button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog title="NUEVA CONTRASEÑA" text={`Para ${d.e.nombre} ${d.e.apellido} (${d.e.username}).`} onClose={onClose}>
      <form
        onSubmit={async (ev) => {
          ev.preventDefault()
          if (problema) return
          setBusy(true)
          setError(null)
          try {
            await resetClave(d.e, clave)
            setHecho(true)
          } catch {
            setError('No se pudo cambiar. Revisá la conexión y probá de nuevo.')
          }
          setBusy(false)
        }}
      >
        <label htmlFor="reset-clave" className={ui.label}>
          CONTRASEÑA
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <input id="reset-clave" className={ui.input} value={clave} onChange={(x) => setClave(x.target.value.trim())} aria-invalid={!!problema} spellCheck={false} autoFocus />
          <button type="button" className={ui.ghost} onClick={() => setClave(generarClave())}>
            Otra
          </button>
        </div>
        <div className={ui.hint} style={{ marginTop: 6 }}>
          {problema ?? 'Después la puede cambiar desde su Perfil.'}
        </div>
        {error && <p className={ui.error}>{error}</p>}
        <div className={ui.actions}>
          <button type="button" className={ui.link} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={ui.primary} disabled={!!problema || busy}>
            {busy ? 'CAMBIANDO…' : 'CAMBIAR'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
