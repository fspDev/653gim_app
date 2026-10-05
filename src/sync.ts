import { store } from './backend'
import { db as local, type EntrenoRow, type SerieRow } from './db'
import { COL } from './firebase'
import { prefKey } from './keys'
import { fromRemote, toRemote, type RemoteEntreno } from './syncFormat'

const logs = (sid: string) => `${COL.students}/${sid}/logs`

let pulling = false

/** Baja el historial del servidor al teléfono (nunca pisa un entreno local que todavía no subió). */
export async function pullHistory(sid: string): Promise<void> {
  if (pulling || !navigator.onLine) return
  pulling = true
  try {
    const docs = await store.list(logs(sid), { orderBy: ['empezadoAt', 'desc'], limit: 400 })
    const known = new Set(await local.entrenos.toCollection().primaryKeys())
    const entrenos: EntrenoRow[] = []
    const series: SerieRow[] = []
    for (const d of docs) {
      const data = d.data as unknown as RemoteEntreno
      if (data.v !== 2 || known.has(data.id)) continue
      const rows = fromRemote(data)
      entrenos.push(rows.entreno)
      series.push(...rows.series)
    }
    if (entrenos.length) {
      await local.transaction('rw', local.entrenos, local.series, async () => {
        await local.entrenos.bulkPut(entrenos)
        await local.series.bulkPut(series)
      })
    }
  } catch {
    /* sin señal: queda lo que hay en el teléfono */
  } finally {
    pulling = false
  }
}

let running = false

/**
 * Sube los entrenos pendientes (reintentar no duplica: el id es el mismo) y guarda el último peso
 * de cada ejercicio, para que el próximo entreno arranque desde ahí.
 */
export async function syncPending(sid: string): Promise<void> {
  if (running || !navigator.onLine) return
  running = true
  try {
    const pending = await local.entrenos.where('synced').equals(0).toArray()
    for (const e of pending.sort((a, b) => a.empezadoAt - b.empezadoAt)) {
      const series = await local.series.where('entrenoId').equals(e.id).toArray()
      const prefs: Record<string, { weight: number; updatedAt: number }> = {}
      for (const s of [...series].sort((a, b) => a.hechaAt - b.hechaAt)) prefs[prefKey(s.ejercicio)] = { weight: s.pesoKg, updatedAt: s.hechaAt }
      await store.write([
        { type: 'set', path: `${logs(sid)}/${e.id}`, data: toRemote(e, series) as unknown as Record<string, unknown> },
        ...(Object.keys(prefs).length ? [{ type: 'set' as const, path: `${COL.students}/${sid}`, data: { exercisePrefs: prefs }, merge: true }] : []),
      ])
      await local.entrenos.update(e.id, { synced: 1 })
    }
  } catch {
    /* sin señal o error del servidor: queda pendiente */
  } finally {
    running = false
  }
}
