import { collection, doc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore'
import { db as local, type EntrenoRow, type SerieRow } from './db'
import { COL, db, prefKey } from './firebase'
import { fromLegacy, fromRemote, toRemote, type LegacySession, type RemoteEntreno } from './syncFormat'

export type { RemoteEntreno } from './syncFormat'

const logs = (uid: string) => collection(db, COL.sessions, uid, 'logs')

let pulling = false

/** Baja el historial del servidor al teléfono (nunca pisa un entreno local que todavía no subió). */
export async function pullHistory(userId: string): Promise<void> {
  if (pulling || !navigator.onLine) return
  pulling = true
  try {
    const snap = await getDocs(query(logs(userId), orderBy('date', 'desc'), limit(400)))
    const known = new Set(await local.entrenos.toCollection().primaryKeys())
    const entrenos: EntrenoRow[] = []
    const series: SerieRow[] = []
    for (const d of snap.docs) {
      const data = d.data()
      const rows = data.v === 2 ? fromRemote(data as RemoteEntreno) : fromLegacy(d.id, data as LegacySession)
      if (!rows || known.has(rows.entreno.id)) continue
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
 * Sube los entrenos pendientes (los ids los generó el teléfono, así que reintentar no duplica) y guarda
 * el último peso de cada ejercicio como preferencia, igual que la app anterior.
 */
export async function syncPending(userId: string): Promise<void> {
  if (running || !navigator.onLine) return
  running = true
  try {
    const pending = await local.entrenos.where('synced').equals(0).toArray()
    for (const e of pending.sort((a, b) => a.empezadoAt - b.empezadoAt)) {
      const series = await local.series.where('entrenoId').equals(e.id).toArray()
      await setDoc(doc(logs(userId), e.id), toRemote(e, series))
      const prefs: Record<string, { weight: number; updatedAt: number }> = {}
      for (const s of [...series].sort((a, b) => a.hechaAt - b.hechaAt)) prefs[prefKey(s.ejercicio)] = { weight: s.pesoKg, updatedAt: s.hechaAt }
      if (Object.keys(prefs).length) await setDoc(doc(db, COL.users, userId), { exercisePrefs: prefs }, { merge: true })
      await local.entrenos.update(e.id, { synced: 1 })
    }
  } catch {
    /* sin señal o error del servidor: queda pendiente */
  } finally {
    running = false
  }
}
