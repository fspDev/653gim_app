import type { Block } from '../data'
import { fmtKg } from '../format'

/** Línea de detalle de un bloque ("4 series × 8 reps · 35 kg"). */
export function blockDetail(b: Block): string {
  switch (b.kind) {
    case 'fuerza':
      return `${b.series} series × ${b.reps} reps · ${fmtKg(b.weight)} kg`
    case 'circuito':
      return `${b.rounds} rondas · ${b.minutes} min`
    case 'tiempo':
      return `${b.minutes} min`
  }
}
