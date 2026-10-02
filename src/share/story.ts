import { exerciseKey } from '../data'
import { fmtKg } from '../format'
import type { RecordHit } from '../workout/records'
import { kilosTotal } from '../workout/selectors'
import type { Workout } from '../workout/types'

/** Los datos que lleva la historia de Instagram (Historia.dc.html), ya formateados. */
export interface StoryData {
  /** "MIÉ 30.09" en dos líneas. */
  weekday: string
  date: string
  /** "DÍA B" */
  day: string
  minutes: number
  kilos: string
  series: number
  records: { name: string; value: string }[]
  recordsTitle: string
  streak: number
  streakLabel: string
}

const MAX_RECORDS = 3

export function buildStory(w: Workout, records: RecordHit[], streak: number): StoryData {
  const at = new Date(w.finishedAt ?? w.startedAt)
  const names = new Map(w.day.blocks.map((b) => [exerciseKey(b), b.name]))
  const seconds = Math.max(0, ((w.finishedAt ?? w.startedAt) - w.startedAt) / 1000)

  return {
    weekday: at.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '').toUpperCase(),
    date: `${String(at.getDate()).padStart(2, '0')}.${String(at.getMonth() + 1).padStart(2, '0')}`,
    day: w.day.name.toUpperCase(),
    minutes: Math.round(seconds / 60),
    kilos: kilosTotal(w.logs).toLocaleString('es-AR'),
    series: w.logs.length,
    records: records.slice(0, MAX_RECORDS).map((r) => ({ name: names.get(r.exerciseId) ?? r.exerciseId, value: `${fmtKg(r.weight)} KG` })),
    recordsTitle: `${records.length} ${records.length === 1 ? 'RÉCORD NUEVO' : 'RÉCORDS NUEVOS'}`,
    streak,
    streakLabel: `${streak} ${streak === 1 ? 'SEMANA' : 'SEMANAS'} DE RACHA`,
  }
}
