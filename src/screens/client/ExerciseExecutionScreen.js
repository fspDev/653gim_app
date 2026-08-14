import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { getSession, saveSession, todayId } from '../../services/sessions';
import { scheduleRestEndNotification, cancelNotification } from '../../services/notifications';

export default function ExerciseExecutionScreen({ route, navigation }) {
  const { exerciseId } = route.params;
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [exercise, setExercise] = useState(null);
  const [weight, setWeight] = useState(20);
  const [loading, setLoading] = useState(true);

  const [resting, setResting] = useState(false);
  const [restLeft, setRestLeft] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const notifIdRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    (async () => {
      const s = await getSession(user.uid, todayId());
      setSession(s);
      const ex = s?.exercises.find((e) => e.exerciseId === exerciseId);
      setExercise(ex);
      setLoading(false);
    })();
    return () => clearInterval(intervalRef.current);
  }, [exerciseId]);

  if (loading || !exercise) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  const doneSets = exercise.sets.length;
  const currentSerie = Math.min(doneSets + 1, exercise.targetSets);
  const finished = doneSets >= exercise.targetSets;

  async function completeSerie() {
    const updatedSets = [...exercise.sets, { weight, reps: exercise.reps, completedAt: Date.now() }];
    const updatedExercise = { ...exercise, sets: updatedSets };
    const updatedExercises = session.exercises.map((e) =>
      e.exerciseId === exerciseId ? updatedExercise : e
    );
    const updatedSession = { ...session, exercises: updatedExercises };
    setExercise(updatedExercise);
    setSession(updatedSession);
    await saveSession(user.uid, todayId(), updatedSession);

    if (updatedSets.length < exercise.targetSets) {
      startRest(exercise.restSeconds);
    } else {
      setTimeout(() => navigation.goBack(), 500);
    }
  }

  async function adjustRestDuration(delta) {
    const nextValue = Math.max(15, exercise.restSeconds + delta);
    const updatedExercise = { ...exercise, restSeconds: nextValue };
    const updatedExercises = session.exercises.map((e) =>
      e.exerciseId === exerciseId ? updatedExercise : e
    );
    const updatedSession = { ...session, exercises: updatedExercises };
    setExercise(updatedExercise);
    setSession(updatedSession);
    await saveSession(user.uid, todayId(), updatedSession);
  }

  function startRest(seconds) {
    setRestTotal(seconds);
    setRestLeft(seconds);
    setResting(true);
    scheduleRestEndNotification(seconds).then((id) => {
      notifIdRef.current = id;
    });
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setRestLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setResting(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function adjustRest(delta) {
    setRestLeft((prev) => Math.max(0, prev + delta));
    setRestTotal((prev) => Math.max(prev, restLeft + delta));
  }

  function skipRest() {
    clearInterval(intervalRef.current);
    cancelNotification(notifIdRef.current);
    setResting(false);
  }

  const restLabel = exercise.restSeconds >= 60 ? `${Math.round(exercise.restSeconds / 60)}min` : `${exercise.restSeconds}s`;
  const mm = String(Math.floor(restLeft / 60)).padStart(2, '0');
  const ss = String(restLeft % 60).padStart(2, '0');
  const circumference = 2 * Math.PI * 96;
  const restOffset = restTotal ? circumference * (1 - restLeft / restTotal) : 0;

  return (
    <View style={styles.screen}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={{ color: '#fff', fontSize: 16 }}>←</Text>
      </Pressable>

      <Text style={styles.tag}>{exercise.group === 'core' ? 'Core' : 'Fuerza'}</Text>
      <Text style={styles.name}>{exercise.name}</Text>
      <Text style={styles.target}>
        Objetivo: <Text style={styles.bold}>{exercise.reps} reps</Text> · descanso{' '}
        <Text style={styles.bold}>{restLabel}</Text>
      </Text>

      <View style={styles.track}>
        {Array.from({ length: exercise.targetSets }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < doneSets && styles.dotFilled,
              i === doneSets && !finished && styles.dotCurrent,
            ]}
          />
        ))}
      </View>

      <View style={styles.bigCount}>
        <Text style={styles.bigNum}>{finished ? '¡Listo!' : `Serie ${currentSerie}`}</Text>
        {!finished && <Text style={styles.bigLabel}>de {exercise.targetSets}</Text>}
      </View>

      {!finished && (
        <View style={styles.weightRow}>
          <Pressable style={styles.stepBtn} onPress={() => setWeight((w) => Math.max(0, w - 2.5))}>
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <View style={{ alignItems: 'center', minWidth: 90 }}>
            <Text style={styles.weightVal}>{weight}</Text>
            <Text style={styles.weightUnit}>KG</Text>
          </View>
          <Pressable style={styles.stepBtn} onPress={() => setWeight((w) => w + 2.5)}>
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
      )}

      {!finished && (
        <View style={styles.restEditRow}>
          <Text style={styles.restEditLabel}>Descanso entre series</Text>
          <View style={styles.restEditControls}>
            <Pressable style={styles.restEditBtn} onPress={() => adjustRestDuration(-15)}>
              <Text style={styles.restEditBtnText}>−15s</Text>
            </Pressable>
            <Text style={styles.restEditValue}>{restLabel}</Text>
            <Pressable style={styles.restEditBtn} onPress={() => adjustRestDuration(15)}>
              <Text style={styles.restEditBtnText}>+15s</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={{ flex: 1 }} />

      {!finished && (
        <Pressable style={styles.primaryBtn} onPress={completeSerie}>
          <Text style={styles.primaryBtnText}>Marcar serie completada ✓</Text>
        </Pressable>
      )}

      <Modal visible={resting} transparent animationType="fade">
        <View style={styles.restOverlay}>
          <Text style={styles.restTag}>Descanso</Text>
          <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginVertical: 20 }}>
            <Svg width={220} height={220} style={{ position: 'absolute' }}>
              <Circle cx={110} cy={110} r={96} stroke={colors.black3} strokeWidth={10} fill="none" />
              <Circle
                cx={110}
                cy={110}
                r={96}
                stroke={colors.red}
                strokeWidth={10}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={restOffset}
                rotation="-90"
                origin="110, 110"
              />
            </Svg>
            <Text style={styles.restTime}>{mm}:{ss}</Text>
            <Text style={styles.restLabelSmall}>restantes</Text>
          </View>
          <View style={styles.restAdjustRow}>
            <Pressable style={styles.restAdjustBtn} onPress={() => adjustRest(-15)}>
              <Text style={styles.restAdjustText}>−15s</Text>
            </Pressable>
            <Pressable style={styles.restAdjustBtn} onPress={skipRest}>
              <Text style={styles.restAdjustText}>Saltar</Text>
            </Pressable>
            <Pressable style={styles.restAdjustBtn} onPress={() => adjustRest(15)}>
              <Text style={styles.restAdjustText}>+15s</Text>
            </Pressable>
          </View>
          <Text style={styles.restNext}>
            Siguiente: <Text style={styles.bold}>Serie {Math.min(doneSets + 1, exercise.targetSets)}</Text>
          </Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black, padding: 20, paddingTop: 60 },
  backBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.black3, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  tag: { color: colors.red, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  name: { color: colors.white, fontSize: 26, fontWeight: '800', marginTop: 6, marginBottom: 4, letterSpacing: -0.4 },
  target: { color: colors.gray1, fontSize: 13 },
  bold: { color: colors.white, fontWeight: '700' },
  track: { flexDirection: 'row', gap: 8, marginTop: 22 },
  dot: { flex: 1, height: 6, borderRadius: 4, backgroundColor: colors.black3 },
  dotFilled: { backgroundColor: colors.red },
  dotCurrent: { backgroundColor: colors.gray2 },
  bigCount: { alignItems: 'center', marginTop: 30 },
  bigNum: { color: colors.white, fontSize: 52, fontWeight: '900', letterSpacing: -1 },
  bigLabel: { color: colors.gray1, fontSize: 13, fontWeight: '600' },
  weightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 26 },
  stepBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.black3, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  weightVal: { color: colors.white, fontSize: 30, fontWeight: '800' },
  weightUnit: { color: colors.gray1, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  restEditRow: { alignItems: 'center', marginTop: 22 },
  restEditLabel: { color: colors.gray1, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  restEditControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  restEditBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.black3, borderWidth: 1, borderColor: colors.border },
  restEditBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  restEditValue: { color: colors.white, fontSize: 15, fontWeight: '800', minWidth: 50, textAlign: 'center' },
  primaryBtn: { backgroundColor: colors.red, paddingVertical: 16, borderRadius: radius.md, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  restOverlay: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  restTag: { color: colors.red, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  restTime: { color: colors.white, fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  restLabelSmall: { color: colors.gray1, fontSize: 11, fontWeight: '700' },
  restAdjustRow: { flexDirection: 'row', gap: 10, marginBottom: 26 },
  restAdjustBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.black3, borderWidth: 1, borderColor: colors.border },
  restAdjustText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  restNext: { color: colors.gray1, fontSize: 12 },
});
