import { useAuth } from '../auth/context'
import type { Day } from '../data'
import type { Rutina } from './mapRutina'
import { useRutina } from './rutina'

export interface DaysState {
  days: Day[]
  rutina: Rutina | null
  /** Todavía no se sabe si el profe cargó el plan. */
  loading: boolean
  /** Sin plan publicado: toca la pantalla "Todavía nada". */
  sinRutina: boolean
}

/** Los días que se pueden entrenar: los del plan que armó el profe. */
export function useDays(): DaysState {
  const { profile } = useAuth()
  const { rutina, loading } = useRutina(profile?.sid ?? null)
  const days = rutina?.days ?? []
  return { days, rutina, loading, sinRutina: !loading && days.length === 0 }
}
