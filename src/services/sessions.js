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

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function todayId() {
  return todayKey();
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
