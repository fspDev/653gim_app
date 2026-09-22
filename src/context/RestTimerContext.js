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
} from '../utils/pipTimer';
import { formatMMSS } from '../utils/time';

const STORAGE_KEY = 'activeRestTimer';

// Si al volver a la app el descanso ya había terminado hace más de esto,
// no avisamos: el aviso llegaría tarde y sin sentido (era el caso molesto de
// "vibra recién cuando vuelvo a la pantalla").
const LATE_GRACE_SECONDS = 5;

const RestTimerContext = createContext(null);

export function RestTimerProvider({ children }) {
  const [info, setInfo] = useState(null); // { exerciseId, exerciseName, dayId, total, isLastSet }
  const [restLeft, setRestLeft] = useState(0);
  const [pipActive, setPipActive] = useState(false);
  const endAtRef = useRef(null);
  const totalRef = useRef(0);
  const intervalRef = useRef(null);
  const notifIdRef = useRef(null);
  const infoRef = useRef(null);

  // Refs para poder usar estas funciones desde los listeners sin recrearlos.
  const tickRef = useRef(() => {});

  useEffect(() => {
    onPiPLeave(() => setPipActive(false));
  }, []);

  function finish({ notify }) {
    clearInterval(intervalRef.current);
    setRestLeft(0);
    setInfo(null);
    infoRef.current = null;
    // OJO: acá NO se cierra el PiP. Ahora la ventana flotante también sirve
    // para ver la serie/peso mientras no hay descanso, así que si estaba
    // abierta, se queda abierta — la pantalla del ejercicio se encarga de
    // redibujarla con el estado activo apenas termina el descanso.

    const handle = notifIdRef.current;
    if (handle && !handle.fired) {
      // La notificación programada aún no se disparó: la cancelamos y, si
      // corresponde, avisamos ahora (así no se duplica el aviso).
      cancelNotification(handle);
      if (notify) notifyRestFinished();
    } else if (!handle && notify) {
      notifyRestFinished();
    }
    notifIdRef.current = null;

    releaseWakeLock();
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }

  function tick() {
    if (!endAtRef.current) return;
    const left = Math.round((endAtRef.current - Date.now()) / 1000);
    if (left <= 0) {
      // Solo avisamos si el descanso terminó recién. Si terminó hace rato es
      // porque el sistema tuvo la app congelada, y avisar ahora sería tarde.
      finish({ notify: left > -LATE_GRACE_SECONDS });
      return;
    }
    setRestLeft(left);
    drawExerciseFrame({
      exerciseName: infoRef.current?.exerciseName || '',
      resting: true,
      timeText: formatMMSS(left),
      percent: totalRef.current ? left / totalRef.current : 0,
      serieText: infoRef.current?.serieText || '',
    });
  }
  tickRef.current = tick;

  function runInterval() {
    clearInterval(intervalRef.current);
    tick();
    intervalRef.current = setInterval(tick, 1000);
  }

  // Recupera un descanso en curso al abrir la app.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        const left = Math.round((parsed.endAt - Date.now()) / 1000);
        if (left > 0) {
          endAtRef.current = parsed.endAt;
          totalRef.current = parsed.total;
          const resumedInfo = {
            exerciseId: parsed.exerciseId,
            exerciseName: parsed.exerciseName,
            dayId: parsed.dayId,
            total: parsed.total,
            isLastSet: !!parsed.isLastSet,
            serieText: parsed.serieText || '',
          };
          setInfo(resumedInfo);
          infoRef.current = resumedInfo;
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

  function start({ exerciseId, exerciseName, dayId, seconds, isLastSet, serieText }) {
    const endAt = Date.now() + seconds * 1000;
    endAtRef.current = endAt;
    totalRef.current = seconds;
    const newInfo = { exerciseId, exerciseName, dayId, total: seconds, isLastSet: !!isLastSet, serieText: serieText || '' };
    setInfo(newInfo);
    infoRef.current = newInfo;
    setRestLeft(seconds);
    drawExerciseFrame({
      exerciseName,
      resting: true,
      timeText: formatMMSS(seconds),
      percent: 1,
      serieText: serieText || '',
    });
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ exerciseId, exerciseName, dayId, endAt, total: seconds, isLastSet: !!isLastSet, serieText: serieText || '' })
    ).catch(() => {});
    scheduleRestEndNotification(seconds).then((handle) => {
      notifIdRef.current = handle;
    });
    acquireWakeLock();
    runInterval();
  }

  function adjust(delta) {
    if (!endAtRef.current) return;
    endAtRef.current = endAtRef.current + delta * 1000;
    const newTotal = Math.max(totalRef.current, totalRef.current + delta);
    totalRef.current = newTotal;
    setInfo((prev) => (prev ? { ...prev, total: newTotal } : prev));
    if (infoRef.current) infoRef.current = { ...infoRef.current, total: newTotal };

    // La notificación programada apuntaba al horario viejo: la reprogramamos.
    const handle = notifIdRef.current;
    if (handle && !handle.fired) cancelNotification(handle);
    notifIdRef.current = null;
    const secondsLeft = Math.round((endAtRef.current - Date.now()) / 1000);
    if (secondsLeft > 0) {
      scheduleRestEndNotification(secondsLeft).then((h) => {
        notifIdRef.current = h;
      });
    }

    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!stored) return;
      const parsed = JSON.parse(stored);
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...parsed, endAt: endAtRef.current, total: newTotal })
      ).catch(() => {});
    });
    tick();
  }

  function skip() {
    endAtRef.current = null;
    finish({ notify: false });
  }

  // Tiene que llamarse directamente desde el toque del usuario (el botón "🗗
  // Modo flotante"): el navegador exige un gesto reciente para conceder PiP.
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
  // la ventana flotante muestre el estado actual incluso cuando NO está
  // corriendo el descanso. Mientras hay un descanso activo, el dibujo lo
  // maneja tick() y esto no interfiere.
  function updatePiPFrame({ exerciseName, serieText, weightText }) {
    if (infoRef.current) return; // hay un descanso activo, no lo pisamos
    drawExerciseFrame({ exerciseName, resting: false, serieText, weightText });
  }

  return (
    <RestTimerContext.Provider
      value={{
        resting: !!info,
        exerciseId: info?.exerciseId || null,
        exerciseName: info?.exerciseName || '',
        dayId: info?.dayId || null,
        isLastSet: !!info?.isLastSet,
        restLeft,
        restTotal: info?.total || 0,
        pipSupported: isPiPSupported(),
        pipActive,
        enterPiP,
        exitPiP,
        updatePiPFrame,
        start,
        adjust,
        skip,
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
