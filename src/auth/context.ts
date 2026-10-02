import { createContext, useContext } from 'react'

export interface Profile {
  id: string
  rol: 'socio' | 'profe'
  nombre: string
  apellido: string
  email: string
  profeId: string | null
  profeNombre: string | null
  profeEmail: string | null
}

/** `local` queda por compatibilidad de tipos: con Firebase siempre hay cuentas. */
export type AuthStatus = 'loading' | 'out' | 'in' | 'local'

export type LoginResult = { ok: true } | { ok: false; reason: 'datos' | 'red' | 'muchos' | 'otro' }

export interface AuthValue {
  status: AuthStatus
  userId: string | null
  profile: Profile | null
  /** Socio: nombre y apellido + DNI (las mismas cuentas de la app anterior). */
  loginSocio: (nombre: string, dni: string) => Promise<LoginResult>
  /** Profe: usuario "Admin" + contraseña. */
  loginProfe: (usuario: string, clave: string) => Promise<LoginResult>
  signOut: () => Promise<void>
  /** Sube los entrenos pendientes (no hace nada sin cuenta o sin conexión). */
  syncNow: () => void
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth fuera de <AuthProvider>')
  return v
}
