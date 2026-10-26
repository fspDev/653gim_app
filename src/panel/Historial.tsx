import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtKg } from '../format'
import { slugify } from '../keys'
import type { EBloque, ERutina } from '../rutina/editor'
import { cargarHistorial, esFichaProfe, type PlanAnterior } from './api'
import { readDraft, reId, writeDraft } from './EditorPlan'
import type { TabProps } from './Estudiante'
import ui from './ui.module.css'

const fecha = (ms: number) => (ms ? new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'sin fecha')
const fuerza = (r: ERutina) => r.dias.flatMap((d) => d.bloques).filter((b) => b.tipo === 'fuerza')
const detalle = (b: EBloque) => `${b.series} × ${b.reps}${b.pesoKg ? ` · ${fmtKg(b.pesoKg)} kg` : ''}`

/** Planes anteriores del estudiante: para no repetir y para partir de uno que ya funcionó. */
export function Historial({ d }: Pick<TabProps, 'd'>) {
  const sid = d.e.id
  const navigate = useNavigate()
  const [planes, setPlanes] = useState<PlanAnterior[] | null>(null)
  const [error, setError] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)

  useEffect(() => {
    cargarHistorial(sid, d.e.rutina?.publicadaAt ?? 0)
      .then(setPlanes)
      .catch(() => setError(true))
  }, [sid, d.e.rutina?.publicadaAt])

  // Ejercicios que ya hizo, con en cuántos planes aparecieron.
  const usados = useMemo(() => {
    const m = new Map<string, { nombre: string; n: number }>()
    for (const p of planes ?? []) {
      const vistos = new Set<string>()
      for (const b of fuerza(p.rutina)) {
        const k = slugify(b.nombre)
        if (!k || vistos.has(k)) continue
        vistos.add(k)
        const prev = m.get(k)
        m.set(k, { nombre: prev?.nombre ?? b.nombre, n: (prev?.n ?? 0) + 1 })
      }
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'))
  }, [planes])

  const usarComoBase = (p: PlanAnterior) => {
    const hay = readDraft(sid)
    if (hay && !window.confirm('Tenés cambios sin publicar en el plan. ¿Reemplazarlos con este plan?')) return
    writeDraft(sid, reId({ ...p.rutina, nombre: p.rutina.nombre }))
    navigate(esFichaProfe(sid) ? '/panel/mi-rutina' : `/panel/estudiante/${sid}`)
  }

  if (error) return <p className={ui.error}>No pudimos cargar el historial. Probá de nuevo.</p>
  if (!planes) return null
  if (!planes.length) {
    return (
      <div className={ui.empty} style={{ textAlign: 'left' }}>
        <p style={{ margin: 0, color: 'var(--ink)', fontSize: 17 }}>Todavía no hay planes anteriores.</p>
        <p className={ui.hint}>Cada vez que publiques un plan nuevo, el que tenía queda guardado acá.</p>
      </div>
    )
  }

  return (
    <section>
      <h2 className={ui.section}>PLANES DE {d.e.nombre.toUpperCase()}</h2>
      <p className={ui.hint}>
        {planes.length} {planes.length === 1 ? 'plan' : 'planes'}, del más nuevo al más viejo. Tocá uno para ver los ejercicios.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 10 }}>
        {planes.map((p) => {
          const open = abierto === p.id
          const ej = fuerza(p.rutina)
          return (
            <li key={p.id} style={{ border: '1px solid rgba(127,127,127,.3)', borderRadius: 14, background: 'rgba(127,127,127,.06)' }}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setAbierto(open ? null : p.id)}
                style={{ width: '100%', minHeight: 64, padding: '10px 14px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 800, fontSize: 18 }}>
                    {p.nombre}
                    {p.vigente && <span className={ui.badge} data-tone="ok" style={{ marginLeft: 8 }}>VIGENTE</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 14, opacity: 0.7 }}>
                    {fecha(p.publicadaAt)} · {p.rutina.dias.length} {p.rutina.dias.length === 1 ? 'día' : 'días'} · {ej.length} ejercicios
                  </span>
                </span>
                <span aria-hidden="true" style={{ fontSize: 18 }}>
                  {open ? '▴' : '▾'}
                </span>
              </button>
              {open && (
                <div style={{ padding: '0 14px 14px' }}>
                  {p.rutina.dias.map((dia) => (
                    <div key={dia.id} style={{ marginTop: 12 }}>
                      <div style={{ fontFamily: 'var(--font-label)', fontWeight: 800, letterSpacing: '.08em', fontSize: 15 }}>DÍA {dia.letra}</div>
                      <ol style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }}>
                        {dia.bloques
                          .filter((b) => b.tipo === 'fuerza')
                          .map((b) => (
                            <li key={b.id} style={{ display: 'flex', gap: 10, minHeight: 28, alignItems: 'baseline' }}>
                              <span style={{ flex: 1, fontWeight: 600 }}>{b.nombre}</span>
                              <span style={{ opacity: 0.65, fontSize: 14 }}>{detalle(b)}</span>
                            </li>
                          ))}
                      </ol>
                    </div>
                  ))}
                  <div className={ui.actions} style={{ justifyContent: 'flex-start' }}>
                    <button type="button" className={ui.secondary} onClick={() => usarComoBase(p)}>
                      {p.vigente ? 'Editar este plan' : 'Usar como base'}
                    </button>
                  </div>
                  {!p.vigente && <p className={ui.hint}>Lo abre en el editor como borrador. No cambia nada hasta que publiques.</p>}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {usados.length > 0 && (
        <>
          <h2 className={ui.section}>EJERCICIOS QUE YA HIZO</h2>
          <p className={ui.hint}>Con en cuántos planes aparecieron. Los de abajo son los que menos usó.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {usados.map((u) => (
              <span key={u.nombre} style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(127,127,127,.14)', fontSize: 14, fontWeight: 600 }}>
                {u.nombre}
                <span style={{ opacity: 0.6, marginLeft: 6 }}>×{u.n}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
