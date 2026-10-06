import { useState, type FormEvent } from 'react'
import { addMonths, estadoCuota, estadoLabel, fmtPesos, mesesCorrespondientes, periodoLabel, periodoOf, type Medio } from '../cuotas'
import { localDateKey } from '../keys'
import { borrarPago, guardarCuota, registrarPago } from './api'
import styles from './Cuotas.module.css'
import type { TabProps } from './Estudiante'
import { cuotaTone } from './listado'
import ui from './ui.module.css'
import { whatsappLink } from './whatsapp'

const MEDIOS: { value: Medio; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'otro', label: 'Otro' },
]

/** Cuota mensual: cuánto y cuándo vence, qué meses pagó y cuáles debe, y el registro de pagos. */
export function Cuotas({ d, reload }: TabProps) {
  const sid = d.e.id
  const [now] = useState(() => Date.now())
  const [monto, setMonto] = useState(String(d.e.cuota?.monto || ''))
  const [dia, setDia] = useState(d.e.cuota?.dia ?? 10)
  const [msg, setMsg] = useState<string | null>(null)
  const [pagar, setPagar] = useState<string | null>(null)
  const estado = estadoCuota(d.e.cuota, d.pagos, d.e.createdAt, now, d.e.cuotaManual)
  const tone = cuotaTone(estado)
  const pagados = new Map(d.pagos.map((p) => [p.periodo, p]))
  // Los meses que corresponden y el que viene (para poder adelantar).
  const meses = [...mesesCorrespondientes(d.e.createdAt, now), addMonths(periodoOf(new Date(now)), 1)].reverse()
  const cfgDirty = Number(monto || 0) !== (d.e.cuota?.monto ?? 0) || dia !== (d.e.cuota?.dia ?? 10)
  const first = d.e.nombre.split(/\s+/)[0]
  const recordatorio =
    estado.tipo === 'vencida' || estado.tipo === 'por-vencer'
      ? whatsappLink(
          d.e.telefono,
          // Sin monto la cuota se marca a mano (Ficha): el mensaje no habla de meses ni de pesos.
          !d.e.cuota?.monto
            ? estado.tipo === 'vencida'
              ? `Hola ${first}! Te recuerdo que tenés la cuota pendiente. ¡Gracias!`
              : `Hola ${first}! Te recuerdo que el ${Number(estado.vence.slice(8))}/${Number(estado.vence.slice(5, 7))} vence tu cuota. ¡Gracias!`
            : estado.tipo === 'vencida'
              ? `Hola ${first}! Te recuerdo que está pendiente la cuota de ${estado.meses.map((m) => periodoLabel(m, true)).join(', ')} (${fmtPesos(d.e.cuota.monto)} por mes). ¡Gracias!`
              : `Hola ${first}! Te recuerdo que el ${Number(estado.vence.slice(8))} vence la cuota de ${periodoLabel(estado.vence.slice(0, 7), true)} (${fmtPesos(d.e.cuota.monto)}). ¡Gracias!`,
        )
      : null

  const guardar = async () => {
    setMsg(null)
    try {
      await guardarCuota(sid, { monto: Number(monto || 0), dia })
      setMsg('✓ Guardado')
      reload()
    } catch {
      setMsg('No se pudo guardar.')
    }
  }

  return (
    <section>
      <div className={styles.grid}>
        <div className={ui.card}>
          <div className={styles.estadoLabel}>ESTADO</div>
          <div className={styles.estado}>
            {tone ? (
              <span className={ui.badge} data-tone={tone} style={{ fontSize: 15, height: 32, padding: '0 14px' }}>
                {tone === 'alerta' && '! '}
                {estadoLabel(estado)}
              </span>
            ) : (
              'Sin cuota'
            )}
          </div>
          {recordatorio && (
            <a className={ui.primary} style={{ marginTop: 14 }} href={recordatorio} target="_blank" rel="noreferrer">
              Recordarle por WhatsApp
            </a>
          )}
          {!d.e.telefono && estado.tipo === 'vencida' && <p className={ui.hint}>Cargá su teléfono en Cuenta para mandarle un recordatorio.</p>}
        </div>

        <div className={ui.card}>
          <div className={ui.cols2}>
            <label>
              <span className={ui.label} style={{ marginTop: 0 }}>
                CUOTA MENSUAL ($)
              </span>
              <input className={ui.input} style={{ background: 'var(--bg)' }} inputMode="numeric" placeholder="0 = sin cuota" value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))} />
            </label>
            <label>
              <span className={ui.label} style={{ marginTop: 0 }}>
                VENCE EL DÍA
              </span>
              <select className={ui.select} style={{ background: 'var(--bg)' }} value={dia} onChange={(e) => setDia(Number(e.target.value))}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={ui.actions}>
            {msg && <span className={ui.hint}>{msg}</span>}
            <button className={ui.secondary} disabled={!cfgDirty} onClick={() => void guardar()}>
              GUARDAR
            </button>
          </div>
        </div>
      </div>

      <h2 className={ui.section}>MESES</h2>
      <ul className={styles.months}>
        {meses.map((p) => {
          const pago = pagados.get(p)
          const futuro = p > periodoOf(new Date(now))
          return (
            <li key={p} className={styles.month} data-state={pago ? 'pago' : futuro ? 'futuro' : 'debe'}>
              <div>
                <div className={styles.monthName}>{periodoLabel(p)}</div>
                <div className={ui.hint}>
                  {pago
                    ? `Pagó ${fmtPesos(pago.monto)} el ${new Date(`${pago.fecha}T12:00:00`).toLocaleDateString('es-AR')} · ${MEDIOS.find((m) => m.value === pago.medio)?.label ?? ''}${pago.nota ? ` · ${pago.nota}` : ''}`
                    : futuro
                      ? 'Próximo mes'
                      : 'Sin pagar'}
                </div>
              </div>
              {pago ? (
                <div className={styles.monthActions}>
                  <span className={ui.badge} data-tone="ok">
                    ✓ Pagado
                  </span>
                  <button
                    className={ui.iconBtn}
                    aria-label={`Borrar el pago de ${periodoLabel(p)}`}
                    onClick={() => {
                      if (confirm(`¿Borrar el pago de ${periodoLabel(p)}?`)) void borrarPago(sid, pago.id).then(reload)
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button className={futuro ? ui.ghost : ui.secondary} onClick={() => setPagar(p)}>
                  {futuro ? 'Adelantar' : 'Registrar pago'}
                </button>
              )}
              {pagar === p && <PagoForm sid={sid} periodo={p} monto={d.e.cuota?.monto ?? 0} onDone={() => (setPagar(null), reload())} onCancel={() => setPagar(null)} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function PagoForm({ sid, periodo, monto, onDone, onCancel }: { sid: string; periodo: string; monto: number; onDone: () => void; onCancel: () => void }) {
  const [m, setM] = useState(String(monto || ''))
  const [fecha, setFecha] = useState(localDateKey())
  const [medio, setMedio] = useState<Medio>('efectivo')
  const [nota, setNota] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(false)
    try {
      await registrarPago(sid, { periodo, monto: Number(m || 0), fecha, medio, nota: nota.trim() })
      onDone()
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <form className={styles.pagoForm} onSubmit={submit}>
      <div className={styles.pagoFields}>
        <label>
          <span className={ui.label}>MONTO ($)</span>
          <input className={ui.input} inputMode="numeric" value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, ''))} autoFocus />
        </label>
        <label>
          <span className={ui.label}>FECHA</span>
          <input className={ui.input} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label>
          <span className={ui.label}>MEDIO</span>
          <select className={ui.select} value={medio} onChange={(e) => setMedio(e.target.value as Medio)}>
            {MEDIOS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={ui.label}>NOTA</span>
          <input className={ui.input} placeholder="Opcional" value={nota} onChange={(e) => setNota(e.target.value)} />
        </label>
      </div>
      {error && <p className={ui.error}>No se pudo guardar. Probá de nuevo.</p>}
      <div className={ui.actions}>
        <button type="button" className={ui.link} onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className={ui.primary} disabled={busy || !fecha}>
          GUARDAR PAGO
        </button>
      </div>
    </form>
  )
}
