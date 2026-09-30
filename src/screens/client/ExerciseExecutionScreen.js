import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, radius } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useRestTimer } from '../../context/RestTimerContext';
import { getSession, saveSession, todayId } from '../../services/sessions';
import { saveExercisePref } from '../../services/exercisePrefs';
import { isTimed } from '../../services/timedBlocks';
import { formatMMSS } from '../../utils/time';

const RING = 280;
const RING_R = 124;
const RING_C = 2 * Math.PI * RING_R;

function isDone(ex) {
  return ex.sets.length >= ex.targetSets;
}

// El siguiente pendiente después del actual; si no hay, alguno anterior que
// haya quedado sin hacer.
function findNextExercise(session, currentId) {
  if (!session) return null;
  const list = session.exercises;
  const idx = list.findIndex((e) => e.exerciseId === currentId);
  const after = list.slice(idx + 1).find((e) => !isDone(e));
  return after || list.slice(0, Math.max(idx, 0)).find((e) => !isDone(e)) || null;
}

export default function ExerciseExecutionScreen({ route, navigation }) {
  const { exerciseId } = route.params;
  const { user } = useAuth();
  const restTimer = useRestTimer();
  const [session, setSession] = useState(null);
  const [exercise, setExercise] = useState(null);
  const [weight, setWeight] = useState(20);
  const [loading, setLoading] = useState(true);
  const mountedAtRef = useRef(Date.now());
  const handledEventRef = useRef(null);
  const sessionRef = useRef(null);
  sessionRef.current = session;

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

  // Mientras estás en esta pantalla, la ventana flotante queda lista para
  // aparecer si cambiás de app.
  useEffect(() => restTimer.registerExerciseScreen(), []);

  const timed = isTimed(exercise);
  const doneSets = exercise ? exercise.sets.length : 0;
  const currentSerie = exercise ? Math.min(doneSets + 1, exercise.targetSets) : 0;
  const finished = exercise ? doneSets >= exercise.targetSets : false;
  const timerIsMine = restTimer.running && restTimer.exerciseId === exerciseId;
  const isResting = timerIsMine && restTimer.mode === 'rest';
  const isWorking = timerIsMine && restTimer.mode === 'work';
  const nextExercise = findNextExercise(session, exerciseId);

  // Mantiene la ventana flotante al día durante TODO el ejercicio. Si hay un
  // cronómetro andando, updatePiPFrame no hace nada (ese dibujo lo maneja él).
  // OJO: este hook tiene que llamarse siempre, en el mismo orden, aunque
  // "exercise" todavía no haya cargado (si no, la pantalla queda en blanco).
  useEffect(() => {
    if (!exercise) return;
    restTimer.updatePiPFrame({
      exerciseName: exercise.name,
      serieText: finished ? '¡Listo!' : timed ? formatMMSS(exercise.durationSeconds) : `Serie ${currentSerie} de ${exercise.targetSets}`,
      weightText: finished || timed ? '' : `${weight} kg`,
    });
  }, [exercise, currentSerie, finished, weight, restTimer.running]);

  // Cuando termina el último cronómetro de este ejercicio (el descanso tras
  // la última serie, o el tiempo de bici), pasa solo al siguiente.
  useEffect(() => {
    const ev = restTimer.finishedEvent;
    if (!ev || ev.exerciseId !== exerciseId || !ev.isLastSet) return;
    if (ev.at < mountedAtRef.current || handledEventRef.current === ev.id) return;
    handledEventRef.current = ev.id;
    goToNext();
  }, [restTimer.finishedEvent]);

  function goToNext() {
    const next = findNextExercise(sessionRef.current, exerciseId);
    if (next) {
      navigation.replace('ExerciseExecution', { exerciseId: next.exerciseId, dayId: sessionRef.current.dayId });
    } else {
      navigation.goBack();
    }
  }

  // Con el modo "al marcar serie", la ventana flotante se pide dentro del
  // toque: el navegador solo la concede con un gesto reciente.
  function maybeOpenPiPOnGesture() {
    if (restTimer.pipMode === 'onSet' && restTimer.pipSupported && !restTimer.pipActive) {
      restTimer.enterPiP();
    }
  }

  async function persistExercise(updatedExercise) {
    const updatedSession = {
      ...session,
      exercises: session.exercises.map((e) => (e.exerciseId === exerciseId ? updatedExercise : e)),
    };
    setExercise(updatedExercise);
    setSession(updatedSession);
    await saveSession(user.uid, todayId(), updatedSession);
  }

  async function completeSerie() {
    maybeOpenPiPOnGesture();

    const updatedSets = [...exercise.sets, { weight, reps: exercise.reps, completedAt: Date.now() }];
    const updatedExercise = { ...exercise, sets: updatedSets, lastWeight: weight };
    const wasLast = updatedSets.length >= exercise.targetSets;
    const nextSerieText = wasLast ? 'Ejercicio completado' : `Serie ${updatedSets.length + 1} de ${exercise.targetSets}`;

    // El descanso arranca antes de guardar: si la red está lenta, el
    // cronómetro no tiene por qué esperarla. También corre después de la
    // última serie; al terminar, pasa solo al ejercicio siguiente.
    restTimer.start({
      exerciseId,
      exerciseName: exercise.name,
      dayId: session.dayId,
      seconds: exercise.restSeconds,
      isLastSet: wasLast,
      serieText: nextSerieText,
    });

    await persistExercise(updatedExercise);
    // Queda como valor por defecto para la próxima vez que toque este ejercicio.
    saveExercisePref(user.uid, exercise.name, { weight, restSeconds: exercise.restSeconds });
  }

  async function adjustRestDuration(delta) {
    const nextValue = Math.max(15, exercise.restSeconds + delta);
    await persistExercise({ ...exercise, restSeconds: nextValue });
    saveExercisePref(user.uid, exercise.name, { restSeconds: nextValue });
  }

  async function adjustTimedDuration(deltaSeconds) {
    const nextValue = Math.max(60, exercise.durationSeconds + deltaSeconds);
    await persistExercise({ ...exercise, durationSeconds: nextValue });
    saveExercisePref(user.uid, exercise.name, { durationSeconds: nextValue });
  }

  // El bloque de bici cuenta como hecho al arrancar (así el progreso no
  // depende de que la app siga abierta hasta el final). Si lo cancelás, se
  // descuenta.
  async function startTimed() {
    maybeOpenPiPOnGesture();
    restTimer.start({
      exerciseId,
      exerciseName: exercise.name,
      dayId: session.dayId,
      seconds: exercise.durationSeconds,
      isLastSet: true,
      serieText: exercise.subtitle,
      mode: 'work',
      ringLabel: 'bici fija',
      notifyTitle: `¡${exercise.name} terminado! 🚴`,
      notifyBody: nextExercise ? `Seguís con: ${nextExercise.name}` : 'Terminaste la rutina de hoy 💪',
    });
    await persistExercise({ ...exercise, sets: [{ durationSeconds: exercise.durationSeconds, completedAt: Date.now() }] });
  }

  async function cancelTimed() {
    restTimer.cancel();
    await persistExercise({ ...exercise, sets: [] });
  }

  async function redoTimed() {
    await persistExercise({ ...exercise, sets: [] });
  }

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

  const ringOffset = restTimer.restTotal ? RING_C * (1 - restTimer.restLeft / restTimer.restTotal) : 0;
  const nextLabel = nextExercise ? nextExercise.name : 'Fin de la rutina';

  const pipButton = restTimer.pipSupported && restTimer.pipMode === 'manual' && (
    <Pressable
      style={[styles.pipBtnInline, restTimer.pipActive && styles.pipBtnActive]}
      onPress={() => (restTimer.pipActive ? restTimer.exitPiP() : restTimer.enterPiP())}
    >
      <Text style={styles.pipBtnText}>
        {restTimer.pipActive ? '🗗 Flotando — tocá para volver' : '🗗 Modo flotante'}
      </Text>
    </Pressable>
  );

  const header = (
    <>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={{ color: '#fff', fontSize: 16 }}>←</Text>
      </Pressable>
      <Text style={styles.tag}>
        {timed ? exercise.subtitle : exercise.group === 'core' ? 'Core' : 'Fuerza'}
      </Text>
      <Text style={styles.name}>{exercise.name}</Text>
    </>
  );

  if (timed) {
    return (
      <View style={styles.screen}>
        {header}
        <Text style={styles.target}>
          Tiempo: <Text style={styles.bold}>{formatMMSS(isWorking ? restTimer.restTotal : exercise.durationSeconds)}</Text> · después:{' '}
          <Text style={styles.bold}>{nextLabel}</Text>
        </Text>

        <View style={styles.ringWrap}>
          <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
            <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={colors.black3} strokeWidth={14} fill="none" />
            {isWorking && (
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={RING_R}
                stroke={restTimer.paused ? colors.gray2 : colors.red}
                strokeWidth={14}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${RING_C} ${RING_C}`}
                strokeDashoffset={ringOffset}
                rotation="-90"
                origin={`${RING / 2}, ${RING / 2}`}
              />
            )}
          </Svg>
          <Text style={styles.restTime}>
            {isWorking ? formatMMSS(restTimer.restLeft) : finished ? '✓' : formatMMSS(exercise.durationSeconds)}
          </Text>
          <Text style={styles.restLabelSmall}>
            {isWorking ? (restTimer.paused ? 'en pausa' : 'restantes') : finished ? 'hecho' : 'listo para arrancar'}
          </Text>
        </View>

        {isWorking ? (
          <>
            <View style={styles.restAdjustRow}>
              <Pressable style={styles.restAdjustBtn} onPress={() => restTimer.adjust(-60)}>
                <Text style={styles.restAdjustText}>−1 min</Text>
              </Pressable>
              <Pressable
                style={styles.restAdjustBtn}
                onPress={() => (restTimer.paused ? restTimer.resume() : restTimer.pause())}
              >
                <Text style={styles.restAdjustText}>{restTimer.paused ? '▶ Seguir' : '❚❚ Pausa'}</Text>
              </Pressable>
              <Pressable style={styles.restAdjustBtn} onPress={() => restTimer.adjust(60)}>
                <Text style={styles.restAdjustText}>+1 min</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }} />
            {pipButton}
            <Pressable style={styles.primaryBtn} onPress={restTimer.skip}>
              <Text style={styles.primaryBtnText}>Terminar y seguir →</Text>
            </Pressable>
            <Pressable style={styles.linkBtn} onPress={cancelTimed}>
              <Text style={styles.linkBtnText}>Cancelar</Text>
            </Pressable>
          </>
        ) : finished ? (
          <>
            <View style={{ flex: 1 }} />
            {nextExercise && (
              <Pressable style={styles.primaryBtn} onPress={goToNext}>
                <Text style={styles.primaryBtnText}>Siguiente: {nextExercise.name} →</Text>
              </Pressable>
            )}
            <Pressable style={styles.linkBtn} onPress={redoTimed}>
              <Text style={styles.linkBtnText}>Hacerlo de nuevo</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.restEditRow}>
              <Text style={styles.restEditLabel}>Duración</Text>
              <View style={styles.restEditControls}>
                <Pressable style={styles.restEditBtn} onPress={() => adjustTimedDuration(-60)}>
                  <Text style={styles.restEditBtnText}>−1 min</Text>
                </Pressable>
                <Text style={styles.restEditValue}>{formatMMSS(exercise.durationSeconds)}</Text>
                <Pressable style={styles.restEditBtn} onPress={() => adjustTimedDuration(60)}>
                  <Text style={styles.restEditBtnText}>+1 min</Text>
                </Pressable>
              </View>
            </View>
            <View style={{ flex: 1 }} />
            {pipButton}
            <Pressable style={styles.primaryBtn} onPress={startTimed}>
              <Text style={styles.primaryBtnText}>Empezar ▶</Text>
            </Pressable>
            {nextExercise && (
              <Pressable style={styles.linkBtn} onPress={goToNext}>
                <Text style={styles.linkBtnText}>Saltear</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    );
  }

  const restLabel = formatMMSS(exercise.restSeconds);

  return (
    <View style={styles.screen}>
      {header}
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

      {pipButton}

      {!finished && (
        <Pressable style={styles.primaryBtn} onPress={completeSerie}>
          <Text style={styles.primaryBtnText}>Marcar serie completada ✓</Text>
        </Pressable>
      )}
      {finished && !isResting && nextExercise && (
        <Pressable style={styles.primaryBtn} onPress={goToNext}>
          <Text style={styles.primaryBtnText}>Siguiente: {nextExercise.name} →</Text>
        </Pressable>
      )}

      <Modal visible={isResting} transparent animationType="fade">
        <View style={styles.restOverlay}>
          <Text style={styles.restTag}>Descanso</Text>
          <Text style={styles.restExercise}>{exercise.name}</Text>
          <View style={styles.ringWrap}>
            <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
              <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={colors.black3} strokeWidth={14} fill="none" />
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={RING_R}
                stroke={colors.red}
                strokeWidth={14}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${RING_C} ${RING_C}`}
                strokeDashoffset={ringOffset}
                rotation="-90"
                origin={`${RING / 2}, ${RING / 2}`}
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
              <Text style={styles.restAdjustText}>{restTimer.isLastSet ? 'Seguir →' : 'Saltar'}</Text>
            </Pressable>
            <Pressable style={styles.restAdjustBtn} onPress={() => restTimer.adjust(15)}>
              <Text style={styles.restAdjustText}>+15s</Text>
            </Pressable>
          </View>
          <Text style={styles.restNext}>
            {restTimer.isLastSet ? (
              <>
                Ejercicio completado ✓{'\n'}
                <Text style={styles.restNextSmall}>Después: </Text>
                <Text style={styles.restNextBold}>{nextLabel}</Text>
              </>
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
  primaryBtn: { backgroundColor: colors.red, paddingVertical: 16, paddingHorizontal: 12, borderRadius: radius.md, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  linkBtn: { alignItems: 'center', paddingVertical: 10 },
  linkBtnText: { color: colors.gray1, fontSize: 13, fontWeight: '700' },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center', marginVertical: 24, alignSelf: 'center' },
  restOverlay: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', padding: 20 },
  restTag: { color: colors.red, fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 },
  restExercise: { color: colors.white, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  restTime: { color: colors.white, fontSize: 68, fontWeight: '900', letterSpacing: -2 },
  restLabelSmall: { color: colors.gray1, fontSize: 15, fontWeight: '700', marginTop: 2 },
  restAdjustRow: { flexDirection: 'row', gap: 12, marginBottom: 28, justifyContent: 'center' },
  restAdjustBtn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 24, backgroundColor: colors.black3, borderWidth: 1, borderColor: colors.border },
  restAdjustText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  restNext: { color: colors.gray1, fontSize: 16, textAlign: 'center' },
  restNextSmall: { color: colors.gray1, fontSize: 14 },
  restNextBold: { color: colors.white, fontSize: 16, fontWeight: '800' },
  restBackBtn: { marginTop: 22, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 24, borderWidth: 1, borderColor: colors.gray2 },
  pipBtnInline: {
    marginBottom: 12, paddingVertical: 12, borderRadius: 18, alignItems: 'center',
    backgroundColor: colors.black3, borderWidth: 1, borderColor: colors.border,
  },
  pipBtnActive: { backgroundColor: colors.redDim, borderColor: colors.red },
  pipBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  restBackText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
