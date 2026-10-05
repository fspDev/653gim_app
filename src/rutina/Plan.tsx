import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/context'
import type { Block } from '../data'
import { fmtKg, fmtTime } from '../format'
import { ProfeNota } from '../ui/ProfeNota'
import styles from './Plan.module.css'
import { useDays } from './useDays'

function detail(b: Block): string {
  if (b.kind === 'fuerza') {
    const parts = [`${b.series} × ${b.reps}`]
    if (b.weight) parts.push(`${fmtKg(b.weight)} kg`)
    if (b.restSeconds) parts.push(`descanso ${fmtTime(b.restSeconds)}`)
    return parts.join(' · ')
  }
  if (b.kind === 'circuito') return `${b.rounds} rondas · ${b.steps.map((s) => s.name).join(', ')}`
  return `${b.minutes} min${b.hint ? ` · ${b.hint}` : ''}`
}

/** El plan que armó el profe, día por día, con sus indicaciones y videos. Solo lectura. */
export function Plan() {
  const { profile } = useAuth()
  const { rutina, days, loading } = useDays()
  const [dayId, setDayId] = useState<string | null>(null)
  const day = days.find((d) => d.id === dayId) ?? days[0]

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>MI PLAN</h1>
      {loading ? null : !rutina || !day ? (
        <p className={styles.lead}>
          {profile?.rol === 'profe' ? (
            <>
              Todavía no armaste tu rutina. <Link to="/panel/mi-rutina">Armala en el panel</Link>.
            </>
          ) : (
            'Tu profe todavía no te armó el plan. Apenas lo publique, aparece acá.'
          )}
        </p>
      ) : (
        <>
          <p className={styles.lead}>
            {rutina.nombre}
            {profile?.rol === 'estudiante' && profile.profeNombre ? ` · armado por ${profile.profeNombre}` : ''}
          </p>

          {days.length > 1 && (
            <div className={styles.days} role="tablist" aria-label="Días">
              {days.map((d) => (
                <button key={d.id} role="tab" aria-selected={d.id === day.id} className={styles.day} onClick={() => setDayId(d.id)}>
                  {d.letter}
                </button>
              ))}
            </div>
          )}

          <div className={styles.meta}>
            {day.name.toUpperCase()} · {day.blocks.reduce((s, b) => s + b.minutes, 0)} MIN
          </div>

          <ol className={styles.list}>
            {day.blocks.map((b, i) => (
              <li key={b.id} className={styles.card}>
                <div className={styles.row}>
                  <span className={styles.n}>{i + 1}</span>
                  <div className={styles.text}>
                    <div className={styles.name}>{b.name}</div>
                    <div className={styles.detail}>{detail(b)}</div>
                  </div>
                </div>
                {(b.note || b.video) && (
                  <div className={styles.extra}>
                    <ProfeNota note={b.note} video={b.video} compact />
                  </div>
                )}
              </li>
            ))}
          </ol>
          <p className={styles.hint}>
            {profile?.rol === 'profe' ? (
              <Link to="/panel/mi-rutina">Editar mi rutina en el panel</Link>
            ) : (
              'El peso arranca donde lo dejaste la última vez. Si tu profe lo cambia, manda el del profe.'
            )}
          </p>
        </>
      )}
    </main>
  )
}
