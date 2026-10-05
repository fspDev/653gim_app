import type { Workout } from './types'

const KEY = 'g653:workout'
/** Un entreno "en curso" más viejo que esto es un olvido, no una pausa. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000

/** El estado del entreno se guarda en cada cambio: si se recarga o se cierra la app, vuelve donde estaba. */
export function saveActive(w: Workout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(w))
  } catch {
    /* sin espacio o modo privado: el entreno sigue en memoria */
  }
}

export function loadActive(now = Date.now()): Workout | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const w = JSON.parse(raw) as Workout
    if (!w?.day?.blocks || now - w.startedAt > MAX_AGE_MS) {
      clearActive()
      return null
    }
    return w
  } catch {
    return null
  }
}

export function clearActive() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nada que limpiar */
  }
}
