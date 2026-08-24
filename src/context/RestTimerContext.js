import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  scheduleRestEndNotification,
  cancelNotification,
  notifyRestFinished,
} from '../services/notifications';

const STORAGE_KEY = 'activeRestTimer';

const RestTimerContext = createContext(null);

export function RestTimerProvider({ children }) {
  const [info, setInfo] = useState(null); // { exerciseId, exerciseName, dayId, total }
  const [restLeft, setRestLeft] = useState(0);
  const endAtRef = useRef(null);
  const totalRef = useRef(0);
  const intervalRef = useRef(null);
  const notifIdRef = useRef(null);

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
          setInfo({ exerciseId: parsed.exerciseId, exerciseName: parsed.exerciseName, dayId: parsed.dayId, total: parsed.total });
          runInterval();
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {}
    })();
    return () => clearInterval(intervalRef.current);
  }, []);

  function tick() {
    const left = Math.round((endAtRef.current - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(intervalRef.current);
      setRestLeft(0);
      setInfo(null);

      // Si la notificación programada todavía no se disparó (lo normal cuando
      // la app estuvo visible), la cancelamos y notificamos ahora para no
      // duplicar el aviso.
      const handle = notifIdRef.current;
      if (handle && !handle.fired) {
        cancelNotification(handle);
        notifyRestFinished();
      } else if (!handle) {
        notifyRestFinished();
      }
      notifIdRef.current = null;

      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      return;
    }
    setRestLeft(left);
  }

  function runInterval() {
    clearInterval(intervalRef.current);
    tick();
    intervalRef.current = setInterval(tick, 1000);
  }

  function start({ exerciseId, exerciseName, dayId, seconds }) {
    const endAt = Date.now() + seconds * 1000;
    endAtRef.current = endAt;
    totalRef.current = seconds;
    setInfo({ exerciseId, exerciseName, dayId, total: seconds });
    setRestLeft(seconds);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ exerciseId, exerciseName, dayId, endAt, total: seconds })).catch(() => {});
    scheduleRestEndNotification(seconds).then((id) => {
      notifIdRef.current = id;
    });
    runInterval();
  }

  function adjust(delta) {
    if (!endAtRef.current) return;
    endAtRef.current = endAtRef.current + delta * 1000;
    const newTotal = Math.max(totalRef.current, totalRef.current + delta);
    totalRef.current = newTotal;
    setInfo((prev) => (prev ? { ...prev, total: newTotal } : prev));
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!stored) return;
      const parsed = JSON.parse(stored);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, endAt: endAtRef.current, total: newTotal })).catch(() => {});
    });
    tick();
  }

  function skip() {
    clearInterval(intervalRef.current);
    cancelNotification(notifIdRef.current);
    setInfo(null);
    setRestLeft(0);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }

  return (
    <RestTimerContext.Provider
      value={{
        resting: !!info,
        exerciseId: info?.exerciseId || null,
        exerciseName: info?.exerciseName || '',
        dayId: info?.dayId || null,
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
