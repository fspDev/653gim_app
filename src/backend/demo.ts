import { AuthError, type AuthApi, type AuthUser, type Backend, type Data, type Store } from './types'
import { demoSeed } from './demoSeed'

/**
 * Servidor de mentira para probar la app en el navegador (solo en desarrollo, con ?demo).
 * Todo vive en localStorage del navegador; nunca toca Firebase.
 */

interface DemoState {
  docs: Record<string, Data>
  users: Record<string, { uid: string; password: string }>
}

const KEY = 'g653:demo-db'
const SESSION = 'g653:demo-user'

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DemoState
  } catch {
    /* se vuelve a sembrar */
  }
  const seeded = demoSeed()
  save(seeded)
  return seeded
}

function save(s: DemoState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* queda en memoria */
  }
}

let state: DemoState | null = null
const st = () => (state ??= load())
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const wait = () => new Promise((r) => setTimeout(r, 120))

const parentOf = (path: string) => path.split('/').slice(0, -1).join('/')

function deepMerge(a: Data, b: Data): Data {
  const out: Data = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k]
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && prev && typeof prev === 'object' && !Array.isArray(prev) ? deepMerge(prev as Data, v as Data) : v
  }
  return out
}

/** `update` de Firestore: las claves con punto ("cuota.monto") tocan un campo anidado. */
function applyUpdate(a: Data, patch: Data): Data {
  const out = clone(a)
  for (const [k, v] of Object.entries(patch)) {
    const parts = k.split('.')
    let cur = out
    for (const p of parts.slice(0, -1)) cur = (cur[p] ??= {}) as Data
    cur[parts[parts.length - 1]] = v
  }
  return out
}

const store: Store = {
  async get(path) {
    await wait()
    const d = st().docs[path]
    return d ? clone(d) : null
  },
  async list(col, opts = {}) {
    await wait()
    let docs = Object.entries(st().docs)
      .filter(([p]) => parentOf(p) === col)
      .map(([p, data]) => ({ id: p.split('/').pop()!, data: clone(data) }))
    if (opts.where) docs = docs.filter((d) => d.data[opts.where![0]] === opts.where![1])
    if (opts.orderBy) {
      const [f, dir] = opts.orderBy
      docs.sort((x, y) => {
        const a = x.data[f] as number | string
        const b = y.data[f] as number | string
        return (a < b ? -1 : a > b ? 1 : 0) * (dir === 'asc' ? 1 : -1)
      })
    }
    return opts.limit ? docs.slice(0, opts.limit) : docs
  },
  async write(ops) {
    await wait()
    const s = st()
    for (const op of ops) {
      if (op.type === 'delete') delete s.docs[op.path]
      else if (op.type === 'set') s.docs[op.path] = op.merge && s.docs[op.path] ? deepMerge(s.docs[op.path], clone(op.data)) : clone(op.data)
      else {
        if (!s.docs[op.path]) throw new Error(`No existe ${op.path}`)
        s.docs[op.path] = applyUpdate(s.docs[op.path], op.data)
      }
    }
    save(s)
  },
}

const listeners = new Set<(u: AuthUser | null) => void>()

function current(): AuthUser | null {
  try {
    const email = sessionStorage.getItem(SESSION)
    const u = email ? st().users[email] : null
    return u && email ? { uid: u.uid, email } : null
  } catch {
    return null
  }
}

function setCurrent(email: string | null) {
  try {
    if (email) sessionStorage.setItem(SESSION, email)
    else sessionStorage.removeItem(SESSION)
  } catch {
    /* nada */
  }
  const u = current()
  listeners.forEach((l) => l(u))
}

const newUid = () => `demo-${Math.random().toString(36).slice(2, 10)}`

function create(email: string, password: string): string {
  const s = st()
  if (s.users[email]) throw new AuthError('existe')
  if (password.length < 6) throw new AuthError('debil')
  const uid = newUid()
  s.users[email] = { uid, password }
  save(s)
  return uid
}

const auth: AuthApi = {
  onChange(cb) {
    listeners.add(cb)
    setTimeout(() => cb(current()), 0)
    return () => listeners.delete(cb)
  },
  async signIn(email, password) {
    await wait()
    const u = st().users[email]
    if (!u || u.password !== password) throw new AuthError('datos')
    setCurrent(email)
    return { uid: u.uid, email }
  },
  async signOut() {
    setCurrent(null)
  },
  async signUp(email, password) {
    await wait()
    const uid = create(email, password)
    setCurrent(email)
    return { uid, email }
  },
  async createAccount(email, password) {
    await wait()
    return create(email, password)
  },
  async changePassword(cur, next) {
    await wait()
    const me = current()
    const u = me ? st().users[me.email] : null
    if (!me || !u || u.password !== cur) throw new AuthError('datos')
    if (next.length < 6) throw new AuthError('debil')
    u.password = next
    save(st())
  },
}

export const demoBackend: Backend = { store, auth, demo: true }

/** Vuelve a los datos de ejemplo. */
export function resetDemo() {
  const fresh = demoSeed()
  state = fresh
  save(fresh)
  setCurrent(null)
}
