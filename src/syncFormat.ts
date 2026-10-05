import type { EntrenoRow, SerieRow } from './db'
import { localDateKey } from './keys'

/** Entreno guardado en `g653Students/{sid}/logs/{id}` (el id lo genera el teléfono). */
export interface RemoteEntreno extends Omit<EntrenoRow, 'synced'> {
  v: 2
  /** Fecha local AAAA-MM-DD, para agrupar en el panel. */
  date: string
  series: Omit<SerieRow, 'entrenoId'>[]
}

export function toRemote(e: EntrenoRow, series: SerieRow[]): RemoteEntreno {
  const { synced: _synced, ...rest } = e
  void _synced
  return {
    ...rest,
    v: 2,
    date: localDateKey(e.empezadoAt),
    series: series.map(({ entrenoId: _id, ...s }) => {
      void _id
      return s
    }),
  }
}

export function fromRemote(r: RemoteEntreno): { entreno: EntrenoRow; series: SerieRow[] } {
  const { v: _v, date: _d, series, ...rest } = r
  void _v
  void _d
  return { entreno: { ...rest, synced: 1 }, series: (series ?? []).map((s) => ({ ...s, entrenoId: r.id })) }
}
