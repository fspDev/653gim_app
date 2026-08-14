import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/users';
import { scheduleGymDayReminders } from '../../services/notifications';
import { SecondaryButton } from '../../components/UI';

const WEEK_DAYS = [
  { key: 'mon', label: 'LUN' },
  { key: 'tue', label: 'MAR' },
  { key: 'wed', label: 'MIÉ' },
  { key: 'thu', label: 'JUE' },
  { key: 'fri', label: 'VIE' },
  { key: 'sat', label: 'SÁB' },
];

export default function SettingsScreen() {
  const { user, profile, logout } = useAuth();
  const [weeklyDays, setWeeklyDays] = useState(profile?.weeklyDays || []);
  const [notifPrefs, setNotifPrefs] = useState(
    profile?.notifPrefs || { restEnd: true, gymReminder: true, feeReminder: false }
  );

  async function toggleDay(key) {
    const next = weeklyDays.includes(key) ? weeklyDays.filter((d) => d !== key) : [...weeklyDays, key];
    setWeeklyDays(next);
    await updateUserProfile(user.uid, { weeklyDays: next });
    if (notifPrefs.gymReminder) {
      await scheduleGymDayReminders(next, profile?.sessionTime);
    }
  }

  async function toggleNotif(key) {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    await updateUserProfile(user.uid, { notifPrefs: next });
    if (key === 'gymReminder') {
      if (next.gymReminder) {
        await scheduleGymDayReminders(weeklyDays, profile?.sessionTime);
      }
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
      <Text style={styles.header}>Ajustes</Text>

      <Text style={styles.sectionLabel}>Mi plan semanal</Text>
      <View style={styles.dayGrid}>
        {WEEK_DAYS.map((d) => {
          const active = weeklyDays.includes(d.key);
          return (
            <Pressable key={d.key} onPress={() => toggleDay(d.key)} style={[styles.dayPill, active && styles.dayPillActive]}>
              <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{d.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>Hora habitual: {profile?.sessionTime || '18:30'}</Text>

      <Text style={styles.sectionLabel}>Notificaciones</Text>
      <NotifRow
        title="Fin de descanso entre series"
        sub="Sonido + vibración"
        value={notifPrefs.restEnd}
        onToggle={() => toggleNotif('restEnd')}
      />
      <NotifRow
        title="Recordatorio de día de gym"
        sub="Según tu plan semanal y horario"
        value={notifPrefs.gymReminder}
        onToggle={() => toggleNotif('gymReminder')}
      />
      <NotifRow
        title="Vencimiento de cuota"
        sub="3 días antes del vencimiento"
        value={notifPrefs.feeReminder}
        onToggle={() => toggleNotif('feeReminder')}
      />

      <Text style={styles.sectionLabel}>Mi perfil</Text>
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {(profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '')}
          </Text>
        </View>
        <View>
          <Text style={styles.profileName}>{profile?.firstName} {profile?.lastName}</Text>
          <Text style={styles.profileSub}>Profe: {profile?.coachName || '—'}</Text>
        </View>
      </View>

      <SecondaryButton title="Cerrar sesión" onPress={logout} style={{ marginTop: 22 }} textStyle={{ color: '#ff6b76' }} />
    </ScrollView>
  );
}

function NotifRow({ title, sub, value, onToggle }) {
  return (
    <View style={styles.notifRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.notifTitle}>{title}</Text>
        <Text style={styles.notifSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.black3, true: colors.green }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  header: { color: colors.white, fontSize: 16, fontWeight: '800', marginBottom: 18 },
  sectionLabel: { color: colors.gray1, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },
  dayGrid: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayPill: { flexGrow: 1, minWidth: 50, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.black3, alignItems: 'center' },
  dayPillActive: { backgroundColor: colors.red },
  dayPillText: { color: colors.gray1, fontSize: 11.5, fontWeight: '700' },
  dayPillTextActive: { color: '#fff' },
  hint: { color: colors.gray1, fontSize: 12, marginTop: 10 },
  notifRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.black2,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  notifTitle: { color: colors.white, fontSize: 13, fontWeight: '700' },
  notifSub: { color: colors.gray1, fontSize: 11, marginTop: 2 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.black3, alignItems: 'center', justifyContent: 'center' },
  profileName: { color: colors.white, fontSize: 13.5, fontWeight: '700' },
  profileSub: { color: colors.gray1, fontSize: 11.5, marginTop: 2 },
});
