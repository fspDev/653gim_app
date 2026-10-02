interface BlockBase {
  /** Slug estable; hasta la fase 3 también hace de id de ejercicio. */
  id: string
  name: string
  /** Nombre corto para encabezados chicos. */
  short: string
  minutes: number
}

/** Bici, elongación: cuenta regresiva simple. */
export interface TimeBlock extends BlockBase {
  kind: 'tiempo'
  subtitle?: string
  hint?: string
}

export interface StrengthBlock extends BlockBase {
  kind: 'fuerza'
  /** Ejercicio de la biblioteca; el progreso y los récords se llevan por ejercicio, no por bloque. Si falta, vale `id`. */
  exerciseId?: string
  series: number
  reps: number
  weight: number
  /** Descanso entre series, en segundos. Si falta, vale el ajuste del Perfil (por defecto 1:30). */
  restSeconds?: number
  /** Salto de peso sugerido (kg) si la última vez se completó todo. */
  suggestion?: number
}

export interface CircuitStep {
  name: string
  seconds?: number
  reps?: number
}

/** Rondas con pasos por tiempo o por reps. */
export interface CircuitBlock extends BlockBase {
  kind: 'circuito'
  rounds: number
  steps: CircuitStep[]
}

export type Block = TimeBlock | StrengthBlock | CircuitBlock

export interface Day {
  id: string
  letter: string
  name: string
  blocks: Block[]
}

/** Día B de ejemplo (HANDOFF.md). Los pesos salvo sentadilla y press banca son de relleno. */
export const DAY_B: Day = {
  id: 'dia-b',
  letter: 'B',
  name: 'Día B',
  blocks: [
    { id: 'bici', kind: 'tiempo', name: 'Bici fija', short: 'BICI', minutes: 8, subtitle: 'Calentamiento', hint: 'Ritmo suave · 70–80 rpm' },
    { id: 'sentadilla', kind: 'fuerza', name: 'Sentadilla con barra', short: 'SENTADILLA', minutes: 8, series: 4, reps: 8, weight: 42.5 },
    { id: 'press-banca', kind: 'fuerza', name: 'Press banca', short: 'PRESS BANCA', minutes: 8, series: 4, reps: 8, weight: 35 },
    { id: 'remo', kind: 'fuerza', name: 'Remo con mancuerna', short: 'REMO', minutes: 6, series: 3, reps: 10, weight: 22 },
    { id: 'peso-muerto', kind: 'fuerza', name: 'Peso muerto rumano', short: 'PESO MUERTO', minutes: 6, series: 3, reps: 10, weight: 40 },
    { id: 'press-militar', kind: 'fuerza', name: 'Press militar', short: 'PRESS MILITAR', minutes: 6, series: 3, reps: 10, weight: 20 },
    {
      id: 'plancha',
      kind: 'circuito',
      name: 'Plancha + core',
      short: 'CORE',
      minutes: 5,
      rounds: 3,
      steps: [
        { name: 'Plancha frontal', seconds: 45 },
        { name: 'Plancha lateral derecha', seconds: 30 },
        { name: 'Plancha lateral izquierda', seconds: 30 },
        { name: 'Dead bug', reps: 12 },
      ],
    },
    { id: 'elongacion', kind: 'tiempo', name: 'Elongación', short: 'ELONGACIÓN', minutes: 5, subtitle: 'Enfriamiento', hint: 'Respiración lenta' },
  ],
}

export const DAYS: Day[] = [DAY_B]

/** Lo que se ofrece cuando el profe todavía no cargó la rutina (SinRutina.dc.html). */
export const DAY_LIBRE: Day = {
  id: 'libre',
  letter: 'L',
  name: 'Entreno libre',
  blocks: [
    { id: 'libre-bici', kind: 'tiempo', name: 'Bici fija', short: 'BICI', minutes: 10, subtitle: 'Calentamiento', hint: 'Ritmo suave · 70–80 rpm' },
    { id: 'libre-elongacion', kind: 'tiempo', name: 'Elongación', short: 'ELONGACIÓN', minutes: 10, subtitle: 'Enfriamiento', hint: 'Respiración lenta' },
  ],
}

/** Clave del ejercicio para historial, récords y sugerencias. */
export const exerciseKey = (b: Block): string => (b.kind === 'fuerza' ? (b.exerciseId ?? b.id) : b.id)
