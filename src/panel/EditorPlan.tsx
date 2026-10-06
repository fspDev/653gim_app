import { useEffect, useMemo, useState } from 'react'
import { fmtKg, fmtTime } from '../format'
import { slugify } from '../keys'
import {
  addBloque,
  addDia,
  moveBloque,
  newBloque,
  parseKg,
  parseRest,
  patchBloque,
  removeBloque,
  removeDia,
  totalMinutes,
  type EBloque,
  type EPaso,
  type ERutina,
} from '../rutina/editor'
import { toDayDocs } from '../rutina/firestoreRutina'
import { uuid } from '../uuid'
import { fullName, loadEjercicios, loadEstudiante, loadEstudiantes, planVacio, publicarPlan, type Ejercicio } from './api'
import { Dialog } from './Dialog'
import styles from './EditorPlan.module.css'
import type { TabProps } from './Estudiante'
import ui from './ui.module.css'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
/** Lo que se guardaría (orden de claves fijo): para saber si hay cambios sin publicar. */
const canon = (r: ERutina | null) => (r ? JSON.stringify({ n: r.nombre.trim(), d: toDayDocs(r, 0) }) : '')
const draftKey = (sid: string) => `g653:borrador:${sid}`

function readDraft(sid: string): ERutina | null {
  try {
    const raw = sessionStorage.getItem(draftKey(sid))
    return raw ? (JSON.parse(raw) as ERutina) : null
  } catch {
    return null
  }
}
function writeDraft(sid: string, r: ERutina | null) {
  try {
    if (r) sessionStorage.setItem(draftKey(sid), JSON.stringify(r))
    else sessionStorage.removeItem(draftKey(sid))
  } catch {
    /* sin espacio: el borrador vive mientras la pantalla esté abierta */
  }
}

/** Ids nuevos para todo (al copiar el plan de otro estudiante). */
function reId(r: ERutina): ERutina {
  return { ...r, dias: r.dias.map((d) => ({ ...d, id: uuid(), bloques: d.bloques.map((b) => ({ ...b, id: uuid() })) })) }
}

