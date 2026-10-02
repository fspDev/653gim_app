import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fmtKg, fmtTime } from '../format'
import { EFFORT_LABELS } from '../ui/labels'
import { createRutina, loadEditor, loadEjercicios, loadUltimaVez, saveAndPublish, type EditorData, type Ejercicio, type UltimaVez } from './api'
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
} from './editor'
import styles from './EditorRutina.module.css'
import { lastLabel } from './listado'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** Editor de rutina (PanelRutina.dc.html): días, tabla de bloques editable, biblioteca de ejercicios y Publicar. */
export function EditorRutina({ profeId }: { profeId: string }) {
  const socioId = useParams().id ?? ''
  const [data, setData] = useState<EditorData | null>(null)
  const [rutina, setRutina] = useState<ERutina | null>(null)
  const [saved, setSaved] = useState<ERutina | null>(null)
  const [publicada, setPublicada] = useState(false)
  const [version, setVersion] = useState(0)
  const [diaId, setDiaId] = useState('')
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ultima, setUltima] = useState<UltimaVez | null>(null)
  const [openSteps, setOpenSteps] = useState<string | null>(null)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    Promise.all([loadEditor(socioId, profeId), loadEjercicios()])
      .then(([d, ej]) => {
        if (cancelled) return
        setData(d)
        setEjercicios(ej)
        setRutina(d.rutina)
        setSaved(d.rutina ? clone(d.rutina) : null)
        setPublicada(d.publicada)
        setVersion(d.version)
        setDiaId(d.rutina?.dias[0]?.id ?? '')
      })
      .catch(() => !cancelled && setError('No pudimos cargar la rutina. Revisá la conexión y probá de nuevo.'))
    return () => {
      cancelled = true
    }
  }, [socioId, profeId])

  const dirty = !!rutina && (!publicada || JSON.stringify(rutina) !== JSON.stringify(saved))

  // Avisar antes de perder cambios sin publicar.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // "Última vez" de este día: solo si el día ya estaba guardado en el servidor.
  const savedDiaIds = useMemo(() => new Set(saved?.dias.map((d) => d.id)), [saved])
  const ultimaVisible = !!diaId && savedDiaIds.has(diaId)
  useEffect(() => {
    let cancelled = false
    if (!diaId || !savedDiaIds.has(diaId)) return
    loadUltimaVez(socioId, diaId)
      .then((u) => !cancelled && setUltima(u))
      .catch(() => !cancelled && setUltima(null))
    return () => {
      cancelled = true
    }
  }, [socioId, diaId, savedDiaIds])

  const crear = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await createRutina(socioId, profeId)
      setRutina(r)
      setSaved(clone(r))
      setDiaId(r.dias[0].id)
    } catch {
      setError('No pudimos crear la rutina.')
    }
    setBusy(false)
  }

  const publicar = async () => {
    if (!rutina) return
    setBusy(true)
    setError(null)
    try {
      setVersion(await saveAndPublish(socioId, rutina, saved, version))
      setSaved(clone(rutina))
      setPublicada(true)
    } catch {
      setError('No pudimos publicar. Tus cambios siguen acá: probá de nuevo.')
    }
    setBusy(false)
  }

  if (error && !data) {
    return (
      <main className={styles.page}>
        <Link to="/panel" className={styles.back}>
          ‹ Socios
        </Link>
        <p className={styles.error} role="alert">
          {error}
        </p>
      </main>
    )
  }
  if (!data) return <main className={styles.page}>Cargando…</main>

  const dia = rutina?.dias.find((d) => d.id === diaId) ?? rutina?.dias[0]
  const nombreSocio = data.socio?.nombre || data.socio?.email || 'Socio'
  const update = (fn: (r: ERutina) => ERutina) => setRutina((r) => (r ? fn(r) : r))
  const bloqueNombre = (id: string | null) => saved?.dias.flatMap((d) => d.bloques).find((b) => b.id === id)?.nombre

  return (
    <div className={styles.grid}>
      <main className={styles.page}>
        <Link to="/panel" className={styles.back}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Socios
        </Link>

        <div className={styles.head}>
          <div>
            <h1 className={styles.title}>{nombreSocio.toUpperCase()}</h1>
            {rutina && (
              <div className={styles.sub}>
                <label htmlFor="rutina-nombre" className={styles.srOnly}>
                  Nombre de la rutina
                </label>
                <input id="rutina-nombre" className={styles.nameInput} value={rutina.nombre} onChange={(e) => update((r) => ({ ...r, nombre: e.target.value }))} size={Math.max(8, rutina.nombre.length)} />
                {` · ${rutina.dias.length} ${rutina.dias.length === 1 ? 'día' : 'días'} por semana · último entreno ${data.lastAt ? lastLabel(data.lastAt, now).toLowerCase() : 'nunca'}`}
              </div>
            )}
          </div>
          {rutina && (
            <div className={styles.publish}>
              <span className={styles.state} role="status">
                {dirty ? 'Cambios sin publicar' : 'Publicada'}
              </span>
              <button className={styles.publishBtn} onClick={() => void publicar()} disabled={busy || !dirty}>
                {busy ? 'GUARDANDO…' : 'PUBLICAR'}
              </button>
            </div>
          )}
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {!rutina || !dia ? (
          <div className={styles.empty}>
            <p>{nombreSocio} todavía no tiene rutina.</p>
            <button className={styles.publishBtn} onClick={() => void crear()} disabled={busy}>
              ARMAR RUTINA
            </button>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="Días" className={styles.tabs}>
              {rutina.dias.map((d) => (
                <button key={d.id} role="tab" aria-selected={d.id === dia.id} className={styles.tab} onClick={() => setDiaId(d.id)}>
                  DÍA {d.letra}
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
              <div className={styles.grow} />
              <div className={styles.total}>
                {totalMinutes(dia)} MIN · {dia.bloques.length} {dia.bloques.length === 1 ? 'BLOQUE' : 'BLOQUES'}
              </div>
            </div>

            {/* En el celular la tabla se desliza de costado en vez de apretarse. */}
            <div className={styles.tableScroll}>
            <div className={`${styles.cols} ${styles.colsHead}`}>
              <span />
              <span />
              <span>EJERCICIO</span>
              <span>SERIES</span>
              <span>REPS</span>
              <span>PESO KG</span>
              <span>DESCANSO</span>
              <span />
            </div>

            {dia.bloques.map((b, i) => (
              <BloqueFila
                key={b.id}
                b={b}
                index={i}
                last={dia.bloques.length - 1}
                stepsOpen={openSteps === b.id}
                onToggleSteps={() => setOpenSteps(openSteps === b.id ? null : b.id)}
                onPatch={(p) => update((r) => patchBloque(r, dia.id, b.id, p))}
                onRemove={() => update((r) => removeBloque(r, dia.id, b.id))}
                onMove={(from, to) => update((r) => moveBloque(r, dia.id, from, to))}
              />
            ))}
            </div>
            {dia.bloques.length === 0 && <p className={styles.hint}>Este día no tiene bloques. Sumá ejercicios desde la biblioteca o con los botones de abajo.</p>}

            <div className={styles.addRow}>
              <button className={styles.add} onClick={() => update((r) => addBloque(r, dia.id, newBloque('fuerza')))}>
                + Bloque de fuerza
              </button>
              <button className={styles.add} onClick={() => update((r) => addBloque(r, dia.id, newBloque('tiempo', { nombre: 'Bici fija', minutos: 8 })))}>
                + Bloque por tiempo
              </button>
              <button className={styles.add} onClick={() => update((r) => addBloque(r, dia.id, newBloque('circuito')))}>
                + Circuito guiado
              </button>
              {rutina.dias.length > 1 && (
                <button
                  className={styles.removeDay}
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
            <div className={styles.note}>
              El peso es el de arranque. La app le sugiere +2,5 kg cuando en el entreno anterior completó todas las series con las reps objetivo.
            </div>
          </>
        )}
      </main>

      <Biblioteca
        ejercicios={ejercicios}
        disabled={!rutina || !dia}
        onAdd={(e) => dia && update((r) => addBloque(r, dia.id, newBloque('fuerza', { ejercicioId: e.id, nombre: e.nombre })))}
        ultima={dia ? { letra: dia.letra, data: ultimaVisible ? ultima : null, nombre: bloqueNombre } : null}
      />
    </div>
  )
}

/* ───────── Fila de bloque ───────── */

interface FilaProps {
  b: EBloque
  index: number
  last: number
  stepsOpen: boolean
  onToggleSteps: () => void
  onPatch: (p: Partial<EBloque>) => void
  onRemove: () => void
  onMove: (from: number, to: number) => void
}

/** Celda editable: se escribe libre y se interpreta al salir; si no se entiende, vuelve al valor anterior. */
function Cell({ value, label, onCommit, suffix, wide }: { value: string; label: string; onCommit: (text: string) => boolean; suffix?: string; wide?: boolean }) {
  return (
    <div className={styles.cell} data-wide={wide}>
      <input
        key={value}
        className={styles.cellInput}
        defaultValue={value}
        aria-label={label}
        inputMode="decimal"
        onBlur={(e) => {
          if (e.target.value !== value && !onCommit(e.target.value)) e.target.value = value
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {suffix && <span className={styles.suffix}>{suffix}</span>}
    </div>
  )
}

const Dash = () => <div className={`${styles.cell} ${styles.dash}`}>—</div>

const asInt = (min: number) => (text: string) => {
  const n = /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN
  return n >= min ? n : null
}

function BloqueFila({ b, index, last, stepsOpen, onToggleSteps, onPatch, onRemove, onMove }: FilaProps) {
  const [dragging, setDragging] = useState(false)
  const kind = b.tipo === 'fuerza' ? 'Fuerza' : b.tipo === 'tiempo' ? 'Por tiempo' : `Circuito guiado · ${b.rondas} rondas`

  const int = (key: 'series' | 'reps' | 'minutos' | 'rondas', min: number) => (text: string) => {
    const n = asInt(min)(text)
    if (n === null) return false
    onPatch({ [key]: n })
    return true
  }

  const onHandleKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      onMove(index, index - 1)
    } else if (e.key === 'ArrowDown' && index < last) {
      e.preventDefault()
      onMove(index, index + 1)
    }
  }

  return (
    <>
      <div
        className={`${styles.cols} ${styles.bodyRow}`}
        data-dragging={dragging}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const from = Number(e.dataTransfer.getData('text/plain'))
          if (!Number.isNaN(from)) onMove(from, index)
        }}
      >
        <button
          className={styles.handle}
          draggable
          aria-label={`Mover ${b.nombre}. Arrastrá o usá las flechas arriba y abajo.`}
          onKeyDown={onHandleKey}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', String(index))
            e.dataTransfer.effectAllowed = 'move'
            setDragging(true)
          }}
          onDragEnd={() => setDragging(false)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="6" r="1.6" />
            <circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" />
            <circle cx="15" cy="18" r="1.6" />
          </svg>
        </button>
        <span className={styles.n}>{index + 1}</span>
        <div>
          {b.tipo === 'fuerza' ? (
            <div className={styles.exName}>{b.nombre}</div>
          ) : (
            <input className={styles.nameField} value={b.nombre} aria-label="Nombre del bloque" onChange={(e) => onPatch({ nombre: e.target.value })} />
          )}
          <div className={styles.kind}>{kind}</div>
        </div>

        {b.tipo === 'fuerza' && (
          <>
            <Cell value={String(b.series)} label="Series" onCommit={int('series', 1)} />
            <Cell value={String(b.reps)} label="Reps" onCommit={int('reps', 1)} />
            <Cell
              value={fmtKg(b.pesoKg)}
              label="Peso en kilos"
              onCommit={(t) => {
                const n = parseKg(t)
                if (n === null) return false
                onPatch({ pesoKg: n })
                return true
              }}
            />
            <Cell
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
            <Dash />
            <Cell value={String(b.minutos)} label="Minutos" suffix="min" onCommit={int('minutos', 1)} />
            <Dash />
            <Dash />
          </>
        )}
        {b.tipo === 'circuito' && (
          <>
            <Cell value={String(b.rondas)} label="Rondas" onCommit={int('rondas', 1)} />
            <button className={`${styles.cell} ${styles.stepsBtn}`} aria-expanded={stepsOpen} onClick={onToggleSteps}>
              {b.pasos.length} ej.
            </button>
            <Dash />
            <Dash />
          </>
        )}

        <button className={styles.remove} aria-label={`Quitar ${b.nombre}`} onClick={onRemove}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {b.tipo === 'circuito' && stepsOpen && <Pasos pasos={b.pasos} onChange={(pasos) => onPatch({ pasos })} />}
    </>
  )
}

/** Pasos del circuito. Sin diseño todavía (PLAN.md): lista mínima, cada paso por segundos o por reps. */
function Pasos({ pasos, onChange }: { pasos: EPaso[]; onChange: (p: EPaso[]) => void }) {
  const set = (i: number, p: EPaso) => onChange(pasos.map((x, j) => (j === i ? p : x)))
  return (
    <div className={styles.steps}>
      {pasos.map((p, i) => {
        const timed = p.segundos !== undefined
        return (
          <div key={i} className={styles.step}>
            <input className={styles.stepName} value={p.nombre} aria-label={`Nombre del paso ${i + 1}`} onChange={(e) => set(i, { ...p, nombre: e.target.value })} />
            <select
              className={styles.stepMode}
              aria-label="Medido en"
              value={timed ? 's' : 'r'}
              onChange={(e) => set(i, e.target.value === 's' ? { nombre: p.nombre, segundos: 30 } : { nombre: p.nombre, reps: 10 })}
            >
              <option value="s">segundos</option>
              <option value="r">reps</option>
            </select>
            <input
              className={styles.stepNum}
              inputMode="numeric"
              aria-label={timed ? 'Segundos' : 'Reps'}
              value={timed ? p.segundos : p.reps}
              onChange={(e) => {
                const n = Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)
                set(i, timed ? { nombre: p.nombre, segundos: n } : { nombre: p.nombre, reps: n })
              }}
            />
            <button className={styles.remove} aria-label={`Quitar paso ${i + 1}`} onClick={() => onChange(pasos.filter((_, j) => j !== i))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )
      })}
      <button className={styles.add} onClick={() => onChange([...pasos, { nombre: 'Nuevo ejercicio', segundos: 30 }])}>
        + Paso
      </button>
    </div>
  )
}

/* ───────── Biblioteca ───────── */

function Biblioteca({
  ejercicios,
  disabled,
  onAdd,
  ultima,
}: {
  ejercicios: Ejercicio[]
  disabled: boolean
  onAdd: (e: Ejercicio) => void
  ultima: { letra: string; data: UltimaVez | null; nombre: (id: string | null) => string | undefined } | null
}) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return ejercicios.filter((e) => !t || e.nombre.toLowerCase().includes(t) || (e.grupo ?? '').toLowerCase().includes(t)).slice(0, 40)
  }, [ejercicios, q])

  const dura = ultima?.data?.dura
  const duraNombre = dura ? ultima?.nombre(dura.bloqueId) : undefined

  return (
    <aside className={styles.library}>
      <div className={styles.libTitle}>EJERCICIOS</div>
      <label htmlFor="buscar-ej" className={styles.srOnly}>
        Buscar ejercicio
      </label>
      <input id="buscar-ej" className={styles.libSearch} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className={styles.libList}>
        {list.map((e) => (
          <div key={e.id} className={styles.libRow}>
            <div>
              <div className={styles.libName}>{e.nombre}</div>
              <div className={styles.libGroup}>{[e.grupo, e.equipo?.toLowerCase()].filter(Boolean).join(' · ')}</div>
            </div>
            <button className={styles.libAdd} aria-label={`Agregar ${e.nombre}`} disabled={disabled} onClick={() => onAdd(e)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12h14M12 5v14" />
              </svg>
            </button>
          </div>
        ))}
        {list.length === 0 && <p className={styles.libEmpty}>No hay ejercicios con ese nombre.</p>}
      </div>

      {ultima && (
        <div className={styles.last}>
          <div className={styles.lastLabel}>ÚLTIMA VEZ · DÍA {ultima.letra}</div>
          <div className={styles.lastText}>
            {!ultima.data ? (
              'Todavía no hizo este día.'
            ) : (
              <>
                {ultima.data.completo ? 'Completó todo.' : 'Cortó el entreno antes de terminar.'}
                {dura && duraNombre && (
                  <>
                    {' '}
                    Marcó {duraNombre.toLowerCase()} como <strong>{EFFORT_LABELS[dura.esfuerzo - 1]}</strong> en la serie {dura.serie}.
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
