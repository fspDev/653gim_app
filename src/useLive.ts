import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'

/** Resultado de una consulta a IndexedDB que se actualiza sola cuando cambian los datos. `query` tiene que ser estable (módulo). */
export function useLive<T>(query: () => Promise<T>, initial: T): T {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: () => {} })
    return () => sub.unsubscribe()
  }, [query])
  return value
}
