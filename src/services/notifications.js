import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

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

function showWebNotification(title, body) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/653gim_app/logo653.png' });
  } catch (e) {}
}

export async function scheduleRestEndNotification(seconds) {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  const delayMs = Math.max(1, Math.round(seconds)) * 1000;

  if (isWeb) {
    const timeoutId = setTimeout(() => {
      showWebNotification('¡Descanso terminado! 💪', 'Arrancá la próxima serie.');
    }, delayMs);
    return { web: true, timeoutId };
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: { title: '¡Descanso terminado! 💪', body: 'Arrancá la próxima serie.', sound: true },
    trigger: { seconds: Math.max(1, Math.round(seconds)) },
  });
  return { web: false, id };
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
