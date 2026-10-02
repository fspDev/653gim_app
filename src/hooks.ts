import { useEffect, useState } from 'react'

export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

interface WakeLockSentinelLike {
  release(): Promise<void>
}

/** Mantiene la pantalla encendida mientras `active`. Se vuelve a pedir al volver a la pestaña (el sistema la suelta al ocultarla). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    const wl = (navigator as unknown as { wakeLock: { request(t: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock
    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const s = await wl.request('screen')
        if (cancelled) void s.release()
        else sentinel = s
      } catch {
        /* sin permiso o batería baja: el entreno sigue igual */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [active])
}
