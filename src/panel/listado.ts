import type { EstadoCuota } from '../cuotas'
import { streakWeeks, weekStart } from '../stats'

const DAY_MS = 24 * 60 * 60 * 1000
export const INACTIVE_DAYS = 10

const startOfDay = (ts: number) => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** "Hoy, 19:24" · "Ayer" · "Lunes" (últimos 6 días) · "Hace 14 días" · "Nunca". */
export function lastLabel(ts: number | null, now: number): string {
  if (ts === null) return 'Nunca'
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS)
  if (days <= 0) return `Hoy, ${new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  if (days === 1) return 'Ayer'
  if (days < 7) {
    const w = new Date(ts).toLocaleDateString('es-AR', { weekday: 'long' })
    return w.charAt(0).toUpperCase() + w.slice(1)
  }
  return `Hace ${days} días`
}

export interface Fila {
  id: string
  nombre: string
  username: string
  plan: string | null
  lastAt: number | null
  lastLabel: string
  streak: number
  semana: number
  /** Entrenó alguna vez pero hace más de 10 días. */
  inactivo: boolean
  cuota: EstadoCuota
}

export type Filtro = 'todos' | 'semana' | 'sin-plan' | 'cuota' | 'inactivos'

export function buildFila(
  e: { id: string; nombre: string; apellido: string; username: string; rutina: { nombre?: string } | null },
  diasPlan: number | null,
  entrenos: number[],
  cuota: EstadoCuota,
  now: number,
): Fila {
  const lastAt = entrenos.length ? Math.max(...entrenos) : null
  const thisWeek = weekStart(now)
  return {
    id: e.id,
    nombre: `${e.nombre} ${e.apellido}`.trim(),
    username: e.username,
    plan: e.rutina ? `${e.rutina.nombre || 'Plan'}${diasPlan ? ` · ${diasPlan} días` : ''}` : null,
    lastAt,
    lastLabel: lastLabel(lastAt, now),
    streak: streakWeeks(entrenos, now),
    semana: entrenos.filter((t) => t >= thisWeek).length,
    inactivo: lastAt !== null && now - lastAt > INACTIVE_DAYS * DAY_MS,
    cuota,
  }
}

export function matches(f: Fila, filtro: Filtro, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q && !f.nombre.toLowerCase().includes(q) && !f.username.includes(q)) return false
  switch (filtro) {
    case 'todos':
      return true
    case 'semana':
      return f.semana > 0
    case 'sin-plan':
      return f.plan === null
    case 'cuota':
      return f.cuota.tipo === 'vencida'
    case 'inactivos':
      return f.inactivo
  }
}

export const countBy = (rows: Fila[], filtro: Filtro) => rows.filter((r) => matches(r, filtro, '')).length

export const cuotaTone = (e: EstadoCuota) => (e.tipo === 'vencida' ? 'alerta' : e.tipo === 'por-vencer' ? 'aviso' : e.tipo === 'al-dia' ? 'ok' : undefined)
