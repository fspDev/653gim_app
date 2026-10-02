import { useSyncExternalStore } from 'react'

export interface Settings {
  /** Descanso por defecto entre series, en segundos. */
  restSeconds: number
  vibracion: boolean
  sonido: boolean
  /** Wake Lock durante el entreno. */
  pantallaEncendida: boolean
  /** Tema de la pantalla de descanso. */
  temaDescanso: 'auto' | 'claro' | 'oscuro'
  /** Cuándo aparece la ventana flotante del entreno. */
  flotante: Flotante
}

export type Flotante = 'salir' | 'serie' | 'boton' | 'nunca'

export const DEFAULT_SETTINGS: Settings = {
  restSeconds: 90,
  vibracion: true,
  sonido: true,
  pantallaEncendida: true,
  temaDescanso: 'auto',
  flotante: 'salir',
}

const KEY = '653:settings'
const listeners = new Set<() => void>()
let cache: Settings | null = null

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** Lectura síncrona para código que no es un componente (vibración, wake lock). */
export function getSettings(): Settings {
  return (cache ??= read())
}

export function updateSettings(patch: Partial<Settings>) {
  cache = { ...getSettings(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* se aplica igual en esta sesión */
  }
  listeners.forEach((l) => l())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getSettings,
  )
}
