import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { getRecentSessions, computePercent } from '../../services/sessions';
import { Badge } from '../../components/UI';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function CalendarScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        const list = await getRecentSessions(user.uid, 90);
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

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  let startOffset = first.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDate = {};
  sessions.forEach((s) => {
    byDate[s.date] = s;
  });

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function dateKey(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const selectedSession = selected ? byDate[selected] : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
      <Text style={styles.header}>Calendario</Text>

      <View style={styles.calHeader}>
        <Pressable style={styles.navBtn} onPress={() => setCursor(new Date(year, month - 1, 1))}>
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
        <Pressable style={styles.navBtn} onPress={() => setCursor(new Date(year, month + 1, 1))}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_LETTERS.map((l, i) => (
          <Text key={i} style={styles.weekLetter}>{l}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cellEmpty} />;
          const key = dateKey(d);
          const rec = byDate[key];
          const pct = rec ? computePercent(rec) : null;
          const dotColor = pct === null ? null : pct === 100 ? colors.green : pct === 0 ? colors.gray2 : colors.amber;
          const isSelected = selected === key;
          return (
            <Pressable key={i} style={[styles.cell, isSelected && styles.cellSelected]} onPress={() => setSelected(key)}>
              <Text style={styles.cellNum}>{d}</Text>
              {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <LegendItem color={colors.green} label="Completado" />
        <LegendItem color={colors.amber} label="Parcial" />
        <LegendItem color={colors.gray2} label="Sin actividad" />
      </View>

      <Text style={styles.sectionLabel}>Detalle del día</Text>
      {selectedSession ? (
        <View style={styles.detailRow}>
          <Text style={styles.detailTitle}>{selected}</Text>
          <Text style={styles.detailSub}>
            {selectedSession.exercises.filter((e) => e.sets.length >= e.targetSets).length}/
            {selectedSession.exercises.length} ejercicios · {computePercent(selectedSession)}%
          </Text>
          <Badge text={computePercent(selectedSession) === 100 ? 'Completo' : 'Parcial'} tone={computePercent(selectedSession) === 100 ? 'default' : 'warn'} />
        </View>
      ) : (
        <Text style={styles.empty}>{selected ? 'Sin actividad registrada.' : 'Tocá un día para ver el detalle.'}</Text>
      )}
    </ScrollView>
  );
}

function LegendItem({ color, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: colors.gray1, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  header: { color: colors.white, fontSize: 16, fontWeight: '800', marginBottom: 18 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthLabel: { color: colors.white, fontSize: 15, fontWeight: '800', textTransform: 'capitalize' },
  navBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.black3, alignItems: 'center', justifyContent: 'center' },
  navBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekLetter: { flex: 1, textAlign: 'center', color: colors.gray1, fontSize: 10.5, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    padding: 2,
  },
  cellEmpty: { width: `${100 / 7}%`, aspectRatio: 1 },
  cellSelected: { backgroundColor: colors.redDim, borderRadius: 10 },
  cellNum: { color: colors.white, fontSize: 12, fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  legend: { flexDirection: 'row', gap: 14, marginTop: 14, flexWrap: 'wrap' },
  sectionLabel: { color: colors.gray1, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 },
  detailRow: { backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
  detailTitle: { color: colors.white, fontSize: 14, fontWeight: '700' },
  detailSub: { color: colors.gray1, fontSize: 12, marginTop: 3, marginBottom: 8 },
  empty: { color: colors.gray1, fontSize: 13 },
});
