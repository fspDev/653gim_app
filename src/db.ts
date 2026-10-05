import Dexie, { type EntityTable } from 'dexie'
import type { Workout } from './workout/types'
import { kilosTotal } from './workout/selectors'

/** Espejo local de `entrenos` / `series_hechas` del PLAN.md. */
export interface EntrenoRow {
  id: string
  dayId: string
  dayLetter: string
  dayName: string
  empezadoAt: number
  terminadoAt: number
  estado: 'completo' | 'parcial'
  sensacion: number | null
  kilosTotal: number
  bloquesHechos: number
  bloquesTotal: number
  /** 0 = pendiente de subir, 1 = sincronizado. */
  synced: 0 | 1
}

export interface SerieRow {
  id: string
  entrenoId: string
  bloqueId: string
  exerciseId: string
  ejercicio: string
  serieN: number
  targetReps: number
  reps: number
  pesoKg: number
  esfuerzo: number | null
  hechaAt: number
}

class AppDB extends Dexie {
  entrenos!: EntityTable<EntrenoRow, 'id'>
  series!: EntityTable<SerieRow, 'id'>

  constructor() {
    super('g653')
    this.version(1).stores({
      entrenos: 'id, empezadoAt, synced',
      series: 'id, entrenoId, exerciseId, hechaAt',
    })
  }
}

export const db = new AppDB()

export function toRows(w: Workout): { entreno: EntrenoRow; series: SerieRow[] } {
  const names = new Map(w.day.blocks.map((b) => [b.id, b.name]))
  return {
    entreno: {
      id: w.id,
      dayId: w.day.id,
      dayLetter: w.day.letter,
      dayName: w.day.name,
      empezadoAt: w.startedAt,
      terminadoAt: w.finishedAt ?? Date.now(),
      estado: w.estado,
      sensacion: w.feeling,
      kilosTotal: kilosTotal(w.logs),
      bloquesHechos: w.results.length,
      bloquesTotal: w.day.blocks.length,
      synced: 0,
    },
    series: w.logs.map((l) => ({
      id: l.id,
      entrenoId: w.id,
      bloqueId: l.blockId,
      exerciseId: l.exerciseId,
      ejercicio: names.get(l.blockId) ?? l.blockId,
      serieN: l.serie,
      targetReps: l.targetReps,
      reps: l.reps,
      pesoKg: l.weight,
      esfuerzo: l.effort,
      hechaAt: l.at,
    })),
  }
}

/** Idempotente (put por id): se puede llamar de nuevo si cambia la sensación. */
export async function saveFinished(w: Workout) {
  const { entreno, series } = toRows(w)
  await db.transaction('rw', db.entrenos, db.series, async () => {
    await db.entrenos.put(entreno)
    await db.series.where('entrenoId').equals(entreno.id).delete()
    await db.series.bulkPut(series)
  })
}
