import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  scheduleRestEndNotification,
  cancelNotification,
  notifyRestFinished,
} from '../services/notifications';
import { acquireWakeLock, releaseWakeLock } from '../utils/wakeLock';
import {
  isPiPSupported,
  drawExerciseFrame,
  requestTimerPiP,
  exitTimerPiP,
  onPiPLeave,
  onPiPEnter,
  armAutoPiP,
  disarmAutoPiP,
} from '../utils/pipTimer';
import { formatMMSS } from '../utils/time';

const STORAGE_KEY = 'activeRestTimer';
const PIP_MODE_KEY = 'pipMode';

// Si al volver a la app el cronómetro ya había terminado hace más de esto,
// no avisamos: el aviso llegaría tarde y sin sentido (era el caso molesto de
// "vibra recién cuando vuelvo a la pantalla").
const LATE_GRACE_SECONDS = 5;

// Un mismo cronómetro sirve para dos cosas:
//  - 'rest': el descanso entre series.
//  - 'work': un ejercicio por tiempo (calentamiento / elongación en bici).
const RestTimerContext = createContext(null);

export function RestTimerProvider({ children }) {
  const [info, setInfo] = useState(null); // { exerciseId, exerciseName, dayId, total, isLastSet, serieText, mode, ringLabel, notifyTitle, notifyBody }
  const [restLeft, setRestLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [pipMode, setPipModeState] = useState('onLeave'); // 'onLeave' | 'onSet' | 'manual'
  // Contador y no booleano: al pasar al siguiente ejercicio, la pantalla
  // nueva se monta antes de que se desmonte la anterior.
  const [exerciseScreens, setExerciseScreens] = useState(0);
  // Se emite cada vez que un cronómetro termina (solo o salteado). La pantalla
  // del ejercicio lo usa para pasar sola al siguiente ejercicio.
  const [finishedEvent, setFinishedEvent] = useState(null);
  const endAtRef = useRef(null);
  const pausedLeftRef = useRef(null);
  const totalRef = useRef(0);
  const intervalRef = useRef(null);
  const notifIdRef = useRef(null);
  const infoRef = useRef(null);

  useEffect(() => {
    onPiPLeave(() => setPipActive(false));
    onPiPEnter(() => setPipActive(true));
    AsyncStorage.getItem(PIP_MODE_KEY)
      .then((v) => {
        if (v === 'onLeave' || v === 'onSet' || v === 'manual') setPipModeState(v);
      })
      .catch(() => {});
  }, []);

  function registerExerciseScreen() {
    setExerciseScreens((n) => n + 1);
    return () => setExerciseScreens((n) => Math.max(0, n - 1));
  }

  function setPipMode(mode) {
    setPipModeState(mode);
    AsyncStorage.setItem(PIP_MODE_KEY, mode).catch(() => {});
  }

  // El video de la ventana flotante queda andando (oculto) mientras estás
  // entrenando, así el navegador lo puede pasar a flotante recién cuando
  // cambiás de app, y nunca mientras la estás usando.
  const trainingActive = exerciseScreens > 0 || !!info;
  useEffect(() => {
    if (pipMode === 'onLeave' && trainingActive) armAutoPiP();
    else disarmAutoPiP();
  }, [pipMode, trainingActive]);

  function persist() {
    const i = infoRef.current;
    if (!i) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...i,
        endAt: endAtRef.current,
        pausedLeft: pausedLeftRef.current,
        total: totalRef.current,
      })
    ).catch(() => {});
  }

  function drawRunning(left) {
    const i = infoRef.current;
    drawExerciseFrame({
      exerciseName: i?.exerciseName || '',
      resting: true,
      timeText: formatMMSS(left),
      percent: totalRef.current ? left / totalRef.current : 0,
      ringLabel: i?.ringLabel,
      serieText: i?.serieText || '',
    });
  }

  function scheduleNotif(seconds) {
    const i = infoRef.current;
    scheduleRestEndNotification(seconds, i?.notifyTitle, i?.notifyBody).then((handle) => {
      notifIdRef.current = handle;
    });
  }

  function cancelNotif() {
    const handle = notifIdRef.current;
    if (handle && !handle.fired) cancelNotification(handle);
    notifIdRef.current = null;
  }

  function finish({ notify, skipped }) {
    clearInterval(intervalRef.current);
    const i = infoRef.current;
    setRestLeft(0);
    setPaused(false);
    setInfo(null);
    infoRef.current = null;
    endAtRef.current = null;
    pausedLeftRef.current = null;
    // OJO: acá NO se cierra el PiP. Si estaba abierta, se queda abierta y la
    // pantalla del ejercicio la redibuja con el estado activo.

    const handle = notifIdRef.current;
    if (handle && !handle.fired) {
      // La notificación programada aún no se disparó: la cancelamos y, si
      // corresponde, avisamos ahora (así no se duplica el aviso).
      cancelNotification(handle);
      if (notify) notifyRestFinished(i?.notifyTitle, i?.notifyBody);
    } else if (!handle && notify) {
      notifyRestFinished(i?.notifyTitle, i?.notifyBody);
    }
    notifIdRef.current = null;

    releaseWakeLock();
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});

    if (i) {
      setFinishedEvent({
        id: `${Date.now()}-${Math.random()}`,
        exerciseId: i.exerciseId,
        mode: i.mode,
        isLastSet: i.isLastSet,
        skipped: !!skipped,
        at: Date.now(),
      });
    }
  }

  function tick() {
    if (!endAtRef.current) return;
    const left = Math.round((endAtRef.current - Date.now()) / 1000);
    if (left <= 0) {
      // Solo avisamos si terminó recién. Si terminó hace rato es porque el
      // sistema tuvo la app congelada, y avisar ahora sería tarde.
      finish({ notify: left > -LATE_GRACE_SECONDS });
      return;
    }
    setRestLeft(left);
    drawRunning(left);
  }

  function runInterval() {
    clearInterval(intervalRef.current);
    tick();
    intervalRef.current = setInterval(tick, 1000);
  }

  // Recupera un cronómetro en curso (o pausado) al abrir la app.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        const { endAt, pausedLeft, total, ...rest } = parsed;
        const resumedInfo = {
          ...rest,
          mode: rest.mode || 'rest',
          isLastSet: !!rest.isLastSet,
          serieText: rest.serieText || '',
          total,
        };
        totalRef.current = total;
        if (pausedLeft) {
          pausedLeftRef.current = pausedLeft;
          infoRef.current = resumedInfo;
          setInfo(resumedInfo);
          setPaused(true);
          setRestLeft(pausedLeft);
          drawRunning(pausedLeft);
          return;
        }
        const left = Math.round((endAt - Date.now()) / 1000);
        if (left > 0) {
          endAtRef.current = endAt;
          infoRef.current = resumedInfo;
          setInfo(resumedInfo);
          acquireWakeLock();
          runInterval();
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {}
    })();
    return () => clearInterval(intervalRef.current);
  }, []);

  // Al volver a la app (o a la pestaña), recalculamos al instante contra el
  // reloj real: los timers de JS se congelan cuando el sistema suspende la app,
  // así que sin esto el cronómetro quedaba "atrasado" al volver.
  useEffect(() => {
    if (Platform.OS === 'web') {
      const onVisible = () => {
        if (typeof document !== 'undefined' && !document.hidden && endAtRef.current) {
          acquireWakeLock(); // el wake lock se pierde al minimizar; se reengancha
          runInterval();
        }
      };
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        return () => {
          document.removeEventListener('visibilitychange', onVisible);
          window.removeEventListener('focus', onVisible);
        };
      }
      return undefined;
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && endAtRef.current) runInterval();
    });
    return () => sub.remove();
  }, []);

  function start({
    exerciseId,
    exerciseName,
    dayId,
    seconds,
    isLastSet,
    serieText,
    mode = 'rest',
    ringLabel,
    notifyTitle,
    notifyBody,
  }) {
    cancelNotif();
    endAtRef.current = Date.now() + seconds * 1000;
    pausedLeftRef.current = null;
    totalRef.current = seconds;
    const newInfo = {
      exerciseId,
      exerciseName,
      dayId,
      total: seconds,
      isLastSet: !!isLastSet,
      serieText: serieText || '',
      mode,
      ringLabel: ringLabel || (mode === 'rest' ? 'descanso restante' : 'tiempo restante'),
      notifyTitle,
      notifyBody,
    };
    setInfo(newInfo);
    infoRef.current = newInfo;
    setPaused(false);
    setRestLeft(seconds);
    drawRunning(seconds);
    persist();
    scheduleNotif(seconds);
    acquireWakeLock();
    runInterval();
  }

  function adjust(delta) {
    if (pausedLeftRef.current) {
      const nextLeft = Math.max(1, pausedLeftRef.current + delta);
      pausedLeftRef.current = nextLeft;
      totalRef.current = Math.max(totalRef.current, nextLeft);
      setRestLeft(nextLeft);
      setInfo((prev) => (prev ? { ...prev, total: totalRef.current } : prev));
      if (infoRef.current) infoRef.current = { ...infoRef.current, total: totalRef.current };
      drawRunning(nextLeft);
      persist();
      return;
    }
    if (!endAtRef.current) return;
    endAtRef.current = endAtRef.current + delta * 1000;
    const newTotal = Math.max(totalRef.current, totalRef.current + delta);
    totalRef.current = newTotal;
    setInfo((prev) => (prev ? { ...prev, total: newTotal } : prev));
    if (infoRef.current) infoRef.current = { ...infoRef.current, total: newTotal };

    // La notificación programada apuntaba al horario viejo: la reprogramamos.
    cancelNotif();
    const secondsLeft = Math.round((endAtRef.current - Date.now()) / 1000);
    if (secondsLeft > 0) scheduleNotif(secondsLeft);
    persist();
    tick();
  }

  function pause() {
    if (!endAtRef.current) return;
    const left = Math.max(1, Math.round((endAtRef.current - Date.now()) / 1000));
    clearInterval(intervalRef.current);
    cancelNotif();
    endAtRef.current = null;
    pausedLeftRef.current = left;
    setPaused(true);
    setRestLeft(left);
    releaseWakeLock();
    persist();
  }

  function resume() {
    if (!pausedLeftRef.current) return;
    endAtRef.current = Date.now() + pausedLeftRef.current * 1000;
    scheduleNotif(pausedLeftRef.current);
    pausedLeftRef.current = null;
    setPaused(false);
    acquireWakeLock();
    persist();
    runInterval();
  }

  function skip() {
    if (!infoRef.current) return;
    finish({ notify: false, skipped: true });
  }

  // Cancela sin contar como terminado (no dispara el pase al siguiente).
  function cancel() {
    if (!infoRef.current) return;
    infoRef.current = null;
    finish({ notify: false });
  }

  // Tiene que llamarse directamente desde el toque del usuario: el navegador
  // exige un gesto reciente para conceder PiP.
  async function enterPiP() {
    const ok = await requestTimerPiP();
    setPipActive(ok);
    return ok;
  }

  function exitPiP() {
    exitTimerPiP();
    setPipActive(false);
  }

  // La pantalla de ejercicio llama esto en cada cambio (peso, serie) para que
  // la ventana flotante muestre el estado actual incluso sin cronómetro.
  function updatePiPFrame({ exerciseName, serieText, weightText }) {
    if (infoRef.current) return; // hay un cronómetro activo, no lo pisamos
    drawExerciseFrame({ exerciseName, resting: false, serieText, weightText });
  }

  return (
    <RestTimerContext.Provider
      value={{
        running: !!info,
        resting: !!info && info.mode === 'rest',
        mode: info?.mode || null,
        paused,
        exerciseId: info?.exerciseId || null,
        exerciseName: info?.exerciseName || '',
        dayId: info?.dayId || null,
        isLastSet: !!info?.isLastSet,
        restLeft,
        restTotal: info?.total || 0,
        finishedEvent,
        pipSupported: isPiPSupported(),
        pipActive,
        pipMode,
        setPipMode,
        registerExerciseScreen,
        enterPiP,
        exitPiP,
        updatePiPFrame,
        start,
        adjust,
        pause,
        resume,
        skip,
        cancel,
      }}
    >
      {children}
    </RestTimerContext.Provider>
  );
}

export function useRestTimer() {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer debe usarse dentro de RestTimerProvider');
  return ctx;
}
