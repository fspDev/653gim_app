import { Platform, Vibration } from 'react-native';

const isWeb = Platform.OS === 'web';

const REST_TITLE = '¡Descanso terminado! 💪';
const REST_BODY = 'Arrancá la próxima serie.';
const VIBRATE_PATTERN = [300, 100, 300];

// En native (Expo Go / build) usamos expo-notifications: notificaciones
// locales reales del sistema operativo, funcionan con la app en background.
// En web (PWA) usamos la Notification API del navegador — funciona mientras
// la pestaña/PWA está abierta; para que lleguen con la app cerrada hace
// falta push real (Firebase Cloud Messaging + Cloud Functions).
let Notifications = null;
if (!isWeb) {
  Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function supportsVibration() {
  if (!isWeb) return true;
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function notificationPermissionStatus() {
  if (!isWeb) return 'unknown';
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

// Vibración directa. En web el navegador solo la permite si hubo un toque
// del usuario hace poco; por eso, para el fin del descanso, además se usa
// la notificación del Service Worker (ver notifyRestFinished).
export function vibrateNow() {
  try {
    if (isWeb) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        return navigator.vibrate(VIBRATE_PATTERN);
      }
      return false;
    }
    Vibration.vibrate([0, ...VIBRATE_PATTERN]);
    return true;
  } catch (e) {
    return false;
  }
}

export async function ensureNotificationPermission() {
  if (isWeb) {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  return newStatus === 'granted';
}

async function showWebNotification(title, body) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  const options = {
    body,
    icon: '/653gim_app/logo653.png',
    badge: '/653gim_app/logo653.png',
    tag: 'rest-end',
    renotify: true,
    vibrate: VIBRATE_PATTERN, // solo lo respeta showNotification() del Service Worker
  };
  try {
    // Pasar por el Service Worker es lo que permite que el navegador dispare
    // la vibración: navigator.vibrate() directo requiere un toque reciente,
    // y esta notificación se dispara desde un timer, no de un tap.
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg?.showNotification) {
        await reg.showNotification(title, options);
        return true;
      }
    }
    new Notification(title, options);
    return true;
  } catch (e) {
    return false;
  }
}

// Dispara la notificación + vibración YA (cuando el cronómetro llega a cero).
export async function notifyRestFinished() {
  vibrateNow(); // funciona si el navegador todavía considera "activo" al usuario
  if (isWeb) {
    return showWebNotification(REST_TITLE, REST_BODY);
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: REST_TITLE, body: REST_BODY, sound: true, vibrate: [0, ...VIBRATE_PATTERN] },
      trigger: null, // inmediata
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function testNotification() {
  const ok = await ensureNotificationPermission();
  if (!ok) return false;
  if (isWeb) return showWebNotification('Notificación de prueba 🔔', 'Si vibró, está todo listo.');
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Notificación de prueba 🔔', body: 'Si vibró, está todo listo.', sound: true, vibrate: [0, ...VIBRATE_PATTERN] },
      trigger: null,
    });
    return true;
  } catch (e) {
    return false;
  }
}

// Programa la notificación por adelantado. En web los timers se congelan si el
// sistema suspende la app, así que esto es "el mejor esfuerzo": el disparo
// garantizado ocurre en notifyRestFinished() cuando el cronómetro llega a cero.
export async function scheduleRestEndNotification(seconds) {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;

  if (isWeb) {
    const handle = { web: true, fired: false, timeoutId: null };
    handle.timeoutId = setTimeout(() => {
      handle.fired = true;
      showWebNotification(REST_TITLE, REST_BODY);
    }, Math.max(1, Math.round(seconds)) * 1000);
    return handle;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: REST_TITLE,
      body: REST_BODY,
      sound: true,
      vibrate: [0, ...VIBRATE_PATTERN],
    },
    trigger: { seconds: Math.max(1, Math.round(seconds)) },
  });
  return { web: false, fired: false, id };
}

export async function cancelNotification(handle) {
  if (!handle) return;
  if (handle.web) {
    clearTimeout(handle.timeoutId);
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(handle.id);
  } catch (e) {}
}

const DAY_INDEX = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };

export async function scheduleGymDayReminders(weeklyDays, sessionTime) {
  if (isWeb) return; // requiere push real para funcionar con la PWA cerrada
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  await Notifications.cancelAllScheduledNotificationsAsync();

  const [hour, minute] = (sessionTime || '18:30').split(':').map((n) => parseInt(n, 10));

  for (const day of weeklyDays || []) {
    const weekday = DAY_INDEX[day];
    if (!weekday) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Hoy toca gym 🏋️', body: 'Tu rutina te espera. ¡Vamos!' },
      trigger: { weekday, hour: hour || 18, minute: minute || 0, repeats: true },
    });
  }
}

export async function scheduleFeeReminder(dueDate) {
  if (isWeb || !dueDate) return; // requiere push real para funcionar con la PWA cerrada
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  const reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - 3);
  if (reminderDate <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    content: { title: 'Vencimiento de cuota', body: 'Tu cuota vence en 3 días.' },
    trigger: reminderDate,
  });
}
