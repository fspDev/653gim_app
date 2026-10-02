import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import styles from './UpdateBanner.module.css'

const CHECK_EVERY_MS = 60 * 60 * 1000

/** Aviso de versión nueva. Nunca aparece en medio de un entreno; actualizar no pierde nada (el entreno se guarda en cada cambio). */
export function UpdateBanner() {
  const { pathname } = useLocation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), CHECK_EVERY_MS)
    },
  })

  if (!needRefresh || pathname.startsWith('/entreno')) return null

  return (
    <div className={styles.banner} role="status">
      <span>Hay una versión nueva de la app.</span>
      <button className={styles.update} onClick={() => void updateServiceWorker(true)}>
        Actualizar
      </button>
      <button className={styles.later} onClick={() => setNeedRefresh(false)} aria-label="Ahora no">
        Después
      </button>
    </div>
  )
}
