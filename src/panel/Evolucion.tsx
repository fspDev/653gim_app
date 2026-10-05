import { useMemo, useState, type FormEvent } from 'react'
import { fmtKg } from '../format'
import { localDateKey } from '../keys'
import { exerciseSeries, personalRecords, streakWeeks, weekStart } from '../stats'
import { borrarMedida, guardarMedida, seriesOf, type Medida } from './api'
import { BarChart, LineChart, type Punto } from './charts'
import type { TabProps } from './Estudiante'
import styles from './Evolucion.module.css'
import ui from './ui.module.css'

const WEEK = 7 * 24 * 60 * 60 * 1000
const corta = (ts: number) => {
  const d = new Date(ts)
  return `${d.getDate()}/${d.getMonth() + 1}`
}
const isoCorta = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`

export function Evolucion({ d, reload }: TabProps) {
  const [now] = useState(() => Date.now())
  const stamps = d.entrenos.map((e) => e.empezadoAt)
  const series = useMemo(() => seriesOf(d.entrenos), [d.entrenos])
  const records = useMemo(() => personalRecords(series), [series])
  const [ex, setEx] = useState(records[0]?.exerciseId ?? '')

  // Entrenos por semana, últimas 10.
  const thisWeek = weekStart(now)
  const semanas: Punto[] = Array.from({ length: 10 }, (_, i) => {
    const start = thisWeek - (9 - i) * WEEK
    const n = stamps.filter((t) => t >= start && t < start + WEEK).length
    return { label: corta(start), value: n, tip: `Semana del ${corta(start)}: ${n} ${n === 1 ? 'entreno' : 'entrenos'}` }
  })
  const mes = stamps.filter((t) => new Date(t).getMonth() === new Date(now).getMonth() && new Date(t).getFullYear() === new Date(now).getFullYear()).length
  const prom = semanas.slice(-4).reduce((s, p) => s + p.value, 0) / 4
  const diasPlan = d.rutina?.dias.length ?? 0

  const puntos = exerciseSeries(series, ex)
  const rec = records.find((r) => r.exerciseId === ex)

  return (
    <section>
      <div className={styles.tiles}>
        <Tile value={String(stamps.length)} label="entrenos en total" />
        <Tile value={String(mes)} label="este mes" />
        <Tile value={fmtKg(prom)} label={`por semana (últ. 4)${diasPlan ? ` · plan de ${diasPlan}` : ''}`} />
        <Tile value={String(streakWeeks(stamps, now))} label="semanas seguidas con 3 o más" />
      </div>

      <h2 className={ui.section}>CONSTANCIA · ENTRENOS POR SEMANA</h2>
      <div className={ui.card}>
        <BarChart data={semanas} label="Entrenos por semana en las últimas 10 semanas" />
      </div>

      <h2 className={ui.section}>PROGRESO POR EJERCICIO</h2>
      {records.length === 0 ? (
        <p className={ui.hint}>Cuando registre series de fuerza, acá vas a ver cómo sube el peso en cada ejercicio.</p>
      ) : (
        <div className={ui.card}>
          <div className={styles.exHead}>
            <label htmlFor="ev-ej" className={ui.srOnly}>
              Ejercicio
            </label>
            <select id="ev-ej" className={ui.select} style={{ marginTop: 0, maxWidth: 320, background: 'var(--bg)' }} value={ex} onChange={(e) => setEx(e.target.value)}>
              {records.map((r) => (
                <option key={r.exerciseId} value={r.exerciseId}>
                  {r.name}
                </option>
              ))}
            </select>
            {rec && (
              <div className={styles.record}>
                Mejor serie: <strong>{fmtKg(rec.weight)} kg × {rec.reps}</strong> ({corta(rec.at)})
              </div>
            )}
          </div>
          <LineChart data={puntos.map((p) => ({ label: corta(p.at), value: p.weight, tip: `${fmtKg(p.weight)} kg · ${corta(p.at)}` }))} label={`Peso más alto por entreno en ${rec?.name ?? 'el ejercicio'}`} />
          <p className={ui.hint}>
            Peso más alto de cada entreno.{' '}
            {puntos.length > 1 && `De ${fmtKg(puntos[0].weight)} kg a ${fmtKg(puntos[puntos.length - 1].weight)} kg en ${puntos.length} entrenos.`}
          </p>
        </div>
      )}

      <Medidas sid={d.e.id} medidas={d.medidas} reload={reload} />
    </section>
  )
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.tile}>
      <div className={styles.tileValue}>{value}</div>
      <div className={styles.tileLabel}>{label}</div>
    </div>
  )
}

const num = (t: string) => {
  const n = Number(t.trim().replace(',', '.'))
  return t.trim() && Number.isFinite(n) && n > 0 ? n : null
}

function Medidas({ sid, medidas, reload }: { sid: string; medidas: Medida[]; reload: () => void }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ fecha: localDateKey(), peso: '', grasa: '', cintura: '', nota: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conPeso = medidas.filter((m) => m.pesoKg !== null)
  const ok = !!f.fecha && (num(f.peso) || num(f.grasa) || num(f.cintura) || f.nota.trim())

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await guardarMedida(sid, { fecha: f.fecha, pesoKg: num(f.peso), grasaPct: num(f.grasa), cinturaCm: num(f.cintura), nota: f.nota.trim() })
      setF({ fecha: localDateKey(), peso: '', grasa: '', cintura: '', nota: '' })
      setOpen(false)
      reload()
    } catch {
      setError('No se pudo guardar. Probá de nuevo.')
    }
    setBusy(false)
  }

  return (
    <>
      <div className={styles.medHead}>
        <h2 className={ui.section}>MEDIDAS</h2>
        {!open && (
          <button className={ui.ghost} onClick={() => setOpen(true)}>
            + Nueva medición
          </button>
        )}
      </div>

      {open && (
        <form className={ui.card} onSubmit={submit}>
          <div className={styles.medForm}>
            <label>
              <span className={ui.label}>FECHA</span>
              <input className={ui.input} type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
            </label>
            <label>
              <span className={ui.label}>PESO (KG)</span>
              <input className={ui.input} inputMode="decimal" value={f.peso} onChange={(e) => setF({ ...f, peso: e.target.value })} />
            </label>
            <label>
              <span className={ui.label}>% GRASA</span>
              <input className={ui.input} inputMode="decimal" value={f.grasa} onChange={(e) => setF({ ...f, grasa: e.target.value })} />
            </label>
            <label>
              <span className={ui.label}>CINTURA (CM)</span>
              <input className={ui.input} inputMode="decimal" value={f.cintura} onChange={(e) => setF({ ...f, cintura: e.target.value })} />
            </label>
          </div>
          <label>
            <span className={ui.label}>NOTA</span>
            <input className={ui.input} placeholder="Opcional" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} />
          </label>
          {error && <p className={ui.error}>{error}</p>}
          <div className={ui.actions}>
            <button type="button" className={ui.link} onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className={ui.primary} disabled={!ok || busy}>
              GUARDAR
            </button>
          </div>
        </form>
      )}

      {conPeso.length > 1 && (
        <div className={ui.card} style={{ marginTop: 10 }}>
          <div className={styles.chartTitle}>Peso corporal (kg)</div>
          <LineChart data={conPeso.map((m) => ({ label: isoCorta(m.fecha), value: m.pesoKg!, tip: `${fmtKg(m.pesoKg!)} kg · ${isoCorta(m.fecha)}` }))} label="Peso corporal en cada medición" />
        </div>
      )}

      {medidas.length === 0 && !open ? (
        <p className={ui.hint}>Sin mediciones todavía. Cargá peso, % de grasa o cintura para seguir su evolución.</p>
      ) : (
        medidas.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Peso</th>
                  <th>% grasa</th>
                  <th>Cintura</th>
                  <th>Nota</th>
                  <th>
                    <span className={ui.srOnly}>Borrar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...medidas].reverse().map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(`${m.fecha}T12:00:00`).toLocaleDateString('es-AR')}</td>
                    <td>{m.pesoKg !== null ? `${fmtKg(m.pesoKg)} kg` : '—'}</td>
                    <td>{m.grasaPct !== null ? `${fmtKg(m.grasaPct)} %` : '—'}</td>
                    <td>{m.cinturaCm !== null ? `${fmtKg(m.cinturaCm)} cm` : '—'}</td>
                    <td className={styles.nota}>{m.nota}</td>
                    <td>
                      <button
                        className={ui.iconBtn}
                        aria-label={`Borrar la medición del ${m.fecha}`}
                        onClick={() => {
                          if (confirm('¿Borrar esta medición?')) void borrarMedida(sid, m.id).then(reload)
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  )
}
