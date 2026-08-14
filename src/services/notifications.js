import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  return newStatus === 'granted';
}

export async function scheduleRestEndNotification(seconds) {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '¡Descanso terminado! 💪',
      body: 'Arrancá la próxima serie.',
      sound: true,
    },
    trigger: { seconds: Math.max(1, Math.round(seconds)) },
  });
}

export async function cancelNotification(id) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {}
}

const DAY_INDEX = { sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7 };

export async function scheduleGymDayReminders(weeklyDays, sessionTime) {
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  await Notifications.cancelAllScheduledNotificationsAsync();

  const [hour, minute] = (sessionTime || '18:30').split(':').map((n) => parseInt(n, 10));

  for (const day of weeklyDays || []) {
    const weekday = DAY_INDEX[day];
    if (!weekday) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Hoy toca gym 🏋️',
        body: 'Tu rutina te espera. ¡Vamos!',
      },
      trigger: {
        weekday,
        hour: Math.max(0, (hour || 18) - 0),
        minute: minute ?? 0,
        repeats: true,
      },
    });
  }
}

export async function scheduleFeeReminder(dueDate) {
  const ok = await ensureNotificationPermission();
  if (!ok) return;
  const reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - 3);
  if (reminderDate <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Vencimiento de cuota',
      body: 'Tu cuota vence en 3 días.',
    },
    trigger: reminderDate,
  });
}
