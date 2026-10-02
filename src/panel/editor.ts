import { uuid } from '../uuid'
import type { BloqueRow } from '../rutina/mapRutina'

export type Tipo = 'fuerza' | 'tiempo' | 'circuito'

export interface EPaso {
  nombre: string
  segundos?: number
  reps?: number
}

export interface EBloque {
  id: string
  tipo: Tipo
  ejercicioId: string | null
  nombre: string
  series: number
  reps: number
  pesoKg: number
  descansoS: number
  minutos: number
  rondas: number
  pasos: EPaso[]
  /** Bloques por tiempo: "Calentamiento", "Final" e indicación. Se conservan aunque el editor no los muestre. */
  subtitulo?: string | null
  indicacion?: string | null
}

export interface EDia {
  id: string
  letra: string
  bloques: EBloque[]
}

export interface ERutina {
  id: string
  nombre: string
  dias: EDia[]
}

export const DEFAULT_REST = 90
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function newBloque(tipo: Tipo, patch: Partial<EBloque> = {}): EBloque {
  const base: EBloque = {
    id: uuid(),
    tipo,
    ejercicioId: null,
    nombre: tipo === 'fuerza' ? 'Ejercicio' : tipo === 'tiempo' ? 'Bloque por tiempo' : 'Circuito guiado',
    series: tipo === 'fuerza' ? 3 : 0,
    reps: tipo === 'fuerza' ? 10 : 0,
    pesoKg: 0,
    descansoS: tipo === 'fuerza' ? DEFAULT_REST : 0,
    minutos: tipo === 'tiempo' ? 5 : 0,
    rondas: tipo === 'circuito' ? 3 : 0,
    pasos: tipo === 'circuito' ? [{ nombre: 'Plancha frontal', segundos: 30 }] : [],
  }
  return { ...base, ...patch }
}

export function nextLetter(dias: EDia[]): string {
  const used = new Set(dias.map((d) => d.letra))
  return [...LETTERS].find((l) => !used.has(l)) ?? `${dias.length + 1}`
}

export function addDia(r: ERutina): ERutina {
  return { ...r, dias: [...r.dias, { id: uuid(), letra: nextLetter(r.dias), bloques: [] }] }
}

export function removeDia(r: ERutina, diaId: string): ERutina {
  return r.dias.length > 1 ? { ...r, dias: r.dias.filter((d) => d.id !== diaId) } : r
}

const mapDia = (r: ERutina, diaId: string, fn: (b: EBloque[]) => EBloque[]): ERutina => ({
  ...r,
  dias: r.dias.map((d) => (d.id === diaId ? { ...d, bloques: fn(d.bloques) } : d)),
})

export const addBloque = (r: ERutina, diaId: string, b: EBloque) => mapDia(r, diaId, (list) => [...list, b])
export const removeBloque = (r: ERutina, diaId: string, bloqueId: string) => mapDia(r, diaId, (list) => list.filter((b) => b.id !== bloqueId))
export const patchBloque = (r: ERutina, diaId: string, bloqueId: string, patch: Partial<EBloque>) =>
  mapDia(r, diaId, (list) => list.map((b) => (b.id === bloqueId ? { ...b, ...patch } : b)))

export function moveBloque(r: ERutina, diaId: string, from: number, to: number): ERutina {
  return mapDia(r, diaId, (list) => {
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
    const copy = [...list]
    const [item] = copy.splice(from, 1)
    copy.splice(to, 0, item)
    return copy
  })
}

/** "1:30" → 90; "90" → 90; vacío o inválido → null. */
export function parseRest(text: string): number | null {
  const t = text.trim()
  const m = /^(\d+):([0-5]?\d)$/.exec(t)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  return /^\d+$/.test(t) ? Number(t) : null
}

/** "42,5" o "42.5" → 42.5; inválido → null. */
export function parseKg(text: string): number | null {
  const t = text.trim().replace(',', '.')
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null
}

