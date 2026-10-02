import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { altaSocio, borrarSocio, cambiarDni, loadSocios, updateFicha, type AltaDatos, type SocioExtra } from './api'
import { actionOf, buildRows, countBy, matches, type SocioFilter, type SocioRow } from './listado'
import styles from './Socios.module.css'
import { whatsappLink } from './whatsapp'

const FILTERS: { value: SocioFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'semana', label: 'Entrenaron esta semana' },
  { value: 'sin-rutina', label: 'Sin rutina' },
  { value: 'inactivos', label: 'Más de 10 días sin venir' },
]

type SocioView = SocioRow & SocioExtra

/** Lista de socios (PanelSocios.dc.html) + ficha con cuota, datos y cuenta. */
export function Socios({ profeId }: { profeId: string }) {
  const [rows, setRows] = useState<SocioView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<SocioFilter>('todos')
  const [query, setQuery] = useState('')
  const [altaOpen, setAltaOpen] = useState(false)
  const [ficha, setFicha] = useState<SocioView | null>(null)

  const load = useCallback(() => {
    loadSocios(profeId)
      .then((d) => {
        setError(null)
        const extra = new Map(d.profiles.map((p) => [p.id, p]))
        setRows(buildRows(d.profiles, d.rutinas, d.entrenos, Date.now()).map((r) => ({ ...extra.get(r.id)!, ...r })))
      })
      .catch(() => setError('No pudimos cargar los socios. Revisá la conexión y probá de nuevo.'))
  }, [profeId])

  useEffect(load, [load])

  const visible = useMemo(() => (rows ?? []).filter((r) => matches(r, filter, query)), [rows, filter, query])
  const vencidas = rows?.filter((r) => !r.feeOk).length ?? 0

  return (
    <main className={styles.main}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>SOCIOS</h1>
          <div className={styles.sub}>
            {rows ? `${rows.length} socios · ${countBy(rows, 'semana')} entrenaron esta semana${vencidas ? ` · ${vencidas} con la cuota vencida` : ''}` : 'Cargando…'}
          </div>
        </div>
        <div className={styles.tools}>
          <label htmlFor="buscar" className={styles.srOnly}>
            Buscar socio
          </label>
          <input id="buscar" className={styles.search} placeholder="Buscar por nombre" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className={styles.alta} onClick={() => setAltaOpen(true)}>
            + DAR DE ALTA
          </button>
        </div>
      </div>

      <div className={styles.filters} role="group" aria-label="Filtros">
        {FILTERS.map((f) => (
          <button key={f.value} className={styles.filter} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label} <span className={styles.count}>{rows ? countBy(rows, f.value) : ''}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error} <button onClick={load}>Reintentar</button>
        </p>
      )}

      <div role="table" aria-label="Socios" className={styles.table}>
        <div role="row" className={`${styles.row} ${styles.headRow}`}>
          <div role="columnheader">SOCIO</div>
          <div role="columnheader">RUTINA</div>
          <div role="columnheader">ÚLTIMO ENTRENO</div>
          <div role="columnheader">RACHA</div>
          <div role="columnheader" />
        </div>
        {visible.map((r) => {
          const action = actionOf(r)
          const wa = action === 'escribir' ? whatsappLink(r.phone, `Hola ${r.nombre.split(' ')[0]}! Hace unos días que no te vemos por 653. ¿Todo bien? Te esperamos 💪`) : null
          return (
            <div role="row" key={r.id} className={`${styles.row} ${styles.bodyRow}`}>
              <div role="cell">
                <div className={styles.name}>{r.nombre}</div>
                <div className={styles.email}>
                  {r.email}
                  {!r.feeOk && <span className={styles.fee}> · Cuota vencida</span>}
                </div>
              </div>
              <div role="cell" className={r.plan ? undefined : styles.muted} data-label="Rutina">
                {r.plan ?? 'Sin rutina'}
              </div>
              <div role="cell" className={r.inactive ? styles.strong : r.lastAt === null ? styles.muted : undefined} data-label="Último">
                {r.lastLabel}
              </div>
              <div role="cell" className={styles.streak} data-label="Racha">
                {r.streak > 0 ? `${r.streak} sem` : '—'}
              </div>
              <div role="cell" className={styles.actionCell}>
                <button className={styles.action} onClick={() => setFicha(r)}>
                  Ficha
                </button>
                {wa ? (
                  <a className={styles.action} href={wa} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                ) : (
                  <Link className={styles.action} data-primary={action === 'armar'} to={`/panel/socio/${r.id}`}>
                    {action === 'armar' ? 'Armar rutina' : 'Rutina'}
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {rows && visible.length === 0 && !error && (
        <p className={styles.empty}>{rows.length === 0 ? 'Todavía no tenés socios. Con "Dar de alta" sumás el primero.' : 'Ningún socio coincide con la búsqueda o el filtro.'}</p>
      )}

      {altaOpen && (
        <AltaDialog
          onClose={() => setAltaOpen(false)}
          onDone={() => {
            setAltaOpen(false)
            load()
          }}
        />
      )}
      {ficha && (
        <FichaDialog
          socio={ficha}
          onClose={() => setFicha(null)}
          onDone={() => {
            setFicha(null)
            load()
          }}
        />
      )}
    </main>
  )
}

function Dialog({ title, text, onClose, children }: { title: string; text?: string; onClose: () => void; children: (close: () => void) => ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby="dialog-titulo">
      <h2 id="dialog-titulo" className={styles.dialogTitle}>
        {title}
      </h2>
      {text && <p className={styles.dialogText}>{text}</p>}
      {children(onClose)}
    </dialog>
  )
}

function Field({ id, label, ...input }: { id: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <>
      <label htmlFor={id} className={styles.dialogLabel}>
        {label}
      </label>
      <input id={id} className={styles.dialogInput} {...input} />
    </>
  )
}

const EMPTY_ALTA: AltaDatos = { nombre: '', apellido: '', dni: '', telefono: '', profe: '' }

/** Alta de socio: entra con su nombre y apellido + DNI, como siempre. */
function AltaDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [d, setD] = useState<AltaDatos>(EMPTY_ALTA)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof AltaDatos) => (e: ChangeEvent<HTMLInputElement>) => setD((x) => ({ ...x, [k]: e.target.value }))
  const ok = d.nombre.trim() && d.apellido.trim() && d.dni.replace(/\D/g, '').length >= 6

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await altaSocio(d)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos dar de alta al socio.')
      setBusy(false)
    }
  }

  return (
    <Dialog title="DAR DE ALTA" text="Entra a la app con su nombre y apellido y su DNI. Después le armás la rutina." onClose={onClose}>
      {(close) => (
        <form onSubmit={submit}>
          <div className={styles.twoCols}>
            <div>
              <Field id="alta-nombre" label="NOMBRE" value={d.nombre} onChange={set('nombre')} autoFocus required />
            </div>
            <div>
              <Field id="alta-apellido" label="APELLIDO" value={d.apellido} onChange={set('apellido')} required />
            </div>
          </div>
          <Field id="alta-dni" label="DNI (SU CONTRASEÑA)" inputMode="numeric" value={d.dni} onChange={set('dni')} required />
          <Field id="alta-tel" label="TELÉFONO (WHATSAPP)" inputMode="tel" placeholder="351 555 0102" value={d.telefono} onChange={set('telefono')} />
          <Field id="alta-profe" label="PROFE" placeholder="Opcional" value={d.profe} onChange={set('profe')} />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.dialogActions}>
            <button type="button" className={styles.cancel} onClick={close}>
              Cancelar
            </button>
            <button type="submit" className={styles.submit} disabled={busy || !ok}>
              {busy ? 'CREANDO…' : 'DAR DE ALTA'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

/** Ficha: datos, cuota, cambio de DNI y baja (lo que hacía el panel de la app anterior). */
function FichaDialog({ socio, onClose, onDone }: { socio: SocioView; onClose: () => void; onDone: () => void }) {
  const [phone, setPhone] = useState(socio.phone)
  const [coach, setCoach] = useState(socio.coachName)
  const [feeOk, setFeeOk] = useState(socio.feeOk)
  const [due, setDue] = useState(socio.feeDueDate)
  const [dni, setDni] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmBorrar, setConfirmBorrar] = useState(false)
  const reminder = whatsappLink(phone, `Hola ${socio.nombre.split(' ')[0]}! Te recordamos que tu cuota de 653 Gym & Fitness${due ? ` vence el ${due}` : ' está vencida'}. ¡Gracias!`)

  const run = async (fn: () => Promise<void>, okMsg: string | null) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      if (okMsg) setMsg(okMsg)
      else onDone()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'No se pudo. Probá de nuevo.')
    }
    setBusy(false)
  }

  return (
    <Dialog title={socio.nombre.toUpperCase()} text={`DNI ${socio.dni || '—'}`} onClose={onClose}>
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => updateFicha(socio.id, { phone, coachName: coach, feeOk, feeDueDate: due }), null)
          }}
        >
          <Field id="ficha-tel" label="TELÉFONO (WHATSAPP)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Field id="ficha-profe" label="PROFE" value={coach} onChange={(e) => setCoach(e.target.value)} />
          <div className={styles.feeRow}>
            <span className={styles.dialogLabel}>CUOTA AL DÍA</span>
            <button type="button" role="switch" aria-checked={feeOk} aria-label="Cuota al día" className={styles.switch} onClick={() => setFeeOk(!feeOk)}>
              <span className={styles.knob} />
            </button>
          </div>
          <Field id="ficha-vence" label="PRÓXIMO VENCIMIENTO" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          {reminder && (
            <a className={styles.inlineLink} href={reminder} target="_blank" rel="noreferrer">
              Recordarle la cuota por WhatsApp →
            </a>
          )}

          <div className={styles.dialogActions}>
            <button type="button" className={styles.cancel} onClick={close}>
              Cerrar
            </button>
            <button type="submit" className={styles.submit} disabled={busy}>
              GUARDAR
            </button>
          </div>

          <div className={styles.divider} />
          <Field id="ficha-dni" label="CAMBIAR DNI (CONTRASEÑA)" inputMode="numeric" placeholder="Nuevo DNI" value={dni} onChange={(e) => setDni(e.target.value)} />
          <div className={styles.dialogActions}>
            <button type="button" className={styles.action} disabled={busy || dni.replace(/\D/g, '').length < 6} onClick={() => void run(() => cambiarDni(socio.id, dni), '✓ DNI actualizado')}>
              Cambiar DNI
            </button>
          </div>

          {msg && (
            <p className={msg.startsWith('✓') ? styles.okMsg : styles.error} role="status">
              {msg}
            </p>
          )}

          <div className={styles.divider} />
          {confirmBorrar ? (
            <div className={styles.danger}>
              <p>Se borra su cuenta, su rutina y todo su historial. No se puede deshacer.</p>
              <div className={styles.dialogActions}>
                <button type="button" className={styles.cancel} onClick={() => setConfirmBorrar(false)}>
                  No
                </button>
                <button type="button" className={styles.dangerBtn} disabled={busy} onClick={() => void run(() => borrarSocio(socio.id), null)}>
                  {busy ? 'BORRANDO…' : 'SÍ, DAR DE BAJA'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={styles.linkDanger} onClick={() => setConfirmBorrar(true)}>
              Dar de baja al socio
            </button>
          )}
        </form>
      )}
    </Dialog>
  )
}