/** Plan del estudiante: días, ejercicios con series/reps/peso/descanso, indicación, y Publicar. */
export function EditorPlan({ d, reload }: TabProps) {
  const sid = d.e.id
  const saved = d.rutina
  const [rutina, setRutina] = useState<ERutina | null>(() => readDraft(sid) ?? (saved ? clone(saved) : null))
  const [diaId, setDiaId] = useState(rutina?.dias[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [picker, setPicker] = useState(false)
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([])

  useEffect(() => {
    loadEjercicios()
      .then(setEjercicios)
      .catch(() => {})
  }, [])

  const dirty = !!rutina && canon(rutina) !== canon(saved)

  // El borrador sobrevive a cambiar de pestaña o recargar; se borra al publicar o descartar.
  useEffect(() => writeDraft(sid, dirty ? rutina : null), [sid, rutina, dirty])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const publicar = async () => {
    if (!rutina) return
    setBusy(true)
    setError(null)
    try {
      await publicarPlan(sid, rutina, d.e.rutina?.version ?? 0)
      writeDraft(sid, null)
      setOk(true)
      setTimeout(() => setOk(false), 2500)
      reload()
    } catch {
      setError('No pudimos publicar. Tus cambios siguen acá: probá de nuevo.')
    }
    setBusy(false)
  }

  if (!rutina) return <SinPlan sid={sid} nombre={d.e.nombre} onCrear={(r) => (setRutina(r), setDiaId(r.dias[0].id))} />

  const dia = rutina.dias.find((x) => x.id === diaId) ?? rutina.dias[0]
  const update = (fn: (r: ERutina) => ERutina) => setRutina((r) => (r ? fn(r) : r))

  return (
    <section>
      <div className={styles.top}>
        <div className={styles.planName}>
          <label htmlFor="plan-nombre" className={ui.srOnly}>
            Nombre del plan
          </label>
          <input id="plan-nombre" className={styles.nameInput} value={rutina.nombre} onChange={(e) => update((r) => ({ ...r, nombre: e.target.value }))} placeholder="Nombre del plan" />
          <div className={ui.hint}>
            {rutina.dias.length} {rutina.dias.length === 1 ? 'día' : 'días'} por semana
            {d.e.rutina?.publicadaAt ? ` · publicado el ${new Date(d.e.rutina.publicadaAt).toLocaleDateString('es-AR')}` : ' · sin publicar'}
          </div>
        </div>
        <div className={styles.publish}>
          <span className={styles.state} role="status">
            {ok ? '✓ Publicado: ya lo ve en la app' : dirty ? 'Cambios sin publicar' : saved ? 'Publicado' : ''}
          </span>
          {dirty && saved && (
            <button className={ui.link} onClick={() => setRutina(clone(saved))}>
              Descartar
            </button>
          )}
          <button className={ui.primary} onClick={() => void publicar()} disabled={busy || !dirty}>
            {busy ? 'PUBLICANDO…' : 'PUBLICAR'}
          </button>
        </div>
      </div>
      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.days} role="tablist" aria-label="Días">
        {rutina.dias.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === dia.id} className={styles.day} onClick={() => setDiaId(x.id)}>
            DÍA {x.letra}
          </button>
        ))}
        <button
          className={styles.addDay}
          onClick={() => {
            const next = addDia(rutina)
            setRutina(next)
            setDiaId(next.dias[next.dias.length - 1].id)
          }}
        >
          + Día
        </button>
        <div className={styles.total}>
          {totalMinutes(dia)} MIN · {dia.bloques.length} {dia.bloques.length === 1 ? 'BLOQUE' : 'BLOQUES'}
        </div>
      </div>

      <ol className={styles.list}>
        {dia.bloques.map((b, i) => (
          <BloqueCard
            key={b.id}
            b={b}
            index={i}
            last={dia.bloques.length - 1}
            onPatch={(p) => update((r) => patchBloque(r, dia.id, b.id, p))}
            onRemove={() => update((r) => removeBloque(r, dia.id, b.id))}
            onMove={(to) => update((r) => moveBloque(r, dia.id, i, to))}
          />
        ))}
      </ol>
      {dia.bloques.length === 0 && <p className={ui.empty}>Este día está vacío. Sumá ejercicios de la biblioteca o con los botones de abajo.</p>}

      <div className={styles.addRow}>
        <button className={ui.secondary} onClick={() => setPicker(true)}>
          + EJERCICIO
        </button>
        <button className={ui.ghost} onClick={() => update((r) => addBloque(r, dia.id, newBloque('tiempo', { nombre: 'Bici fija', minutos: 8, subtitulo: 'Calentamiento' })))}>
          + Por tiempo
        </button>
        <button className={ui.ghost} onClick={() => update((r) => addBloque(r, dia.id, newBloque('circuito', { nombre: 'Circuito' })))}>
          + Circuito
        </button>
        {rutina.dias.length > 1 && (
          <button
            className={`${ui.link} ${styles.removeDay}`}
            onClick={() => {
              const next = removeDia(rutina, dia.id)
              setRutina(next)
              setDiaId(next.dias[0].id)
            }}
          >
            Quitar el día {dia.letra}
          </button>
        )}
      </div>
      <p className={ui.hint} style={{ marginTop: 16 }}>
        El peso es el de arranque: después el estudiante sigue desde el último que usó, y la app le sugiere +2,5 kg cuando completa todo. Si cambiás el peso y publicás, manda el tuyo.
      </p>

      {picker && (
        <Picker
          ejercicios={ejercicios}
          onClose={() => setPicker(false)}
          onPick={(nombre, ejercicioId) => {
            update((r) => addBloque(r, dia.id, newBloque('fuerza', { ejercicioId, nombre })))
            setPicker(false)
          }}
        />
      )}
    </section>
  )
}

/* ───────── Sin plan ───────── */

