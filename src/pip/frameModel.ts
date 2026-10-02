import { secondsLeft } from '../workout/reducer'
import type { Workout } from '../workout/types'

/** Qué hace cada control de la ventana flotante en este momento (null = no hace nada). */
export type PipCommand =
  | 'done'
  | 'skip-rest'
  | 'rest-plus'
  | 'time-toggle'
  | 'time-finish'
  | 'circuit-next'
  | 'circuit-prev'
  | 'circuit-toggle'
  | 'between-start'
  | 'between-toggle'

export interface PipControls {
  next: PipCommand | null
  prev: PipCommand | null
  playPause: PipCommand | null
  /** Texto chico de abajo: qué hacen los botones. */
  legend: string
}

export type PipTheme = 'accent' | 'dark' | 'light'

export interface PipFrame {
  theme: PipTheme
  /** Arriba a la izquierda: "SERIE 2 / 4", "DESCANSO", "CALENTAMIENTO". */
  kicker: string
  /** El número grande: peso, tiempo, reps. */
  big: string
  /** Unidad o aclaración debajo del número: "KG", "REPS". */
  unit: string
  /** Nombre del ejercicio o bloque. */
  title: string
  /** Línea secundaria: "Sigue: serie 3 · 42,5 kg". */
  sub: string
  /** 0–1 para el anillo; null = sin anillo. */
  ring: number | null
  paused: boolean
  controls: PipControls
}

const kg = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 })

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function legendOf(c: Omit<PipControls, 'legend'>): string {
  const label: Record<PipCommand, string> = {
    done: 'HECHA',
    'skip-rest': 'SALTAR',
    'rest-plus': '+15 s',
    'time-toggle': 'PAUSA',
    'time-finish': 'TERMINAR',
    'circuit-next': 'SIGUIENTE',
    'circuit-prev': 'ANTERIOR',
    'circuit-toggle': 'PAUSA',
    'between-start': 'EMPEZAR YA',
    'between-toggle': 'PAUSA',
  }
  const parts: string[] = []
  if (c.prev) parts.push(`⏮ ${label[c.prev]}`)
  if (c.playPause) parts.push(`⏯ ${label[c.playPause]}`)
  if (c.next) parts.push(`⏭ ${label[c.next]}`)
  return parts.join('   ')
}

function controls(c: Omit<PipControls, 'legend'>): PipControls {
  return { ...c, legend: legendOf(c) }
}

/** El estado del entreno → lo que dibuja la ventana flotante. Función pura. */
export function frameOf(w: Workout, now: number): PipFrame {
  const block = w.day.blocks[w.index]
  const next = w.day.blocks[w.index + 1]
  const run = w.run

  if (w.stage === 'done') {
    return {
      theme: 'dark',
      kicker: 'ENTRENO',
      big: '✓',
      unit: '',
      title: 'TERMINASTE',
      sub: 'Volvé a la app para ver el resumen',
      ring: null,
      paused: false,
      controls: controls({ next: null, prev: null, playPause: null }),
    }
  }

  if (w.stage === 'between') {
    const paused = w.betweenLeft !== null
    const left = paused ? Math.ceil(w.betweenLeft! / 1000) : secondsLeft(w.betweenEnd, now)
    return {
      theme: 'dark',
      kicker: 'SIGUE',
      big: String(left),
      unit: paused ? 'EN PAUSA' : 'ARRANCA SOLO',
      title: (next?.name ?? '').toUpperCase(),
      sub: `Bloque ${w.index + 2} de ${w.day.blocks.length}`,
      ring: null,
      paused,
      controls: controls({ next: 'between-start', prev: null, playPause: 'between-toggle' }),
    }
  }

  if (block.kind === 'fuerza' && run.kind === 'fuerza') {
    if (run.phase === 'serie') {
      return {
        theme: 'accent',
        kicker: `SERIE ${run.serie} / ${block.series}`,
        big: kg(run.weight),
        unit: `KG · ${block.reps} REPS`,
        title: block.name.toUpperCase(),
        sub: 'Tu serie',
        ring: null,
        paused: false,
        controls: controls({ next: 'done', prev: null, playPause: null }),
      }
    }
    const left = secondsLeft(run.restEnd, now)
    const last = run.serie >= block.series
    return {
      theme: 'dark',
      kicker: 'DESCANSO',
      big: mmss(left),
      unit: '',
      title: block.name.toUpperCase(),
      sub: last ? `Sigue: ${next ? next.name : 'fin del entreno'}` : `Sigue: serie ${run.serie + 1} · ${kg(run.weight)} kg`,
      ring: run.restTotal ? Math.min(1, left / run.restTotal) : 0,
      paused: false,
      controls: controls({ next: 'skip-rest', prev: 'rest-plus', playPause: null }),
    }
  }

  if (block.kind === 'tiempo' && run.kind === 'tiempo') {
    const paused = run.pausedLeft !== null
    const left = paused ? Math.ceil(run.pausedLeft! / 1000) : secondsLeft(run.endAt, now)
    return {
      theme: 'light',
      kicker: (block.subtitle ?? 'POR TIEMPO').toUpperCase(),
      big: mmss(left),
      unit: paused ? 'EN PAUSA' : '',
      title: block.name.toUpperCase(),
      sub: block.hint ?? (next ? `Sigue: ${next.name}` : ''),
      ring: run.total ? Math.min(1, left / run.total) : 0,
      paused,
      controls: controls({ next: 'time-finish', prev: null, playPause: 'time-toggle' }),
    }
  }

  if (block.kind === 'circuito' && run.kind === 'circuito') {
    const step = block.steps[run.step]
    const timed = run.stepEnd !== null
    const paused = run.pausedLeft !== null
    const left = paused ? Math.ceil(run.pausedLeft! / 1000) : timed ? secondsLeft(run.stepEnd!, now) : 0
    return {
      theme: 'light',
      kicker: `RONDA ${run.round} / ${block.rounds}`,
      big: timed ? mmss(left) : String(step.reps ?? 0),
      unit: timed ? (paused ? 'EN PAUSA' : '') : 'REPS',
      title: step.name.toUpperCase(),
      sub: block.name,
      ring: timed && step.seconds ? Math.min(1, left / step.seconds) : null,
      paused,
      controls: controls({ next: 'circuit-next', prev: 'circuit-prev', playPause: timed ? 'circuit-toggle' : null }),
    }
  }

  return {
    theme: 'dark',
    kicker: '',
    big: '',
    unit: '',
    title: '',
    sub: '',
    ring: null,
    paused: false,
    controls: controls({ next: null, prev: null, playPause: null }),
  }
}
