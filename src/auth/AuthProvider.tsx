import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ADMIN_EMAIL, COL, auth, db, usernameToEmail } from '../firebase'
import { clearRutinaCache } from '../rutina/rutina'
import { pullHistory, syncPending } from '../sync'
import { AuthContext, type AuthValue, type LoginResult, type Profile } from './context'

const PROFILE_KEY = '653:profile'

// Solo en desarrollo (npm run dev con ?demo): sin cuenta, con la rutina de ejemplo, para probar la interfaz.
const DEMO =
  import.meta.env.DEV &&
  (() => {
    try {
      if (new URLSearchParams(location.search).has('demo')) sessionStorage.setItem('653:demo', '1')
      return sessionStorage.getItem('653:demo') === '1'
    } catch {
      return false
    }
  })()
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

interface UserDoc {
  role?: 'client' | 'admin'
  firstName?: string
  lastName?: string
  coachName?: string
}

async function fetchProfile(user: User): Promise<Profile | null> {
  const snap = await getDoc(doc(db, COL.users, user.uid))
  if (!snap.exists()) return null
  const d = snap.data() as UserDoc
  return {
    id: user.uid,
    rol: d.role === 'admin' ? 'profe' : 'socio',
    nombre: d.firstName || (d.role === 'admin' ? 'Profe' : ''),
    apellido: d.lastName || '',
    email: user.email ?? '',
    profeId: null,
    profeNombre: d.coachName || null,
    profeEmail: null,
  }
}

function mapError(e: unknown): LoginResult {
  const code = (e as { code?: string })?.code ?? ''
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return { ok: false, reason: 'datos' }
  if (code.includes('network')) return { ok: false, reason: 'red' }
  if (code.includes('too-many-requests')) return { ok: false, reason: 'muchos' }
  return { ok: false, reason: 'otro' }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(() => readProfile())

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u)
        setReady(true)
      }),
    [],
  )

  const userId = user?.uid ?? null

  // Perfil: se guarda local para poder abrir la app y entrenar sin señal.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchProfile(user)
      .then((p) => {
        if (cancelled || !p) return
        setProfile(p)
        writeProfile(p)
      })
      .catch(() => {
        /* sin señal: queda el guardado */
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const syncNow = useCallback(() => {
    if (userId) void syncPending(userId)
  }, [userId])

  const isSocio = profile?.rol === 'socio' && profile.id === userId

  // El historial (también el de la app anterior) baja al entrar; lo nuevo sube en cola.
  useEffect(() => {
    if (!userId || !isSocio) return
    void pullHistory(userId).finally(syncNow)
    window.addEventListener('online', syncNow)
    const id = setInterval(syncNow, SYNC_EVERY_MS)
    return () => {
      window.removeEventListener('online', syncNow)
      clearInterval(id)
    }
  }, [userId, isSocio, syncNow])

  const loginSocio = useCallback(async (nombre: string, dni: string): Promise<LoginResult> => {
    try {
      await signInWithEmailAndPassword(auth, usernameToEmail(nombre), dni.trim().replace(/\./g, ''))
      return { ok: true }
    } catch (e) {
      return mapError(e)
    }
  }, [])

  const loginProfe = useCallback(async (usuario: string, clave: string): Promise<LoginResult> => {
    if (usuario.trim().toLowerCase() !== 'admin') return { ok: false, reason: 'datos' }
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, clave)
      return { ok: true }
    } catch (e) {
      return mapError(e)
    }
  }, [])

  const signOut = useCallback(async () => {
    await fbSignOut(auth)
    writeProfile(null)
    clearRutinaCache()
    setProfile(null)
  }, [])

  const value = useMemo<AuthValue>(() => {
    // Al cambiar de cuenta, el perfil guardado puede ser del usuario anterior por un instante.
    const ownProfile = profile && profile.id === userId ? profile : null
    if (DEMO) return { status: 'local', userId: null, profile: null, loginSocio, loginProfe, signOut, syncNow }
    const status = !ready ? 'loading' : user ? 'in' : 'out'
    return { status, userId, profile: status === 'in' ? ownProfile : null, loginSocio, loginProfe, signOut, syncNow }
  }, [ready, user, userId, profile, loginSocio, loginProfe, signOut, syncNow])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
