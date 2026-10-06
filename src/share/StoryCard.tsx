import { forwardRef } from 'react'
import type { StoryData } from './story'
import { Logo } from '../ui/Logo'
import styles from './StoryCard.module.css'

export const STORY_WIDTH = 1080
export const STORY_HEIGHT = 1920

/**
 * Historia de Instagram (Historia.dc.html), 1080×1920. Se dibuja fuera de pantalla y se saca como imagen.
 * Sin récords nuevos, el bloque rojo muestra las series completas en su lugar.
 */
export const StoryCard = forwardRef<HTMLDivElement, { data: StoryData }>(function StoryCard({ data }, ref) {
  return (
    <div ref={ref} className={styles.card} style={{ width: STORY_WIDTH, height: STORY_HEIGHT }}>
      <div className={styles.top}>
        <div className={styles.header}>
          <div>
            <Logo size="lg" />
          </div>
          <div className={styles.date}>
            {data.weekday}
            <br />
            {data.date}
          </div>
        </div>
        <div className={styles.day}>{data.day}</div>
        <div className={styles.done}>HECHO.</div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <div className={styles.num}>{data.minutes}</div>
            <div className={styles.unit}>MIN</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.num}>{data.kilos}</div>
            <div className={styles.unit}>KG</div>
          </div>
        </div>
      </div>

      <div className={styles.grow} />

      <div className={styles.bottom}>
        {data.records.length > 0 ? (
          <>
            <div className={styles.recordsTitle}>{data.recordsTitle}</div>
            <div className={styles.records}>
              {data.records.map((r, i) => (
                <div key={r.name} className={styles.record} data-last={i === data.records.length - 1}>
                  <div className={styles.recordName}>{r.name}</div>
                  <div className={styles.recordValue}>{r.value}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.record} data-last="true">
            <div className={styles.recordName}>Series completas</div>
            <div className={styles.recordValue}>{data.series}</div>
          </div>
        )}
        <div className={styles.footer}>
          <span>653 GIMNASIO</span>
          {data.streak > 0 && <span>{data.streakLabel}</span>}
        </div>
      </div>
    </div>
  )
})
