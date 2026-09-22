import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import RingProgress from '../../components/RingProgress';
import { getRecentSessions, computePercent, todayId } from '../../services/sessions';
import { Badge } from '../../components/UI';

// Junta, por nombre de ejercicio, la evolución de peso a lo largo de las
// sesiones (el mayor peso usado ese día, para no confundir con calentamiento).
function buildWeightHistory(sessions) {
  const map = {};
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach((s) => {
    s.exercises.forEach((ex) => {
      if (!ex.sets?.length) return;
      const weights = ex.sets.map((st) => Number(st.weight) || 0);
      const maxWeight = Math.max(...weights);
      if (!map[ex.name]) map[ex.name] = [];
      map[ex.name].push({ date: s.date, weight: maxWeight, reps: ex.reps, doneSets: ex.sets.length });
    });
  });
  return map;
}

function shortDate(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function ProgressScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        const list = await getRecentSessions(user.uid, 60);
        setSessions(list);
        setLoading(false);
      })();
    }, [user])
  );

  const weightHistory = useMemo(() => buildWeightHistory(sessions), [sessions]);
  const exerciseNames = Object.keys(weightHistory).sort();
  const activeExercise = selectedExercise && weightHistory[selectedExercise] ? selectedExercise : exerciseNames[0];
  const activeHistory = activeExercise ? weightHistory[activeExercise] : [];
  const maxWeightInHistory = activeHistory.length ? Math.max(...activeHistory.map((h) => h.weight), 1) : 1;

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

      {exerciseNames.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Progreso de peso por ejercicio</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {exerciseNames.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => setSelectedExercise(name)}
                  style={[styles.exChip, name === activeExercise && styles.exChipActive]}
                >
                  <Text style={[styles.exChipText, name === activeExercise && styles.exChipTextActive]}>{name}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {activeHistory.length > 0 && (
            <View style={styles.chartCard}>
              <View style={styles.chartRow}>
                {activeHistory.slice(-10).map((h, i) => (
                  <View key={i} style={styles.barCol}>
                    <Text style={styles.barValue}>{h.weight}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: `${Math.max(6, (h.weight / maxWeightInHistory) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.barDate}>{shortDate(h.date)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeadText, { flex: 1 }]}>Fecha</Text>
                <Text style={[styles.tableHeadText, { width: 60, textAlign: 'right' }]}>Peso</Text>
                <Text style={[styles.tableHeadText, { width: 80, textAlign: 'right' }]}>Series</Text>
              </View>
              {[...activeHistory].reverse().map((h, i) => {
                const prev = activeHistory[activeHistory.indexOf(h) - 1];
                const delta = prev ? h.weight - prev.weight : 0;
                return (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{h.date}</Text>
                    <Text style={[styles.tableCell, { width: 60, textAlign: 'right', fontWeight: '800' }]}>
                      {h.weight}kg
                    </Text>
                    <Text style={[styles.tableCell, { width: 80, textAlign: 'right' }]}>
                      {h.doneSets}×{h.reps}
                      {delta !== 0 && (
                        <Text style={{ color: delta > 0 ? colors.green : '#ff6b76' }}>
                          {' '}
                          {delta > 0 ? '↑' : '↓'}
                          {Math.abs(delta)}
                        </Text>
                      )}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

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
  exChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.border },
  exChipActive: { backgroundColor: colors.red, borderColor: colors.red },
  exChipText: { color: colors.gray1, fontSize: 12, fontWeight: '700' },
  exChipTextActive: { color: '#fff' },
  chartCard: { backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 16 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 150, marginBottom: 16 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { color: colors.white, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  barTrack: { width: '100%', flex: 1, justifyContent: 'flex-end' },
  barFill: { width: '100%', backgroundColor: colors.red, borderRadius: 4, minHeight: 6 },
  barDate: { color: colors.gray1, fontSize: 9, marginTop: 5 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#2a2a2a', paddingBottom: 8, marginBottom: 4 },
  tableHeadText: { color: colors.gray1, fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1c1c1c' },
  tableCell: { color: colors.white, fontSize: 12.5 },
});
