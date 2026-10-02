import { getSettings } from './settings'

/**
 * Avisos con la app en segundo plano. `navigator.vibrate` no hace nada si la página está oculta;
 * una notificación del service worker sí puede vibrar, así que el aviso va por ahí.
 */

const VIBRATE = [700, 250, 700, 250, 700, 250, 1200]

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

/** Pide permiso (tiene que llamarse desde un toque). */
export async function askNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export async function showAlert(title: string, body: string, tag = '653-aviso'): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, {
      body,
      tag,
      icon: `${import.meta.env.BASE_URL}pwa-192x192.png`,
      badge: `${import.meta.env.BASE_URL}pwa-192x192.png`,
      // @ts-expect-error: `vibrate` y `renotify` existen en Chrome aunque no estén en los tipos de TS.
      vibrate: getSettings().vibracion ? VIBRATE : undefined,
      renotify: true,
      requireInteraction: false,
    })
    return true
  } catch {
    return false
  }
}
