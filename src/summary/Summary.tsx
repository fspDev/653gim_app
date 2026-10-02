import { exerciseKey } from '../data'
import { fmtKg, fmtTime } from '../format'
import { useRef, useState } from 'react'
import { Shell } from '../entreno/Shell'
import { renderStory, shareImage } from '../share/share'
import { buildStory } from '../share/story'
import { StoryCard } from '../share/StoryCard'
import { Face } from '../ui/Face'
import { FEELING_LABELS } from '../ui/labels'
import type { RecordHit } from '../workout/records'
import { kilosTotal } from '../workout/selectors'
import type { Workout } from '../workout/types'
import styles from './Summary.module.css'

interface Props {
  w: Workout
  records: RecordHit[]
  /** Semanas de racha contando este entreno. */
  streak: number
  onFeeling: (value: number) => void
  onClose: () => void
}

/** Resumen final (Resumen.dc.html) con los totales reales del entreno. */
export function Summary({ w, records, streak, onFeeling, onClose }: Props) {
  const card = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const story = buildStory(w, records, streak)

  const share = async () => {
    if (!card.current || sharing) return
    setSharing(true)
    setShareMsg(null)
    try {
      const blob = await renderStory(card.current)
      const result = await shareImage(blob, `653-${story.date.replace('.', '-')}.png`, `${story.day} hecho en 653 Gym & Fitness`)
      if (result === 'downloaded') setShareMsg('Se descargó la imagen. Subila a tu historia.')
    } catch {
      setShareMsg('No pudimos armar la imagen. Probá de nuevo.')
    }
    setSharing(false)
  }

  const seconds = Math.max(0, Math.floor(((w.finishedAt ?? w.startedAt) - w.startedAt) / 1000))
  const names = new Map(w.day.blocks.map((b) => [exerciseKey(b), b.name]))
  const complete = w.estado === 'completo'

  return (
    <Shell className={styles.stage}>
      <div className={styles.col}>
        <div className={styles.head}>
          <div className={styles.topbar}>
            <div className={styles.logo}>653</div>
            <button className={styles.close} aria-label="Cerrar" onClick={onClose}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className={styles.status}>
            {complete && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
            )}
            {w.day.name.toUpperCase()} {complete ? 'COMPLETO' : 'PARCIAL'}
          </div>
          <div className={styles.time}>{fmtTime(seconds)}</div>
          <div className={styles.timeLabel}>
            de entrenamiento · {w.results.length} de {w.day.blocks.length} bloques
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.grid}>
            <div>
              <div className={styles.big}>{kilosTotal(w.logs).toLocaleString('es-AR')}</div>
              <div className={styles.bigLabel}>kilos totales</div>
            </div>
            <div>
              <div className={styles.big}>{w.logs.length}</div>
              <div className={styles.bigLabel}>series completas</div>
            </div>
          </div>

          {records.length > 0 && (
            <>
              <div className={styles.section}>
                {records.length} {records.length === 1 ? 'RÉCORD NUEVO' : 'RÉCORDS NUEVOS'}
              </div>
              <ul className={styles.records}>
                {records.map((r) => (
                  <li key={r.exerciseId} className={styles.record}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 19V5" />
                      <path d="M6 11l6-6 6 6" />
                    </svg>
                    <div className={styles.recordText}>
                      <div className={styles.recordName}>{names.get(r.exerciseId) ?? r.exerciseId}</div>
                      <div className={styles.recordPrev}>
                        antes {fmtKg(r.prev.weight)} kg × {r.prev.reps}
                      </div>
                    </div>
                    <div className={styles.recordKg}>{fmtKg(r.weight)} KG</div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className={styles.feelingTitle}>¿Cómo te sentiste hoy?</div>
          <div className={styles.faces} role="radiogroup" aria-label="¿Cómo te sentiste hoy?">
            {FEELING_LABELS.map((label, i) => {
              const on = w.feeling === i + 1
              return (
                <button key={label} className={styles.face} role="radio" aria-checked={on} aria-label={label} data-on={on} onClick={() => onFeeling(i + 1)}>
                  <Face level={i} size={30} />
                </button>
              )
            })}
          </div>

          <div className={styles.grow} />
          {shareMsg && (
            <p className={styles.shareMsg} role="status">
              {shareMsg}
            </p>
          )}
          <button className={styles.share} onClick={() => void share()} disabled={sharing}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15V3" />
              <path d="M7 8l5-5 5 5" />
              <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
            {sharing ? 'ARMANDO LA IMAGEN…' : 'COMPARTIR'}
          </button>
        </div>
      </div>

      {/* La historia se dibuja fuera de pantalla y se saca como imagen al compartir. */}
      <div className={styles.offscreen} aria-hidden="true">
        <StoryCard ref={card} data={story} />
      </div>
    </Shell>
  )
}
