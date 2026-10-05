import { createContext, useContext } from 'react'
import type { AuthErrorCode } from '../backend/types'

export interface Profile {
  /** uid de la cuenta con la que entró. */
  id: string
  rol: 'estudiante' | 'profe'
  /** Ficha con el plan (`g653Students/{sid}`). La del profe, para su propia rutina, es `yo-{uid}`. */
  sid: string | null
  nombre: string
  apellido: string
  username: string
  profeNombre: string | null
}

/**
 * `sin-acceso`: la cuenta existe pero ya no tiene ficha (el profe le reseteó la contraseña o lo dio de baja).
 */
export type AuthStatus = 'loading' | 'out' | 'in' | 'sin-acceso'

export type LoginResult = { ok: true } | { ok: false; reason: AuthErrorCode | 'ya-hay-profe' }

export interface CrearProfeDatos {
  nombre: string
  apellido: string
  clave: string
}

export interface AuthValue {
  status: AuthStatus
  userId: string | null
  profile: Profile | null
  /** Si ya se creó la cuenta del profe (`null` = todavía no se sabe, p. ej. sin señal). */
  profeConfigurado: boolean | null
  /** Usuario ("nombre.apellido", como lo escriba) + contraseña. Sirve para estudiantes y para el profe. */
  login: (usuario: string, clave: string) => Promise<LoginResult>
  /** Primera vez: crea la cuenta del profe. */
  crearProfe: (d: CrearProfeDatos) => Promise<LoginResult>
  cambiarClave: (actual: string, nueva: string) => Promise<LoginResult>
  signOut: () => Promise<void>
  /** Sube los entrenos pendientes (no hace nada sin cuenta o sin conexión). */
  syncNow: () => void
  /** Vuelve a leer los datos de la cuenta (después de que el profe los edita). */
  refreshProfile: () => void
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth fuera de <AuthProvider>')
  return v
}
