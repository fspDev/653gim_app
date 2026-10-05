import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, store } from '../backend'
import { AuthError, type AuthUser } from '../backend/types'
import { emailFor, normalizeUsername, usernameFrom } from '../cuentas'
import { db as local } from '../db'
import { COL } from '../firebase'
import { clearRutinaCache } from '../rutina/rutina'
import { pullHistory, syncPending } from '../sync'
import { clearActive } from '../workout/persist'
import { AuthContext, type AuthStatus, type AuthValue, type CrearProfeDatos, type LoginResult, type Profile } from './context'

const PROFILE_KEY = 'g653:profile'
const SYNC_EVERY_MS = 60_000

function readProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

function writeProfile(p: Profile | null) {
  try {
    if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
    else localStorage.removeItem(PROFILE_KEY)
  } catch {
    /* sin espacio: se vuelve a bajar */
  }
}

interface ProfeConfig {
  uid: string
  nombre: string
  apellido?: string
  username: string
}

export const PROFE_PATH = `${COL.config}/profe`

/** De quién es esta cuenta: el profe, un estudiante, o nadie (`null`: cuenta vieja tras un reseteo). */
async function resolveProfile(user: AuthUser): Promise<Profile | null> {
  const profe = (await store.get(PROFE_PATH)) as ProfeConfig | null
  if (profe?.uid === user.uid) {
    return { id: user.uid, rol: 'profe', sid: `yo-${user.uid}`, nombre: profe.nombre, apellido: profe.apellido ?? '', username: profe.username, profeNombre: profe.nombre }
  }
  const [mine] = await store.list(COL.students, { where: ['uid', user.uid], limit: 1 })
  if (!mine) return null
  const d = mine.data as { nombre?: string; apellido?: string; username?: string }
  return {
    id: user.uid,
    rol: 'estudiante',
    sid: mine.id,
    nombre: d.nombre ?? '',
    apellido: d.apellido ?? '',
    username: d.username ?? '',
    profeNombre: profe?.nombre ?? null,
  }
}

const fail = (e: unknown): LoginResult => ({ ok: false, reason: e instanceof AuthError ? e.code : navigator.onLine ? 'otro' : 'red' })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(() => readProfile())
  // La cuenta existe pero no tiene ficha: se sabe recién después de preguntarle al servidor.
  const [orphan, setOrphan] = useState<string | null>(null)
  const [profeConfigurado, setProfeConfigurado] = useState<boolean | null>(null)
  // Sube cuando cambian los datos de la cuenta (el profe edita su nombre o usuario).
  const [rev, setRev] = useState(0)
  const refreshProfile = useCallback(() => setRev((n) => n + 1), [])

  useEffect(
    () =>
      authApi.onChange((u) => {
        setUser(u)
        setReady(true)
      }),
    [],
  )

  // ¿Ya hay profe? Define si la pantalla de ingreso ofrece crear la cuenta del profe.
  useEffect(() => {
    if (user) return
    let cancelled = false
    store
      .get(PROFE_PATH)
      .then((d) => !cancelled && setProfeConfigurado(!!d))
      .catch(() => !cancelled && setProfeConfigurado(null))
    return () => {
      cancelled = true
    }
  }, [user])

  // Perfil: se guarda local para poder abrir la app y entrenar sin señal.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    resolveProfile(user)
      .then((p) => {
        if (cancelled) return
        if (!p) {
          setOrphan(user.uid)
          return
        }
        setOrphan(null)
        setProfile(p)
        writeProfile(p)
        if (p.rol === 'estudiante' && p.sid) void store.write([{ type: 'update', path: `${COL.students}/${p.sid}`, data: { ultimoAcceso: Date.now() } }]).catch(() => {})
      })
      .catch(() => {
        /* sin señal: queda el guardado */
      })
    return () => {
      cancelled = true
    }
  }, [user, rev])

  const userId = user?.uid ?? null
  const ownProfile = profile && profile.id === userId ? profile : null
  const sid = ownProfile?.sid ?? null

  const syncNow = useCallback(() => {
    if (sid) void syncPending(sid)
  }, [sid])

  // El historial baja al entrar (también en un teléfono nuevo); lo nuevo sube en cola.
  useEffect(() => {
    if (!sid) return
    void pullHistory(sid).finally(syncNow)
    window.addEventListener('online', syncNow)
    const id = setInterval(syncNow, SYNC_EVERY_MS)
    return () => {
      window.removeEventListener('online', syncNow)
      clearInterval(id)
    }
  }, [sid, syncNow])

  const login = useCallback(async (usuario: string, clave: string): Promise<LoginResult> => {
    const username = normalizeUsername(usuario)
    if (!username || !clave) return { ok: false, reason: 'datos' }
    try {
      // Solo usuarios registrados: si el profe cambió su usuario, el viejo deja de servir.
      const entry = (await store.get(`${COL.logins}/${username}`)) as { email?: string } | null
      if (!entry?.email) return { ok: false, reason: 'datos' }
      await authApi.signIn(entry.email, clave)
      return { ok: true }
    } catch (e) {
      return fail(e)
    }
  }, [])

  const crearProfe = useCallback(async (d: CrearProfeDatos): Promise<LoginResult> => {
    const username = usernameFrom(d.nombre, d.apellido)
    try {
      if (await store.get(PROFE_PATH)) return { ok: false, reason: 'ya-hay-profe' }
      const email = emailFor(username)
      let u: AuthUser
      try {
        u = await authApi.signUp(email, d.clave)
      } catch (e) {
        // Si un intento anterior creó la cuenta pero no llegó a guardar la ficha.
        if (e instanceof AuthError && e.code === 'existe') u = await authApi.signIn(email, d.clave)
        else throw e
      }
      // Primero la ficha del profe: recién con ella las reglas lo dejan escribir el resto.
      await store.write([{ type: 'set', path: PROFE_PATH, data: { uid: u.uid, nombre: d.nombre.trim(), apellido: d.apellido.trim(), username, createdAt: Date.now() } }])
      await store.write([{ type: 'set', path: `${COL.logins}/${username}`, data: { email, rol: 'profe' } }])
      setProfeConfigurado(true)
      const p = await resolveProfile(u)
      if (p) {
        setProfile(p)
        writeProfile(p)
      }
      return { ok: true }
    } catch (e) {
      return fail(e)
    }
  }, [])

  const cambiarClave = useCallback(async (actual: string, nueva: string): Promise<LoginResult> => {
    try {
      await authApi.changePassword(actual, nueva)
      return { ok: true }
    } catch (e) {
      return fail(e)
    }
  }, [])

  const signOut = useCallback(async () => {
    await authApi.signOut()
    writeProfile(null)
    clearRutinaCache()
    clearActive()
    // El historial local es de esta persona: en un teléfono compartido no lo ve el siguiente.
    await local.transaction('rw', local.entrenos, local.series, async () => {
      await local.entrenos.clear()
      await local.series.clear()
    })
    setProfile(null)
    setOrphan(null)
  }, [])

  const value = useMemo<AuthValue>(() => {
    let status: AuthStatus = !ready ? 'loading' : user ? 'in' : 'out'
    if (status === 'in' && orphan === userId) status = 'sin-acceso'
    else if (status === 'in' && !ownProfile) status = 'loading'
    return { status, userId, profile: status === 'in' ? ownProfile : null, profeConfigurado, login, crearProfe, cambiarClave, signOut, syncNow, refreshProfile }
  }, [ready, user, userId, orphan, ownProfile, profeConfigurado, login, crearProfe, cambiarClave, signOut, syncNow, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
