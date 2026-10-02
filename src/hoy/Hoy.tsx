import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import type { Block, Day } from '../data'
import { db, type EntrenoRow } from '../db'
import { useDays } from '../rutina/useDays'
import { streakWeeks } from '../stats'
import { useLive } from '../useLive'
import { clearActive, loadActive } from '../workout/persist'
import { startWorkout } from '../workout/start'
import { isPiPSupported, openPiP } from '../pip/pipEngine'
import { getSettings } from '../settings'
import styles from './Hoy.module.css'
import { SinRutina } from './SinRutina'
import { SlideToStart } from './SlideToStart'

const loadEntrenos = () => db.entrenos.orderBy('empezadoAt').toArray()
const NO_ENTRENOS: EntrenoRow[] = []

/** Cuál toca hoy: el día que sigue al último entrenado, en orden de rutina. */
function todaysDay(entrenos: EntrenoRow[], days: Day[]) {
  const last = entrenos[entrenos.length - 1]
  const i = last ? days.findIndex((d) => d.id === last.dayId) : -1
  return days[(i + 1) % days.length]
}

function blockDetail(b: Block): string {
  if (b.kind === 'fuerza') return `${b.series} × ${b.reps}`
  if (b.kind === 'tiempo' && b.subtitle) return `${b.subtitle.toLowerCase()} · ${b.minutes} min`
  return `${b.minutes} min`
}

/** Color de la línea de tiempo: el primero oscuro, la fuerza media, el resto claro. */
const tone = (b: Block, i: number) => (i === 0 ? 'ink' : b.kind === 'fuerza' ? 'mid' : 'light')

export function Hoy() {
  const { loading, sinRutina, days } = useDays()
  const active = loadActive()
  // Con un entreno en curso (aunque sea libre) se muestra ese; si no, depende de la rutina.
  if (!active && loading) return null
  if (!active && sinRutina) return <SinRutina />
  return <HoyDia days={days} active={active} />
}

function HoyDia({ days, active }: { days: Day[]; active: ReturnType<typeof loadActive> }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [today] = useState(() => new Date())
  const entrenos = useLive(loadEntrenos, NO_ENTRENOS)
  const [chosen, setChosen] = useState<string | null>(null)
  const suggested = todaysDay(entrenos, days)
  const day = active?.day ?? days.find((d) => d.id === chosen) ?? suggested
  const streak = streakWeeks(entrenos.map((e) => e.empezadoAt), today.getTime())
  const minutes = day.blocks.reduce((s, b) => s + b.minutes, 0)

  const weekday = today.toLocaleDateString('es-AR', { weekday: 'long' })
  const first = profile?.nombre.trim().split(/\s+/)[0]
  const greeting = `Buenas${first ? `, ${first}` : ''}. ${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${today.getDate()}.`

  const start = async () => {
    // "Deslizá para empezar" es el toque que abre la ventana flotante cuando el primer bloque es la bici
    // (no tiene HECHA). Se pide antes de cualquier espera, mientras el gesto sigue vigente.
    if (getSettings().flotante === 'serie' && isPiPSupported()) void openPiP()
    if (!active) await startWorkout(day)
    navigate('/entreno')
  }

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <div className={styles.logo}>653</div>
        {streak > 0 && (
          <div className={styles.streak}>
            <span className={styles.dot} />
            {streak} {streak === 1 ? 'SEMANA' : 'SEMANAS'}
          </div>
        )}
      </div>

      <div className={styles.greeting}>{greeting}</div>
      <div className={styles.eyebrow}>{active ? 'ENTRENO EN CURSO' : day.id === suggested.id ? 'HOY TOCA' : 'ELEGISTE'}</div>
      <div className={styles.dayName}>{day.name.toUpperCase()}</div>
      <div className={styles.meta}>
        {minutes} min <span className={styles.sep}>·</span> {day.blocks.length} bloques
      </div>

      {!active && days.length > 1 && (
        <div className={styles.days} role="radiogroup" aria-label="Elegí el día">
          {days.map((d) => (
            <button key={d.id} className={styles.dayPill} role="radio" aria-checked={d.id === day.id} aria-label={d.name} onClick={() => setChosen(d.id)}>
              {d.letter}
            </button>
          ))}
        </div>
      )}

      <div className={styles.timeline} aria-hidden="true">
        {day.blocks.map((b, i) => (
          <div key={b.id} className={styles.seg} data-tone={tone(b, i)} style={{ flexGrow: b.minutes }}>
            {i + 1}
          </div>
        ))}
      </div>

      <ol className={styles.list}>
        {day.blocks.map((b, i) => (
          <li key={b.id} className={styles.row}>
            <span className={styles.n}>{i + 1}</span>
            <span className={styles.name}>{b.name}</span>
            <span className={styles.detail}>{blockDetail(b)}</span>
          </li>
        ))}
      </ol>

      <div className={styles.grow} />

      <div className={styles.footer}>
        <SlideToStart
          label={active ? 'DESLIZÁ PARA SEGUIR' : 'DESLIZÁ PARA EMPEZAR'}
          ariaLabel={active ? 'Deslizá para seguir el entrenamiento' : 'Deslizá para empezar el entrenamiento'}
          onComplete={() => void start()}
        />
        {active ? (
          <button
            className={styles.discard}
            onClick={() => {
              clearActive()
              navigate(0)
            }}
          >
            Descartar el entreno en curso
          </button>
        ) : (
          <div className={styles.spacer} />
        )}
      </div>
    </main>
  )
}
