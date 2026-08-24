import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, typography } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import RingProgress from '../../components/RingProgress';
import { getPlanDays } from '../../services/plans';
import { getSession, saveSession, todayId, computePercent } from '../../services/sessions';
import { PrimaryButton, SecondaryButton } from '../../components/UI';
import { confirmAction } from '../../utils/platformAlert';
import { formatMMSS } from '../../utils/time';

const WEEK_LABELS = { mon: 'LUN', tue: 'MAR', wed: 'MIÉ', thu: 'JUE', fri: 'VIE', sat: 'SÁB', sun: 'DOM' };
const WEEK_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function HomeScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [days, setDays] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const planDays = await getPlanDays(user.uid);
    setDays(planDays);

    if (planDays.length === 0) {
      setSession(null);
      setLoading(false);
      return;
    }

    const existing = await getSession(user.uid, todayId());
    if (existing) {
      setSession(existing);
    } else {
      const first = planDays[0];
      if (first) {
        const fresh = buildFreshSession(first);
        setSession(fresh);
        await saveSession(user.uid, todayId(), fresh);
      }
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function buildFreshSession(day) {
    const exercises = [
      ...day.groups.core.map((e) => ({ ...e, group: 'core' })),
      ...day.groups.fuerza.map((e) => ({ ...e, group: 'fuerza' })),
    ].map((e) => ({
      exerciseId: e.id,
      name: e.name,
      group: e.group,
      targetSets: e.sets,
      reps: e.reps,
      restSeconds: e.restSeconds,
      sets: [],
    }));
    return { dayId: day.id, date: todayId(), startedAt: Date.now(), exercises };
  }

  async function selectDay(day) {
    if (session?.dayId === day.id) return;
    const fresh = buildFreshSession(day);
    setSession(fresh);
    await saveSession(user.uid, todayId(), fresh);
  }

  function openExercise(exercise) {
    navigation.navigate('ExerciseExecution', { exerciseId: exercise.exerciseId, dayId: session.dayId });
  }

  function confirmResetDay() {
    const day = days.find((d) => d.id === session.dayId);
    confirmAction(
      'Reiniciar día',
      `Se van a borrar todas las series marcadas hoy en ${day?.label || 'este día'}. ¿Continuar?`,
      resetDay
    );
  }

  async function resetDay() {
    const day = days.find((d) => d.id === session.dayId);
    if (!day) return;
    const fresh = buildFreshSession(day);
    setSession(fresh);
    await saveSession(user.uid, todayId(), fresh);
  }

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  const percent = computePercent(session);
  const doneCount = session?.exercises.filter((e) => e.sets.length >= e.targetSets).length || 0;
  const totalCount = session?.exercises.length || 0;
  const currentDay = days.find((d) => d.id === session?.dayId);
  const coreEx = session?.exercises.filter((e) => e.group === 'core') || [];
  const fuerzaEx = session?.exercises.filter((e) => e.group === 'fuerza') || [];
  const nextExercise = session?.exercises.find((e) => e.sets.length < e.targetSets);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.red} />}
    >
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Image source={require('../../../assets/logo653.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </View>
          <View>
            <Text style={styles.brandName}>SEISCINCUENTAYTRES</Text>
            <Text style={styles.brandSub}>GYM &amp; FITNESS</Text>
          </View>
        </View>
        <View style={styles.avatar}>
          <Text style={{ color: colors.white, fontWeight: '700', fontSize: 13 }}>
            {(profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '')}
          </Text>
        </View>
      </View>

      <Text style={styles.greeting}>Hola, {profile?.firstName || ''} 👋</Text>
      <Text style={styles.greetingSub}>
        Profe <Text style={styles.bold}>{profile?.coachName || '—'}</Text> · Plan{' '}
        <Text style={styles.bold}>{profile?.planType === 'weekly' ? 'Semanal' : 'Diario'}</Text>
      </Text>

      {days.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Todavía no tenés un plan cargado</Text>
          <Text style={styles.emptySub}>Hablá con tu profe para que te arme la rutina.</Text>
        </View>
      ) : (
        <>
          <View style={styles.progressCard}>
            <RingProgress percent={percent} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.progressTitle}>{currentDay?.label || 'Rutina'} en curso</Text>
              <Text style={styles.progressSub}>
                {doneCount} de {totalCount} ejercicios completados
              </Text>
            </View>
          </View>

          {doneCount > 0 && (
            <SecondaryButton
              title="↺ Reiniciar día"
              onPress={confirmResetDay}
              style={{ marginTop: 10 }}
              textStyle={{ color: colors.gray1 }}
            />
          )}

          <Text style={styles.sectionLabel}>Elegí tu día</Text>
          <View style={styles.dayPillsRow}>
            {days.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => selectDay(d)}
                style={[styles.dayPill, session?.dayId === d.id && styles.dayPillActive]}
              >
                <Text style={[styles.dayPillText, session?.dayId === d.id && styles.dayPillTextActive]}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {coreEx.length === 0 && fuerzaEx.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{currentDay?.label} sin ejercicios todavía</Text>
              <Text style={styles.emptySub}>Tu profe está armando esta rutina.</Text>
            </View>
          ) : (
            <>
              <ExerciseGroup title="Core" exercises={coreEx} onPress={openExercise} />
              <ExerciseGroup title="Fuerza" exercises={fuerzaEx} onPress={openExercise} />
            </>
          )}

          {nextExercise && (
            <PrimaryButton
              title="Continuar rutina →"
              onPress={() => openExercise(nextExercise)}
              style={{ marginTop: 12 }}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

function ExerciseGroup({ title, exercises, onPress }) {
  if (!exercises.length) return null;
  return (
    <View>
      <View style={styles.groupTitleRow}>
        <Text style={styles.groupTitle}>● {title}</Text>
        <View style={styles.groupLine} />
      </View>
      {exercises.map((ex) => {
        const done = ex.sets.length >= ex.targetSets;
        return (
          <Pressable
            key={ex.exerciseId}
            onPress={() => onPress(ex)}
            style={[styles.exCard, done && styles.exCardDone]}
          >
            <View style={[styles.exCheck, done && styles.exCheckDone]}>
              {done && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exName}>{ex.name}</Text>
              <Text style={styles.exMeta}>
                {ex.targetSets} series × {ex.reps} reps · descanso {formatMMSS(ex.restSeconds)}
                {ex.sets.length > 0 ? ` · ${ex.sets.length}/${ex.targetSets} hechas` : ''}
              </Text>
            </View>
            <View style={styles.exGo}>
              <Text style={{ color: done ? colors.green : colors.gray1, fontSize: 13 }}>
                {done ? '✓' : '▶'}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#fff', overflow: 'hidden' },
  brandName: { color: colors.white, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  brandSub: { color: colors.gray1, fontSize: 9, fontWeight: '600', letterSpacing: 1 },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.black3,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.red,
  },
  greeting: { color: colors.white, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  greetingSub: { color: colors.gray1, fontSize: 13, marginTop: 3, marginBottom: 20 },
  bold: { color: colors.white, fontWeight: '700' },
  emptyCard: {
    backgroundColor: colors.black2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 22, alignItems: 'center', marginTop: 8,
  },
  emptyTitle: { color: colors.white, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  emptySub: { color: colors.gray1, fontSize: 12.5, textAlign: 'center', marginTop: 6 },
  progressCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.black2,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18, marginBottom: 6,
  },
  progressTitle: { color: colors.white, fontSize: 16, fontWeight: '800' },
  progressSub: { color: colors.gray1, fontSize: 11.5, marginTop: 3 },
  sectionLabel: { ...typography.label, color: colors.gray1, marginTop: 22, marginBottom: 10 },
  dayPillsRow: { flexDirection: 'row', gap: 6 },
  dayPill: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.black3, alignItems: 'center' },
  dayPillActive: { backgroundColor: colors.red },
  dayPillText: { color: colors.gray1, fontSize: 12, fontWeight: '700' },
  dayPillTextActive: { color: '#fff' },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10 },
  groupTitle: { color: colors.red, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  groupLine: { flex: 1, height: 1, backgroundColor: colors.redDim },
  exCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.black2,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: 10,
  },
  exCardDone: { borderColor: 'rgba(46,204,113,0.35)', backgroundColor: 'rgba(46,204,113,0.06)' },
  exCheck: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.gray2, alignItems: 'center', justifyContent: 'center' },
  exCheckDone: { backgroundColor: colors.green, borderColor: colors.green },
  exName: { color: colors.white, fontSize: 14, fontWeight: '700' },
  exMeta: { color: colors.gray1, fontSize: 11.5, marginTop: 3 },
  exGo: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.black3, alignItems: 'center', justifyContent: 'center' },
});
