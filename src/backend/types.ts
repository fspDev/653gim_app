/**
 * Lo que la app necesita del servidor, sin atarse a Firebase: documentos por ruta y cuentas.
 * Implementaciones: `firebase.ts` (la real) y `demo.ts` (en el navegador, solo en desarrollo con ?demo).
 */

export type Data = Record<string, unknown>

export interface ListOpts {
  /** Igualdad sobre un campo de primer nivel. */
  where?: [field: string, value: unknown]
  orderBy?: [field: string, dir: 'asc' | 'desc']
  limit?: number
}

export type WriteOp =
  | { type: 'set'; path: string; data: Data; merge?: boolean }
  | { type: 'update'; path: string; data: Data }
  | { type: 'delete'; path: string }

export interface Doc {
  id: string
  data: Data
}

export interface Store {
  get(path: string): Promise<Data | null>
  list(collection: string, opts?: ListOpts): Promise<Doc[]>
  /** Todas juntas o ninguna. */
  write(ops: WriteOp[]): Promise<void>
}

export interface AuthUser {
  uid: string
  email: string
}

export type AuthErrorCode = 'datos' | 'red' | 'muchos' | 'existe' | 'debil' | 'otro'

export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode) {
    super(code)
    this.code = code
  }
}

export interface AuthApi {
  onChange(cb: (user: AuthUser | null) => void): () => void
  signIn(email: string, password: string): Promise<AuthUser>
  signOut(): Promise<void>
  /** Crea la cuenta y entra con ella (la del profe, la primera vez). */
  signUp(email: string, password: string): Promise<AuthUser>
  /** Crea otra cuenta sin cerrar la sesión actual (el profe dando de alta a un estudiante). Devuelve su uid. */
  createAccount(email: string, password: string): Promise<string>
  /** Cambia la contraseña de la cuenta actual; pide la actual para confirmar. */
  changePassword(current: string, next: string): Promise<void>
}

export interface Backend {
  store: Store
  auth: AuthApi
  demo: boolean
}
