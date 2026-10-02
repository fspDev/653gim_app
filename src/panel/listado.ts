import { streakWeeks, weekStart } from '../stats'

const DAY_MS = 24 * 60 * 60 * 1000
export const INACTIVE_DAYS = 10

export interface SocioProfile {
  id: string
  nombre: string
  email: string
}

export interface SocioRutina {
  socio_id: string
  nombre: string
  dias_por_semana: number | null
  publicada_at: string | null
  creado_at: string
}

export interface SocioEntreno {
  socio_id: string
  empezado_at: string
}

export interface SocioRow {
  id: string
  nombre: string
  email: string
  /** "Fuerza general · 3 días"; null = sin rutina. */
  plan: string | null
  lastAt: number | null
  lastLabel: string
  /** Semanas de racha; 0 = sin racha. */
  streak: number
  trainedThisWeek: boolean
  /** Entrenó alguna vez pero hace más de 10 días. */
  inactive: boolean
  sinRutina: boolean
}

export type SocioFilter = 'todos' | 'semana' | 'sin-rutina' | 'inactivos'

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

export function planLabel(r: SocioRutina | undefined): string | null {
  if (!r) return null
  const dias = r.dias_por_semana ? ` · ${r.dias_por_semana} días` : ''
  return `${r.nombre}${dias}${r.publicada_at ? '' : ' · borrador'}`
}

export function buildRows(profiles: SocioProfile[], rutinas: SocioRutina[], entrenos: SocioEntreno[], now: number): SocioRow[] {
  const rutinaOf = new Map<string, SocioRutina>()
  for (const r of [...rutinas].sort((a, b) => a.creado_at.localeCompare(b.creado_at))) rutinaOf.set(r.socio_id, r)

  const stampsOf = new Map<string, number[]>()
  for (const e of entrenos) {
    const list = stampsOf.get(e.socio_id) ?? []
    list.push(new Date(e.empezado_at).getTime())
    stampsOf.set(e.socio_id, list)
  }

  const thisWeek = weekStart(now)
  return profiles.map((p) => {
    const stamps = stampsOf.get(p.id) ?? []
    const lastAt = stamps.length ? Math.max(...stamps) : null
    const rutina = rutinaOf.get(p.id)
    return {
      id: p.id,
      nombre: p.nombre || p.email,
      email: p.email,
      plan: planLabel(rutina),
      lastAt,
      lastLabel: lastLabel(lastAt, now),
      streak: streakWeeks(stamps, now),
      trainedThisWeek: lastAt !== null && lastAt >= thisWeek,
      inactive: lastAt !== null && now - lastAt > INACTIVE_DAYS * DAY_MS,
      sinRutina: !rutina,
    }
  })
}

export function matches(row: SocioRow, filter: SocioFilter, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q && !row.nombre.toLowerCase().includes(q) && !row.email.toLowerCase().includes(q)) return false
  switch (filter) {
    case 'todos':
      return true
    case 'semana':
      return row.trainedThisWeek
    case 'sin-rutina':
      return row.sinRutina
    case 'inactivos':
      return row.inactive
  }
}

export const countBy = (rows: SocioRow[], filter: SocioFilter) => rows.filter((r) => matches(r, filter, '')).length

export type RowAction = 'armar' | 'escribir' | 'ver'
export const actionOf = (r: SocioRow): RowAction => (r.sinRutina ? 'armar' : r.inactive ? 'escribir' : 'ver')
