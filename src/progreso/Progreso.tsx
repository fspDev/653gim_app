import { useState } from 'react'
import { db, type EntrenoRow, type SerieRow } from '../db'
import { fmtKg } from '../format'
import { chartPoints, exerciseSeries, isRecent, monthView, personalRecords, streakWeeks } from '../stats'
import { useLive } from '../useLive'
import styles from './Progreso.module.css'

const loadEntrenos = () => db.entrenos.orderBy('empezadoAt').toArray()
const loadSeries = () => db.series.toArray()
const NO_ENTRENOS: EntrenoRow[] = []
const NO_SERIES: SerieRow[] = []
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const CHART_POINTS = 8

export function Progreso() {
  const entrenos = useLive(loadEntrenos, NO_ENTRENOS)
  const series = useLive(loadSeries, NO_SERIES)
  const [picked, setPicked] = useState<string | null>(null)

  const [now] = useState(() => new Date())
  const stamps = entrenos.map((e) => e.empezadoAt)
  const streak = streakWeeks(stamps, now.getTime())
  const month = monthView(stamps, now.getFullYear(), now.getMonth())
  const monthName = now.toLocaleDateString('es-AR', { month: 'long' }).toUpperCase()

  const records = personalRecords(series)
  const exercise = records.find((r) => r.exerciseId === picked) ?? records[0]
  const points = exercise ? exerciseSeries(series, exercise.exerciseId).slice(-CHART_POINTS) : []
  const xy = chartPoints(points)
  const last = xy[xy.length - 1]

  const nextExercise = () => {
    if (records.length < 2 || !exercise) return
    const i = records.findIndex((r) => r.exerciseId === exercise.exerciseId)
    setPicked(records[(i + 1) % records.length].exerciseId)
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>PROGRESO</h1>

      <div className={styles.streak}>
        <div className={styles.streakNumber}>{streak}</div>
        <div>
          <div className={styles.streakLabel}>{streak === 1 ? 'SEMANA DE RACHA' : 'SEMANAS DE RACHA'}</div>
          <div className={styles.streakHint}>3 o más entrenos por semana</div>
        </div>
      </div>

      <div className={styles.sectionHead}>
        <div className={styles.section}>{monthName}</div>
        <div className={styles.small}>
          {month.count} {month.count === 1 ? 'entreno' : 'entrenos'}
        </div>
      </div>
      <div className={styles.calendar}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} className={styles.weekday}>
            {w}
          </div>
        ))}
        {Array.from({ length: month.blanks }, (_, i) => (
          <div key={`b${i}`} className={styles.cell} />
        ))}
        {Array.from({ length: month.daysInMonth }, (_, i) => {
          const d = i + 1
          const state = d === now.getDate() ? 'today' : month.trained.has(d) ? 'trained' : 'none'
          return (
            <div key={d} className={styles.cell}>
              <div
                className={styles.day}
                data-state={state}
                aria-label={month.trained.has(d) ? `${d}, entrenaste` : undefined}
              >
                {d}
              </div>
            </div>
          )
        })}
      </div>

      {exercise ? (
        <>
          <div className={styles.sectionHead} style={{ marginTop: 20 }}>
            <button className={styles.section} onClick={nextExercise} aria-label={records.length > 1 ? `${exercise.name}. Tocá para ver otro ejercicio` : exercise.name}>
              {exercise.name.toUpperCase()}
              {records.length > 1 && <span className={styles.swap}> ›</span>}
            </button>
            <div className={styles.small}>
              {points.length} {points.length === 1 ? 'entreno' : 'entrenos'}
            </div>
          </div>
          <div className={styles.chart}>
            <svg width="100%" height="104" viewBox="0 0 342 104" preserveAspectRatio="none" className={styles.chartSvg} aria-hidden="true">
              <line x1="0" y1="96" x2="342" y2="96" stroke="var(--track)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              {xy.length > 1 && (
                <polyline
                  points={xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            {/* El punto va aparte: con preserveAspectRatio="none" un <circle> se deformaría. */}
            {last && <span className={styles.lastDot} style={{ left: `${(last.x / 342) * 100}%`, top: last.y }} />}
            <div className={styles.chartLabel}>
              {fmtKg(points[0].weight)} kg → <span className={styles.chartNow}>{fmtKg(points[points.length - 1].weight)} KG</span>
            </div>
          </div>
        </>
      ) : (
        <p className={styles.empty}>Todavía no hay entrenos guardados. Cuando termines el primero vas a ver acá tu evolución y tus récords.</p>
      )}

      {records.length > 0 && (
        <>
          <div className={styles.section} style={{ marginTop: 18 }}>
            RÉCORDS PERSONALES
          </div>
          <div className={styles.prs}>
            {records.map((r) => (
              <div key={r.exerciseId} className={styles.pr} data-recent={isRecent(r.at, now.getTime())}>
                <div className={styles.prName}>{r.name}</div>
                <div className={styles.prValue}>{fmtKg(r.weight)} KG</div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
