import type { Block, CircuitStep, Day } from '../data'
import { slugify } from '../keys'

export interface BloqueRow {
  id: string
  orden: number
  tipo: 'fuerza' | 'tiempo' | 'circuito'
  ejercicio_id: string | null
  nombre: string
  series: number | null
  reps: number | null
  peso_kg: number | null
  descanso_s: number | null
  minutos: number | null
  rondas: number | null
  pasos: { nombre: string; segundos?: number | null; reps?: number | null }[] | null
  /** Solo bloques por tiempo: "Calentamiento", "Final". */
  subtitulo?: string | null
  /** Solo bloques por tiempo: "Ritmo suave · 70–80 rpm". */
  indicacion?: string | null
  /** Indicación del profe para este ejercicio ("bajá lento, 3 segundos"). */
  comentario?: string | null
  /** Video de YouTube con la técnica. */
  video_url?: string | null
  /** Solo fuerza: esfuerzo percibido (1–10) que indica el profe para cada serie. */
  rpe?: (number | null)[] | null
}

export interface DiaRow {
  id: string
  letra: string
  orden: number
  bloques: BloqueRow[]
}

export interface RutinaRow {
  id: string
  nombre: string
  dias_por_semana: number | null
  version: number
  publicada_at: string | null
  dias: DiaRow[]
}

/** La rutina tal como la usa la app, lista para guardar en el teléfono. */
export interface Rutina {
  id: string
  nombre: string
  version: number
  diasPorSemana: number | null
  days: Day[]
}

/** "Sentadilla con barra" → "SENTADILLA"; "Press banca" → "PRESS BANCA". Palabras cortas se juntan con la siguiente. */
export function shortName(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/)
  if (words.length > 1 && words[0].length <= 5) return `${words[0]} ${words[1]}`
  return words[0] ?? ''
}

const MIN_PER_SET = 0.75 // lo que dura hacer la serie, aparte del descanso

/** Minutos que ocupa el bloque en la línea de tiempo: el cargado por el profe, o una estimación. */
function minutesFor(row: BloqueRow): number {
  if (row.minutos) return row.minutos
  if (row.tipo === 'fuerza') return Math.max(1, Math.round((row.series ?? 1) * ((row.descanso_s ?? 90) / 60 + MIN_PER_SET)))
  if (row.tipo === 'circuito') {
    const perRound = (row.pasos ?? []).reduce((s, p) => s + (p.segundos ?? (p.reps ?? 10) * 3), 0)
    return Math.max(1, Math.round((perRound * (row.rondas ?? 1)) / 60))
  }
  return 5
}

export function mapBloque(row: BloqueRow): Block {
  const base = {
    id: row.id,
    name: row.nombre,
    short: shortName(row.nombre),
    minutes: minutesFor(row),
    note: row.comentario?.trim() || undefined,
    video: row.video_url?.trim() || undefined,
  }
  switch (row.tipo) {
    case 'fuerza':
      return {
        ...base,
        kind: 'fuerza',
        // Sin ejercicio de biblioteca, el historial se lleva por nombre (como en la app anterior).
        exerciseId: row.ejercicio_id ?? (slugify(row.nombre) || row.id),
        series: row.series ?? 3,
        reps: row.reps ?? 10,
        weight: row.peso_kg ?? 0,
        restSeconds: row.descanso_s ?? undefined,
        rpe: row.rpe?.some((r) => r !== null && r !== undefined) ? row.rpe : undefined,
      }
    case 'circuito': {
      const steps: CircuitStep[] = (row.pasos ?? []).map((p) => (p.segundos ? { name: p.nombre, seconds: p.segundos } : { name: p.nombre, reps: p.reps ?? 10 }))
      return { ...base, kind: 'circuito', rounds: row.rondas ?? 1, steps }
    }
    case 'tiempo':
      return { ...base, kind: 'tiempo', subtitle: row.subtitulo ?? undefined, hint: row.indicacion ?? undefined }
  }
}

export function mapRutina(row: RutinaRow): Rutina {
  const days: Day[] = [...row.dias]
    .sort((a, b) => a.orden - b.orden)
    .map((d) => ({
      id: d.id,
      letter: d.letra,
      name: `Día ${d.letra}`,
      blocks: [...d.bloques].sort((a, b) => a.orden - b.orden).map(mapBloque),
    }))
    // Un día sin bloques no se puede entrenar.
    .filter((d) => d.blocks.length > 0)
  return { id: row.id, nombre: row.nombre, version: row.version, diasPorSemana: row.dias_por_semana, days }
}