function SinPlan({ sid, nombre, onCrear }: { sid: string; nombre: string; onCrear: (r: ERutina) => void }) {
  const [otros, setOtros] = useState<{ id: string; nombre: string; plan: string }[]>([])
  const [desde, setDesde] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    loadEstudiantes()
      .then((list) => setOtros(list.filter((r) => r.e.id !== sid && r.e.rutina).map((r) => ({ id: r.e.id, nombre: fullName(r.e), plan: r.e.rutina?.nombre ?? 'Plan' }))))
      .catch(() => {})
  }, [sid])

  const copiar = async () => {
    setBusy(true)
    const other = await loadEstudiante(desde).catch(() => null)
    setBusy(false)
    if (other?.rutina) onCrear(reId(other.rutina))
  }

  return (
    <div className={ui.empty} style={{ textAlign: 'left' }}>
      <p style={{ margin: 0, color: 'var(--ink)', fontSize: 17 }}>{nombre} todavía no tiene plan.</p>
      <div className={ui.actions} style={{ justifyContent: 'flex-start' }}>
        <button className={ui.primary} onClick={() => onCrear(planVacio())}>
          ARMAR PLAN
        </button>
      </div>
      {otros.length > 0 && (
        <>
          <label htmlFor="copiar-de" className={ui.label}>
            O COPIÁ EL PLAN DE OTRO ESTUDIANTE
          </label>
          <div className={styles.copyRow}>
            <select id="copiar-de" className={ui.select} value={desde} onChange={(e) => setDesde(e.target.value)}>
              <option value="">Elegí…</option>
              {otros.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre} · {o.plan}
                </option>
              ))}
            </select>
            <button className={ui.ghost} disabled={!desde || busy} onClick={() => void copiar()}>
              Copiar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ───────── Bloque ───────── */

