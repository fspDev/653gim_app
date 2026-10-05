import { useState } from 'react'
import { fmtKg } from '../format'
import type { RemoteEntreno } from '../syncFormat'
import { Face } from '../ui/Face'
import { EFFORT_LABELS, FEELING_LABELS } from '../ui/labels'
import type { TabProps } from './Estudiante'
import styles from './Registro.module.css'
import ui from './ui.module.css'

const fecha = (ts: number) => {
  const s = new Date(ts).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const hora = (ts: number) => new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

/** Series agrupadas por ejercicio, en el orden en que las hizo. */
function porEjercicio(e: RemoteEntreno) {
  const groups = new Map<string, { nombre: string; series: RemoteEntreno['series'] }>()
  for (const s of [...(e.series ?? [])].sort((a, b) => a.hechaAt - b.hechaAt)) {
    const g = groups.get(s.bloqueId) ?? { nombre: s.ejercicio, series: [] }
    g.series.push(s)
    groups.set(s.bloqueId, g)
  }
  return [...groups.values()]
}

/** Cada entreno que hizo, con el detalle de cada serie: peso, repeticiones y cómo la sintió. */
export function Registro({ d }: TabProps) {
  const [open, setOpen] = useState<string | null>(d.entrenos[0]?.id ?? null)

  if (d.entrenos.length === 0) return <p className={ui.empty}>Todavía no registró ningún entreno. Cuando termine el primero, aparece acá con cada serie.</p>

  return (
    <section>
      <p className={ui.hint} style={{ marginTop: 16 }}>
        {d.entrenos.length} {d.entrenos.length === 1 ? 'entreno registrado' : 'entrenos registrados'}. Tocá uno para ver cada serie.
      </p>
      <ul className={styles.list}>
        {d.entrenos.map((e) => {
          const mins = Math.max(1, Math.round((e.terminadoAt - e.empezadoAt) / 60000))
          const isOpen = open === e.id
          return (
            <li key={e.id} className={styles.item}>
              <button className={styles.head} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.id)}>
                <span className={styles.letter}>{e.dayLetter || '·'}</span>
                <span className={styles.headText}>
                  <span className={styles.date}>{fecha(e.empezadoAt)}</span>
                  <span className={styles.meta}>
                    {hora(e.empezadoAt)} · {mins} min · {e.bloquesHechos}/{e.bloquesTotal} bloques · {fmtKg(e.kilosTotal)} kg movidos
                  </span>
                </span>
                <span className={ui.badge} data-tone={e.estado === 'completo' ? 'ok' : 'aviso'}>
                  {e.estado === 'completo' ? 'Completo' : 'Cortó antes'}
                </span>
              </button>
              {isOpen && (
                <div className={styles.body}>
                  {e.sensacion !== null && e.sensacion !== undefined && (
                    <div className={styles.feeling}>
                      <Face level={e.sensacion} size={24} />
                      Terminó {FEELING_LABELS[e.sensacion].toLowerCase()}
                    </div>
                  )}
                  {porEjercicio(e).map((g) => (
                    <div key={g.nombre} className={styles.ex}>
                      <div className={styles.exName}>{g.nombre}</div>
                      <ol className={styles.sets}>
                        {g.series.map((s) => (
                          <li key={s.id} className={styles.set} data-short={s.reps < s.targetReps}>
                            <span className={styles.setN}>{s.serieN}</span>
                            <span className={styles.setMain}>
                              {fmtKg(s.pesoKg)} kg × {s.reps}
                              {s.reps < s.targetReps && <span className={styles.of}> de {s.targetReps}</span>}
                            </span>
                            {s.esfuerzo !== null && s.esfuerzo !== undefined && <span className={styles.effort}>{EFFORT_LABELS[s.esfuerzo - 1] ?? ''}</span>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                  {(e.series ?? []).length === 0 && <p className={ui.hint}>Sin series de fuerza (bloques por tiempo o circuitos).</p>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
