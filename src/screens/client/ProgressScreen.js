import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import RingProgress from '../../components/RingProgress';
import { getRecentSessions, computePercent, todayId } from '../../services/sessions';
import { Badge } from '../../components/UI';

export default function ProgressScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        const list = await getRecentSessions(user.uid, 30);
        setSessions(list);
        setLoading(false);
      })();
    }, [user])
  );

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  const today = sessions.find((s) => s.id === todayId());
  const todayPercent = computePercent(today);

  const totalSets = sessions.reduce((acc, s) => acc + s.exercises.reduce((a, e) => a + e.sets.length, 0), 0);
  const completedDays = sessions.filter((s) => computePercent(s) === 100).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
      <Text style={styles.header}>Progreso</Text>

      <View style={styles.ringCard}>
        <RingProgress percent={todayPercent} size={110} labelSize={22} />
        <Text style={styles.ringLabel}>del día completado</Text>
      </View>

      <Text style={styles.sectionLabel}>Últimos 30 días</Text>
      <View style={styles.statGrid}>
        <StatBox value={String(completedDays)} label="Días completados" />
        <StatBox value={String(totalSets)} label="Series totales" />
      </View>

      <Text style={styles.sectionLabel}>Historial reciente</Text>
      {sessions.length === 0 && <Text style={styles.empty}>Todavía no hay sesiones registradas.</Text>}
      {sessions.map((s) => {
        const pct = computePercent(s);
        const doneEx = s.exercises.filter((e) => e.sets.length >= e.targetSets).length;
        return (
          <View key={s.id} style={styles.histRow}>
            <View style={styles.histAv}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{pct === 100 ? '✓' : pct === 0 ? '✕' : '!'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.histName}>{s.date}</Text>
              <Text style={styles.histSub}>
                {doneEx}/{s.exercises.length} ejercicios · {pct}%
              </Text>
            </View>
            <Badge text={pct === 100 ? 'Completo' : pct === 0 ? 'Ausente' : 'Parcial'} tone={pct === 100 ? 'default' : 'warn'} />
          </View>
        );
      })}
    </ScrollView>
  );
}

function StatBox({ value, label }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  header: { color: colors.white, fontSize: 16, fontWeight: '800', marginBottom: 18 },
  ringCard: {
    backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    alignItems: 'center', paddingVertical: 26,
  },
  ringLabel: { color: colors.gray1, fontSize: 13, marginTop: 14 },
  sectionLabel: { color: colors.gray1, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },
  statGrid: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
  statValue: { color: colors.white, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.gray1, fontSize: 11, marginTop: 2 },
  empty: { color: colors.gray1, fontSize: 13 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1c1c1c' },
  histAv: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.black3, alignItems: 'center', justifyContent: 'center' },
  histName: { color: colors.white, fontSize: 13.5, fontWeight: '700' },
  histSub: { color: colors.gray1, fontSize: 11.5, marginTop: 2 },
});
