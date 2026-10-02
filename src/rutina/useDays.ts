import { useAuth } from '../auth/context'
import type { Day } from '../data'
import { DAYS } from '../data'
import { useRutina } from './rutina'
import type { Rutina } from './mapRutina'

export interface DaysState {
  days: Day[]
  rutina: Rutina | null
  /** Con cuenta, todavía no se sabe si el profe cargó la rutina. */
  loading: boolean
  /** Con cuenta y sin rutina publicada: toca la pantalla "Todavía nada". */
  sinRutina: boolean
}

/** Los días que se pueden entrenar: la rutina del profe, o el Día B de ejemplo cuando la app corre en modo local. */
export function useDays(): DaysState {
  const { status, userId } = useAuth()
  const { rutina, loading } = useRutina(status === 'in' ? userId : null)

  if (status === 'local') return { days: DAYS, rutina: null, loading: false, sinRutina: false }
  const days = rutina?.days ?? []
  return { days, rutina, loading, sinRutina: status === 'in' && !loading && days.length === 0 }
}
