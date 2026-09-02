import { Platform } from 'react-native';

let sentinel = null;

// Mantiene la pantalla encendida mientras corre el descanso. Es la forma más
// confiable de que el aviso llegue a tiempo en la PWA: si la pantalla se apaga,
// Android congela los timers de la app y el aviso se atrasa o no llega.
export async function acquireWakeLock() {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    if (sentinel) return;
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch (e) {
    sentinel = null;
  }
}

export async function releaseWakeLock() {
  if (Platform.OS !== 'web') return;
  try {
    if (sentinel) {
      await sentinel.release();
      sentinel = null;
    }
  } catch (e) {
    sentinel = null;
  }
}

export function hasWakeLock() {
  return !!sentinel;
}
