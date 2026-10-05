import type { Backend } from './types'
import { firebaseBackend } from './firebase'

/**
 * Modo demo (solo `npm run dev` con ?demo en la dirección): servidor de mentira en el navegador,
 * con un profe y estudiantes de ejemplo. En la app publicada siempre es Firebase.
 */
export const DEMO =
  import.meta.env.DEV &&
  (() => {
    try {
      const q = new URLSearchParams(location.search)
      if (q.has('demo')) sessionStorage.setItem('g653:demo', '1')
      if (q.has('real')) sessionStorage.removeItem('g653:demo')
      return sessionStorage.getItem('g653:demo') === '1'
    } catch {
      return false
    }
  })()

let chosen: Backend = firebaseBackend
if (DEMO) chosen = (await import('./demo')).demoBackend

export const backend: Backend = chosen
export const store = backend.store
export const authApi = backend.auth
