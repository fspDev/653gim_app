import { deleteApp, getApps, initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  limit,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  where,
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore'
import { firebaseConfig } from '../firebase'
import { AuthError, type AuthApi, type AuthUser, type Backend, type Store } from './types'

const app = getApps()[0] ?? initializeApp(firebaseConfig)
const auth = getAuth(app)
void setPersistence(auth, browserLocalPersistence)

// Caché local persistente: con mala señal Firestore lee y escribe igual y sincroniza al volver la red.
function makeDb() {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  } catch {
    return getFirestore(app)
  }
}
const db = makeDb()

const store: Store = {
  async get(path) {
    const snap = await getDoc(doc(db, path))
    return snap.exists() ? snap.data() : null
  },
  async list(col, opts = {}) {
    const c: QueryConstraint[] = []
    if (opts.where) c.push(where(opts.where[0], '==', opts.where[1]))
    if (opts.orderBy) c.push(orderBy(opts.orderBy[0], opts.orderBy[1]))
    if (opts.limit) c.push(limit(opts.limit))
    const snap = await getDocs(query(collection(db, col), ...c))
    return snap.docs.map((d) => ({ id: d.id, data: d.data() }))
  },
  async write(ops) {
    // Firestore acepta hasta 500 operaciones por lote.
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(db)
      for (const op of ops.slice(i, i + 450)) {
        const ref = doc(db, op.path)
        if (op.type === 'set') batch.set(ref, op.data, { merge: !!op.merge })
        else if (op.type === 'update') batch.update(ref, op.data)
        else batch.delete(ref)
      }
      await batch.commit()
    }
  },
}

function mapError(e: unknown): AuthError {
  const code = (e as { code?: string })?.code ?? ''
  if (/invalid-credential|wrong-password|user-not-found|invalid-email|user-mismatch/.test(code)) return new AuthError('datos')
  if (code.includes('email-already-in-use')) return new AuthError('existe')
  if (code.includes('weak-password')) return new AuthError('debil')
  if (code.includes('network')) return new AuthError('red')
  if (code.includes('too-many-requests')) return new AuthError('muchos')
  return new AuthError('otro')
}

const toUser = (u: User): AuthUser => ({ uid: u.uid, email: u.email ?? '' })

const authApi: AuthApi = {
  onChange: (cb) => onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null)),
  async signIn(email, password) {
    try {
      return toUser((await signInWithEmailAndPassword(auth, email, password)).user)
    } catch (e) {
      throw mapError(e)
    }
  },
  signOut: () => signOut(auth),
  async signUp(email, password) {
    try {
      return toUser((await createUserWithEmailAndPassword(auth, email, password)).user)
    } catch (e) {
      throw mapError(e)
    }
  },
  async createAccount(email, password) {
    // Sin servidor propio: una segunda instancia de Firebase crea la cuenta y la sesión del profe sigue intacta.
    const second = initializeApp(firebaseConfig, `alta-${Date.now()}`)
    const secondAuth = getAuth(second)
    try {
      return (await createUserWithEmailAndPassword(secondAuth, email, password)).user.uid
    } catch (e) {
      throw mapError(e)
    } finally {
      await signOut(secondAuth).catch(() => {})
      await deleteApp(second)
    }
  },
  async changePassword(current, next) {
    const u = auth.currentUser
    if (!u?.email) throw new AuthError('otro')
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current))
      await updatePassword(u, next)
    } catch (e) {
      throw mapError(e)
    }
  },
}

export const firebaseBackend: Backend = { store, auth: authApi, demo: false }
