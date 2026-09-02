import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useRestTimer } from '../../context/RestTimerContext';
import { getSession, saveSession, todayId } from '../../services/sessions';
import { saveExercisePref } from '../../services/exercisePrefs';
import { formatMMSS } from '../../utils/time';

export default function ExerciseExecutionScreen({ route, navigation }) {
  const { exerciseId } = route.params;
  const { user } = useAuth();
  const restTimer = useRestTimer();
  const [session, setSession] = useState(null);
  const [exercise, setExercise] = useState(null);
  const [weight, setWeight] = useState(20);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await getSession(user.uid, todayId());
      setSession(s);
      const ex = s?.exercises.find((e) => e.exerciseId === exerciseId);
      setExercise(ex);
      if (ex) {
        // Arranca con el peso de la última serie hecha hoy; si todavía no hizo
        // ninguna, con el que dejó guardado la última vez que hizo este ejercicio.
        const lastToday = ex.sets?.length ? ex.sets[ex.sets.length - 1].weight : null;
        const initial = lastToday ?? ex.lastWeight;
        if (initial !== null && initial !== undefined) setWeight(initial);
      }
      setLoading(false);
    })();
  }, [exerciseId]);

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  if (!exercise) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.white, fontSize: 14, fontWeight: '700', marginBottom: 16, textAlign: 'center' }}>
          No pudimos cargar este ejercicio.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryBtnText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const doneSets = exercise.sets.length;
  const currentSerie = Math.min(doneSets + 1, exercise.targetSets);
  const finished = doneSets >= exercise.targetSets;
  const isResting = restTimer.resting && restTimer.exerciseId === exerciseId;

  async function completeSerie() {
    const updatedSets = [...exercise.sets, { weight, reps: exercise.reps, completedAt: Date.now() }];
    const updatedExercise = { ...exercise, sets: updatedSets, lastWeight: weight };
    const updatedExercises = session.exercises.map((e) =>
      e.exerciseId === exerciseId ? updatedExercise : e
    );
    const updatedSession = { ...session, exercises: updatedExercises };
    setExercise(updatedExercise);
    setSession(updatedSession);
    await saveSession(user.uid, todayId(), updatedSession);

    // Queda como valor por defecto para la próxima vez que toque este ejercicio.
    saveExercisePref(user.uid, exercise.name, { weight, restSeconds: exercise.restSeconds });

    const wasLast = updatedSets.length >= exercise.targetSets;

    // El descanso también corre después de la última serie: se sigue
    // descansando antes de pasar al ejercicio siguiente.
    restTimer.start({
      exerciseId,
      exerciseName: exercise.name,
      dayId: session.dayId,
      seconds: exercise.restSeconds,
      isLastSet: wasLast,
    });
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
    saveExercisePref(user.uid, exercise.name, { restSeconds: nextValue });
  }

  const restLabel = formatMMSS(exercise.restSeconds);
  const bigCircumference = 2 * Math.PI * 124;
  const restOffset = restTimer.restTotal
    ? bigCircumference * (1 - restTimer.restLeft / restTimer.restTotal)
    : 0;

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

      <Modal visible={isResting} transparent animationType="fade">
        <View style={styles.restOverlay}>
          <Text style={styles.restTag}>Descanso</Text>
          <Text style={styles.restExercise}>{exercise.name}</Text>
          <View style={{ width: 280, height: 280, alignItems: 'center', justifyContent: 'center', marginVertical: 24 }}>
            <Svg width={280} height={280} style={{ position: 'absolute' }}>
              <Circle cx={140} cy={140} r={124} stroke={colors.black3} strokeWidth={14} fill="none" />
              <Circle
                cx={140}
                cy={140}
                r={124}
                stroke={colors.red}
                strokeWidth={14}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${bigCircumference} ${bigCircumference}`}
                strokeDashoffset={restOffset}
                rotation="-90"
                origin="140, 140"
              />
            </Svg>
            <Text style={styles.restTime}>{formatMMSS(restTimer.restLeft)}</Text>
            <Text style={styles.restLabelSmall}>restantes</Text>
          </View>
          <View style={styles.restAdjustRow}>
            <Pressable style={styles.restAdjustBtn} onPress={() => restTimer.adjust(-15)}>
              <Text style={styles.restAdjustText}>−15s</Text>
            </Pressable>
            <Pressable style={styles.restAdjustBtn} onPress={restTimer.skip}>
              <Text style={styles.restAdjustText}>Saltar</Text>
            </Pressable>
            <Pressable style={styles.restAdjustBtn} onPress={() => restTimer.adjust(15)}>
              <Text style={styles.restAdjustText}>+15s</Text>
            </Pressable>
          </View>
          <Text style={styles.restNext}>
            {restTimer.isLastSet ? (
              <Text style={styles.restNextBold}>Ejercicio completado ✓</Text>
            ) : (
              <>
                Siguiente: <Text style={styles.restNextBold}>Serie {Math.min(doneSets + 1, exercise.targetSets)}</Text>
              </>
            )}
          </Text>
          <Pressable style={styles.restBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.restBackText}>Ver mi rutina</Text>
          </Pressable>
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
  restOverlay: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', padding: 20 },
  restTag: { color: colors.red, fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 },
  restExercise: { color: colors.white, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  restTime: { color: colors.white, fontSize: 68, fontWeight: '900', letterSpacing: -2 },
  restLabelSmall: { color: colors.gray1, fontSize: 15, fontWeight: '700', marginTop: 2 },
  restAdjustRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  restAdjustBtn: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 24, backgroundColor: colors.black3, borderWidth: 1, borderColor: colors.border },
  restAdjustText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  restNext: { color: colors.gray1, fontSize: 16 },
  restNextBold: { color: colors.white, fontSize: 16, fontWeight: '800' },
  restBackBtn: { marginTop: 22, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 24, borderWidth: 1, borderColor: colors.gray2 },
  restBackText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