/** Minutos del bloque en la línea de tiempo (mismo criterio que la app del socio). */
export function minutesOf(b: EBloque): number {
  if (b.tipo === 'tiempo') return b.minutos
  if (b.tipo === 'fuerza') return Math.max(1, Math.round(b.series * (b.descansoS / 60 + 0.75)))
  const perRound = b.pasos.reduce((s, p) => s + (p.segundos ?? (p.reps ?? 10) * 3), 0)
  return Math.max(1, Math.round((perRound * b.rondas) / 60))
}

export const totalMinutes = (d: EDia) => d.bloques.reduce((s, b) => s + minutesOf(b), 0)

export interface DiaWrite {
  id: string
  rutina_id: string
  letra: string
  orden: number
}

export type BloqueWrite = Omit<BloqueRow, 'orden'> & { dia_id: string; orden: number }

/** Filas para guardar: el orden sale de la posición en pantalla. */
export function toRows(r: ERutina): { dias: DiaWrite[]; bloques: BloqueWrite[] } {
  const dias = r.dias.map((d, i) => ({ id: d.id, rutina_id: r.id, letra: d.letra, orden: i + 1 }))
  const bloques = r.dias.flatMap((d) =>
    d.bloques.map((b, i): BloqueWrite => ({
      id: b.id,
      dia_id: d.id,
      orden: i + 1,
      tipo: b.tipo,
      ejercicio_id: b.ejercicioId,
      nombre: b.nombre,
      series: b.tipo === 'fuerza' ? b.series : null,
      reps: b.tipo === 'fuerza' ? b.reps : null,
      peso_kg: b.tipo === 'fuerza' ? b.pesoKg : null,
      descanso_s: b.tipo === 'fuerza' ? b.descansoS : null,
      minutos: b.tipo === 'tiempo' ? b.minutos : null,
      rondas: b.tipo === 'circuito' ? b.rondas : null,
      pasos: b.tipo === 'circuito' ? b.pasos.map((p) => (p.segundos ? { nombre: p.nombre, segundos: p.segundos } : { nombre: p.nombre, reps: p.reps ?? 10 })) : null,
      subtitulo: b.tipo === 'tiempo' ? (b.subtitulo ?? null) : null,
      indicacion: b.tipo === 'tiempo' ? (b.indicacion ?? null) : null,
    })),
  )
  return { dias, bloques }
}

/** Ids que hay que borrar del servidor: estaban guardados y ya no están en pantalla. */
export function removedIds(saved: ERutina | null, current: ERutina): { dias: string[]; bloques: string[] } {
  if (!saved) return { dias: [], bloques: [] }
  const keepDias = new Set(current.dias.map((d) => d.id))
  const keepBloques = new Set(current.dias.flatMap((d) => d.bloques.map((b) => b.id)))
  return {
    dias: saved.dias.filter((d) => !keepDias.has(d.id)).map((d) => d.id),
    // Los bloques de un día borrado se van solos por la cascada.
    bloques: saved.dias.filter((d) => keepDias.has(d.id)).flatMap((d) => d.bloques.filter((b) => !keepBloques.has(b.id)).map((b) => b.id)),
  }
}

export function fromRow(row: {
  id: string
  nombre: string
  dias: { id: string; letra: string; orden: number; bloques: BloqueRow[] }[]
}): ERutina {
  return {
    id: row.id,
    nombre: row.nombre,
    dias: [...row.dias]
      .sort((a, b) => a.orden - b.orden)
      .map((d) => ({
        id: d.id,
        letra: d.letra,
        bloques: [...d.bloques]
          .sort((a, b) => a.orden - b.orden)
          .map((b) => ({
            id: b.id,
            tipo: b.tipo,
            ejercicioId: b.ejercicio_id,
            nombre: b.nombre,
            series: b.series ?? 0,
            reps: b.reps ?? 0,
            pesoKg: b.peso_kg ?? 0,
            descansoS: b.descanso_s ?? (b.tipo === 'fuerza' ? DEFAULT_REST : 0),
            minutos: b.minutos ?? 0,
            rondas: b.rondas ?? 0,
            pasos: (b.pasos ?? []).map((p) => (p.segundos ? { nombre: p.nombre, segundos: p.segundos } : { nombre: p.nombre, reps: p.reps ?? 10 })),
            subtitulo: b.subtitulo ?? null,
            indicacion: b.indicacion ?? null,
          })),
      })),
  }
}
