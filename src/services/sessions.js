import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit as fsLimit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// IMPORTANTE: usar la fecha LOCAL, no UTC. Con toISOString() el día "saltaba"
// al siguiente a partir de las 21:00 en Argentina (UTC-3), lo que hacía que la
// sesión en curso pareciera reiniciarse sola a mitad del entrenamiento.
function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayId() {
  return todayKey();
}

// Devuelve { ok, session }. Distinguir "no existe" de "falló la lectura" es
// clave: si falla la red y devolviéramos null, la Home crearía una sesión
// nueva en blanco y pisaría el progreso del día.
export async function getSessionSafe(uid, dateKey) {
  try {
    const snap = await getDoc(doc(db, 'gymSessions', uid, 'logs', dateKey));
    return { ok: true, session: snap.exists() ? snap.data() : null };
  } catch (e) {
    return { ok: false, session: null };
  }
}

export async function getSession(uid, dateKey) {
  const snap = await getDoc(doc(db, 'gymSessions', uid, 'logs', dateKey));
  return snap.exists() ? snap.data() : null;
}

export async function saveSession(uid, dateKey, data) {
  await setDoc(doc(db, 'gymSessions', uid, 'logs', dateKey), data, { merge: true });
}

export async function getRecentSessions(uid, max = 30) {
  const q = query(collection(db, 'gymSessions', uid, 'logs'), orderBy('date', 'desc'), fsLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function computePercent(session) {
  if (!session || !session.exercises?.length) return 0;
  const totalSets = session.exercises.reduce((acc, ex) => acc + ex.targetSets, 0);
  const doneSets = session.exercises.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0);
  if (totalSets === 0) return 0;
  return Math.round((doneSets / totalSets) * 100);
}
