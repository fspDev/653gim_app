import { initializeApp, getApps } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

/** El mismo proyecto que la app anterior: mismas cuentas, rutinas e historial. */
export const firebaseConfig = {
  apiKey: 'AIzaSyAeBQNCxL8tzeRfAfyjTOOqcivt5lFEgjk',
  authDomain: 'somaapp-7166a.firebaseapp.com',
  projectId: 'somaapp-7166a',
  storageBucket: 'somaapp-7166a.firebasestorage.app',
  messagingSenderId: '804374144817',
  appId: '1:804374144817:web:73c38e8af161da4a503210',
}

export const app = getApps()[0] ?? initializeApp(firebaseConfig)
export const auth = getAuth(app)
void setPersistence(auth, browserLocalPersistence)

// Caché local persistente: en el gimnasio la señal es mala; Firestore lee y
// escribe igual y sincroniza al volver la red.
function makeDb() {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  } catch {
    return getFirestore(app)
  }
}
export const db = makeDb()

// Colecciones con prefijo "gym": el proyecto de Firebase es compartido con otra app.
export const COL = {
  users: 'gymUsers',
  plans: 'gymPlans',
  sessions: 'gymSessions',
  library: 'gymExerciseLibrary',
} as const

export { ADMIN_EMAIL, localDateKey, prefKey, slugify, usernameToEmail } from './keys'