/** Campo numérico: se escribe libre y se interpreta al salir; si no se entiende, vuelve al valor anterior. */
function Num({ value, label, onCommit, suffix }: { value: string; label: string; onCommit: (text: string) => boolean; suffix?: string }) {
  return (
    <label className={styles.num}>
      <span className={styles.numLabel}>{label}</span>
      <span className={styles.numBox}>
        <input
          key={value}
          className={styles.numInput}
          defaultValue={value}
          inputMode="decimal"
          onBlur={(e) => {
            if (e.target.value !== value && !onCommit(e.target.value)) e.target.value = value
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </span>
    </label>
  )
}

const asInt = (text: string, min: number) => {
  const n = /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN
  return n >= min ? n : null
}

interface CardProps {
  b: EBloque
  index: number
  last: number
  onPatch: (p: Partial<EBloque>) => void
  onRemove: () => void
  onMove: (to: number) => void
}

function BloqueCard({ b, index, last, onPatch, onRemove, onMove }: CardProps) {
  const [open, setOpen] = useState(!!b.comentario?.trim())
  const kind = b.tipo === 'fuerza' ? 'Fuerza' : b.tipo === 'tiempo' ? 'Por tiempo' : 'Circuito'
  const int = (key: 'series' | 'reps' | 'minutos' | 'rondas', min: number) => (t: string) => {
    const n = asInt(t, min)
    if (n === null) return false
    onPatch({ [key]: n })
    return true
  }

  return (
    <li className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.n}>{index + 1}</span>
        <div className={styles.cardName}>
          <input
            className={styles.nameField}
            value={b.nombre}
            aria-label="Nombre del ejercicio"
            onChange={(e) => onPatch(b.tipo === 'fuerza' ? { nombre: e.target.value, ejercicioId: slugify(e.target.value) || null } : { nombre: e.target.value })}
          />
          <div className={styles.kind}>{kind}</div>
        </div>
        <div className={styles.cardTools}>
          <button className={ui.iconBtn} aria-label={`Subir ${b.nombre}`} disabled={index === 0} onClick={() => onMove(index - 1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 15l6-6 6 6" />
            </svg>
          </button>
          <button className={ui.iconBtn} aria-label={`Bajar ${b.nombre}`} disabled={index === last} onClick={() => onMove(index + 1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <button className={ui.iconBtn} aria-label={`Quitar ${b.nombre}`} onClick={onRemove}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.fields}>
        {b.tipo === 'fuerza' && (
          <>
            <Num value={String(b.series)} label="Series" onCommit={int('series', 1)} />
            <Num value={String(b.reps)} label="Reps" onCommit={int('reps', 1)} />
            <Num
              value={fmtKg(b.pesoKg)}
              label="Peso"
              suffix="kg"
              onCommit={(t) => {
                const n = parseKg(t)
                if (n === null) return false
                onPatch({ pesoKg: n })
                return true
              }}
            />
            <Num
              value={fmtTime(b.descansoS)}
              label="Descanso"
              onCommit={(t) => {
                const n = parseRest(t)
                if (n === null || n < 5) return false
                onPatch({ descansoS: n })
                return true
              }}
            />
          </>
        )}
        {b.tipo === 'tiempo' && (
          <>
            <Num value={String(b.minutos)} label="Minutos" suffix="min" onCommit={int('minutos', 1)} />
            <label className={styles.text}>
              <span className={styles.numLabel}>Indicación en pantalla</span>
              <input className={styles.textInput} value={b.indicacion ?? ''} placeholder="Ritmo suave · 70–80 rpm" onChange={(e) => onPatch({ indicacion: e.target.value })} />
            </label>
          </>
        )}
        {b.tipo === 'circuito' && <Num value={String(b.rondas)} label="Rondas" onCommit={int('rondas', 1)} />}
      </div>

      {b.tipo === 'circuito' && <Pasos pasos={b.pasos} onChange={(pasos) => onPatch({ pasos })} />}

      {open ? (
        <div className={styles.extra}>
          <label className={styles.text}>
            <span className={styles.numLabel}>Indicación para el estudiante</span>
            <textarea className={styles.textArea} rows={2} value={b.comentario ?? ''} placeholder="Ej.: bajá en 3 segundos, rodillas hacia afuera" onChange={(e) => onPatch({ comentario: e.target.value })} />
          </label>
        </div>
      ) : (
        <button className={styles.extraBtn} onClick={() => setOpen(true)}>
          + Indicación
        </button>
      )}
    </li>
  )
}

/** Pasos del circuito, cada uno por segundos o por repeticiones. */
function Pasos({ pasos, onChange }: { pasos: EPaso[]; onChange: (p: EPaso[]) => void }) {
  const set = (i: number, p: EPaso) => onChange(pasos.map((x, j) => (j === i ? p : x)))
  return (
    <div className={styles.steps}>
      {pasos.map((p, i) => {
        const timed = p.segundos !== undefined
        return (
          <div key={i} className={styles.step}>
            <input className={styles.stepName} value={p.nombre} aria-label={`Nombre del paso ${i + 1}`} onChange={(e) => set(i, { ...p, nombre: e.target.value })} />
            <input
              className={styles.stepNum}
              inputMode="numeric"
              aria-label={timed ? 'Segundos' : 'Repeticiones'}
              value={timed ? p.segundos : p.reps}
              onChange={(e) => {
                const n = Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)
                set(i, timed ? { nombre: p.nombre, segundos: n } : { nombre: p.nombre, reps: n })
              }}
            />
            <select
              className={styles.stepMode}
              aria-label="Medido en"
              value={timed ? 's' : 'r'}
              onChange={(e) => set(i, e.target.value === 's' ? { nombre: p.nombre, segundos: 30 } : { nombre: p.nombre, reps: 10 })}
            >
              <option value="s">seg</option>
              <option value="r">reps</option>
            </select>
            <button className={ui.iconBtn} aria-label={`Quitar paso ${i + 1}`} onClick={() => onChange(pasos.filter((_, j) => j !== i))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )
      })}
      <button className={styles.extraBtn} onClick={() => onChange([...pasos, { nombre: 'Nuevo ejercicio', segundos: 30 }])}>
        + Paso
      </button>
    </div>
  )
}

/* ───────── Biblioteca ───────── */

function Picker({ ejercicios, onClose, onPick }: { ejercicios: Ejercicio[]; onClose: () => void; onPick: (nombre: string, id: string) => void }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const t = slugify(q)
    return ejercicios.filter((e) => !t || e.id.includes(t) || slugify(e.grupo ?? '').includes(t))
  }, [ejercicios, q])
  const nuevo = q.trim() && !ejercicios.some((e) => e.id === slugify(q))

  return (
    <Dialog title="AGREGAR EJERCICIO" onClose={onClose}>
      <label htmlFor="buscar-ej" className={ui.srOnly}>
        Buscar ejercicio
      </label>
      <input id="buscar-ej" className={ui.input} placeholder="Buscar o escribir uno nuevo…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <ul className={styles.libList}>
        {nuevo && (
          <li>
            <button className={styles.libRow} onClick={() => onPick(q.trim().replace(/\s+/g, ' '), slugify(q))}>
              <span>
                <span className={styles.libName}>+ Crear “{q.trim()}”</span>
                <span className={styles.libGroup}>Queda en tu biblioteca al publicar</span>
              </span>
            </button>
          </li>
        )}
        {list.map((e) => (
          <li key={e.id}>
            <button className={styles.libRow} onClick={() => onPick(e.nombre, e.id)}>
              <span>
                <span className={styles.libName}>{e.nombre}</span>
                <span className={styles.libGroup}>
                  {e.grupo}
                </span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12h14M12 5v14" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <div className={ui.actions}>
        <button className={ui.link} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Dialog>
  )
}
