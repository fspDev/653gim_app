import type { SerieRow } from './db'
import { bestOf } from './workout/records'

const DAY_MS = 24 * 60 * 60 * 1000

/** Lunes 00:00 (hora local) de la semana de `ts`. */
export function weekStart(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const sinceMonday = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - sinceMonday)
  return d.getTime()
}

/**
 * Semanas seguidas con `min` o más entrenos. La semana en curso suma si ya llegó a `min`,
 * pero si todavía no llegó no corta la racha (puede entrenar el resto de la semana).
 */
export function streakWeeks(timestamps: number[], now: number, min = 3): number {
  const perWeek = new Map<number, number>()
  for (const t of timestamps) perWeek.set(weekStart(t), (perWeek.get(weekStart(t)) ?? 0) + 1)

  const current = weekStart(now)
  let streak = (perWeek.get(current) ?? 0) >= min ? 1 : 0
  for (let w = new Date(current).setDate(new Date(current).getDate() - 7); ; w = new Date(w).setDate(new Date(w).getDate() - 7)) {
    if ((perWeek.get(w) ?? 0) < min) break
    streak++
  }
  return streak
}

export interface MonthView {
  /** Casilleros vacíos antes del día 1 (semana que arranca el lunes). */
  blanks: number
  daysInMonth: number
  /** Días del mes (1–31) con al menos un entreno. */
  trained: Set<number>
  /** Cantidad de entrenos del mes. */
  count: number
}

export function monthView(timestamps: number[], year: number, month: number): MonthView {
  const blanks = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const trained = new Set<number>()
  let count = 0
  for (const t of timestamps) {
    const d = new Date(t)
    if (d.getFullYear() === year && d.getMonth() === month) {
      trained.add(d.getDate())
      count++
    }
  }
  return { blanks, daysInMonth, trained, count }
}

export interface ExercisePoint {
  at: number
  weight: number
}

/** Mejor peso de cada entreno, en orden cronológico, para el gráfico de evolución. */
export function exerciseSeries(rows: SerieRow[], exerciseId: string): ExercisePoint[] {
  const byEntreno = new Map<string, { at: number; weight: number }>()
  for (const r of rows) {
    if (r.exerciseId !== exerciseId || r.reps <= 0) continue
    const cur = byEntreno.get(r.entrenoId)
    byEntreno.set(r.entrenoId, { at: Math.min(cur?.at ?? r.hechaAt, r.hechaAt), weight: Math.max(cur?.weight ?? 0, r.pesoKg) })
  }
  return [...byEntreno.values()].sort((a, b) => a.at - b.at)
}

export interface PersonalRecord {
  exerciseId: string
  name: string
  weight: number
  reps: number
  at: number
}

/** Mejor serie histórica de cada ejercicio. */
export function personalRecords(rows: SerieRow[]): PersonalRecord[] {
  const out: PersonalRecord[] = []
  for (const exerciseId of new Set(rows.map((r) => r.exerciseId))) {
    const mine = rows.filter((r) => r.exerciseId === exerciseId && r.reps > 0)
    const best = bestOf(mine.map((r) => ({ weight: r.pesoKg, reps: r.reps, at: r.hechaAt, name: r.ejercicio })))
    if (best) out.push({ exerciseId, name: best.name, weight: best.weight, reps: best.reps, at: best.at })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Un récord es "reciente" si se logró en los últimos 7 días. */
export const isRecent = (at: number, now: number) => now - at <= 7 * DAY_MS

/** Puntos de la línea del gráfico dentro de un área de 342×104 (las medidas de Progreso.dc.html). */
export function chartPoints(points: ExercisePoint[]): { x: number; y: number }[] {
  if (points.length === 0) return []
  const weights = points.map((p) => p.weight)
  const lo = Math.min(...weights)
  const hi = Math.max(...weights)
  const span = hi - lo
  return points.map((p, i) => ({
    x: points.length === 1 ? 171 : 12 + i * (318 / (points.length - 1)),
    // Sin variación, la línea va derecha al medio del área.
    y: span === 0 ? 59 : 90 - ((p.weight - lo) / span) * 62,
  }))
}
