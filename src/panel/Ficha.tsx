import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { problemaDni, soloDni } from '../cuentas'
import { estadoLabel, estadoManual, type CuotaManual } from '../cuotas'
import { bajaEstudiante, cambiarDni, updateFicha } from './api'
import { Credenciales, Dialog } from './Dialog'
import type { TabProps } from './Estudiante'
import ui from './ui.module.css'

const SIN_CUOTA: CuotaManual = { alDia: true, vence: null }

/** Datos del socio, su cuota marcada a mano, su usuario, cambio de DNI (= contraseña) y baja. */
export function Ficha({ d, reload }: TabProps) {
  const e = d.e
  const navigate = useNavigate()
  const inicial = {
    nombre: e.nombre,
    apellido: e.apellido,
    telefono: e.telefono ?? '',
    profe: e.profe ?? '',
    objetivo: e.objetivo ?? '',
    cuotaManual: e.cuotaManual ?? SIN_CUOTA,
  }
  const [f, setF] = useState(inicial)
  const [msg, setMsg] = useState<string | null>(null)
  const [dniOpen, setDniOpen] = useState(false)
  const [baja, setBaja] = useState(false)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(f) !== JSON.stringify(inicial)
  // Con monto cargado, el estado de la cuota sale de los pagos (pestaña Cuotas).
  const conMonto = !!e.cuota?.monto
  const setCuota = (patch: Partial<CuotaManual>) => setF({ ...f, cuotaManual: { ...f.cuotaManual, ...patch } })

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
        <div className={ui.cols2}>
          <label>
            <span className={ui.label}>TELÉFONO (WHATSAPP)</span>
            <input className={ui.input} inputMode="tel" value={f.telefono} onChange={(x) => setF({ ...f, telefono: x.target.value })} />
          </label>
          <label>
            <span className={ui.label}>PROFE</span>
            <input className={ui.input} placeholder="Opcional" value={f.profe} onChange={(x) => setF({ ...f, profe: x.target.value })} />
          </label>
        </div>
        <label>
          <span className={ui.label}>OBJETIVO</span>
          <textarea className={ui.textarea} rows={2} value={f.objetivo} onChange={(x) => setF({ ...f, objetivo: x.target.value })} />
        </label>

        <h2 className={ui.section}>CUOTA</h2>
        {conMonto ? (
          <p className={ui.hint}>Tiene una cuota mensual cargada: el estado sale de los pagos, en la pestaña Cuotas.</p>
        ) : (
          <div className={ui.card}>
            <div className={ui.switchRow}>
              <span>
                <strong>Cuota al día</strong>
                <span className={ui.hint} style={{ display: 'block' }}>
                  {estadoLabel(estadoManual(f.cuotaManual, Date.now()))}
                </span>
              </span>
              <button type="button" role="switch" aria-checked={f.cuotaManual.alDia} aria-label="Cuota al día" className={ui.switch} onClick={() => setCuota({ alDia: !f.cuotaManual.alDia })}>
                <span className={ui.knob} />
              </button>
            </div>
            <label>
              <span className={ui.label}>PAGADA HASTA</span>
              <input className={ui.input} type="date" value={f.cuotaManual.vence ?? ''} onChange={(x) => setCuota({ vence: x.target.value || null })} />
            </label>
            <div className={ui.hint} style={{ marginTop: 6 }}>
              Pasada esa fecha aparece vencida. Si preferís llevar montos y pagos, cargá la cuota mensual en la pestaña Cuotas.
            </div>
          </div>
        )}

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
        <div className={ui.credLabel} style={{ marginTop: 10 }}>
          DNI
        </div>
        <div className={ui.credValue}>{e.dni || '—'}</div>
        <p className={ui.hint}>
          Entra con su nombre y apellido y su DNI. Si se olvidó la contraseña, o cambió el DNI, cargalo de nuevo: la contraseña vuelve a ser el DNI y conserva su plan e historial.
          {f.nombre !== e.nombre || f.apellido !== e.apellido ? ' Cambiar el nombre no cambia el usuario.' : ''}
        </p>
        <div className={ui.actions} style={{ justifyContent: 'flex-start' }}>
          <button className={ui.secondary} onClick={() => setDniOpen(true)}>
            CAMBIAR DNI
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

      {dniOpen && <DniDialog d={d} onClose={() => (setDniOpen(false), reload())} />}
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

/** DNI nuevo (o el mismo, para resetear la contraseña olvidada): la contraseña pasa a ser ese DNI. */
function DniDialog({ d, onClose }: Pick<TabProps, 'd'> & { onClose: () => void }) {
  const [texto, setTexto] = useState(d.e.dni ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  const dni = soloDni(texto)
  const problema = dni ? problemaDni(dni) : 'Escribí el DNI.'

  if (hecho) {
    return (
      <Dialog title="LISTO" text={`Pasale estos datos a ${d.e.nombre}. La contraseña anterior ya no sirve.`} onClose={onClose}>
        <Credenciales username={d.e.username} clave={dni} nombre={d.e.nombre} telefono={d.e.telefono} />
        <div className={ui.actions}>
          <button className={ui.secondary} onClick={onClose}>
            CERRAR
          </button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog title="CAMBIAR DNI" text={`Para ${d.e.nombre} ${d.e.apellido} (${d.e.username}). La contraseña pasa a ser este DNI.`} onClose={onClose}>
      <form
        onSubmit={async (ev) => {
          ev.preventDefault()
          if (problema) return
          setBusy(true)
          setError(null)
          try {
            await cambiarDni(d.e, dni)
            setHecho(true)
          } catch {
            setError('No se pudo cambiar. Revisá la conexión y probá de nuevo.')
          }
          setBusy(false)
        }}
      >
        <label htmlFor="ficha-dni" className={ui.label}>
          DNI
        </label>
        <input id="ficha-dni" className={ui.input} inputMode="numeric" placeholder="Sin puntos" value={texto} onChange={(x) => setTexto(x.target.value)} aria-invalid={!!dni && !!problema} autoFocus />
        {dni && problema && (
          <div className={ui.hint} style={{ marginTop: 6 }}>
            {problema}
          </div>
        )}
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
