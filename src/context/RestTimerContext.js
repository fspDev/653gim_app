import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  scheduleRestEndNotification,
  cancelNotification,
  notifyRestFinished,
} from '../services/notifications';
import { acquireWakeLock, releaseWakeLock } from '../utils/wakeLock';

const STORAGE_KEY = 'activeRestTimer';

// Si al volver a la app el descanso ya había terminado hace más de esto,
// no avisamos: el aviso llegaría tarde y sin sentido (era el caso molesto de
// "vibra recién cuando vuelvo a la pantalla").
const LATE_GRACE_SECONDS = 5;

const RestTimerContext = createContext(null);

export function RestTimerProvider({ children }) {
  const [info, setInfo] = useState(null); // { exerciseId, exerciseName, dayId, total, isLastSet }
  const [restLeft, setRestLeft] = useState(0);
  const endAtRef = useRef(null);
  const totalRef = useRef(0);
  const intervalRef = useRef(null);
  const notifIdRef = useRef(null);

  // Refs para poder usar estas funciones desde los listeners sin recrearlos.
  const tickRef = useRef(() => {});

  function finish({ notify }) {
    clearInterval(intervalRef.current);
    setRestLeft(0);
    setInfo(null);

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
          setInfo({
            exerciseId: parsed.exerciseId,
            exerciseName: parsed.exerciseName,
            dayId: parsed.dayId,
            total: parsed.total,
            isLastSet: !!parsed.isLastSet,
          });
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

  function start({ exerciseId, exerciseName, dayId, seconds, isLastSet }) {
    const endAt = Date.now() + seconds * 1000;
    endAtRef.current = endAt;
    totalRef.current = seconds;
    setInfo({ exerciseId, exerciseName, dayId, total: seconds, isLastSet: !!isLastSet });
    setRestLeft(seconds);
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ exerciseId, exerciseName, dayId, endAt, total: seconds, isLastSet: !!isLastSet })
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
