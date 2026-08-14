import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function getPlanDays(uid) {
  const q = query(collection(db, 'gymPlans', uid, 'days'), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getPlanDay(uid, dayId) {
  const snap = await getDoc(doc(db, 'gymPlans', uid, 'days', dayId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function savePlanDay(uid, dayId, data) {
  await setDoc(doc(db, 'gymPlans', uid, 'days', dayId), { ...data, updatedAt: Date.now() }, { merge: true });
}

export async function deletePlanDay(uid, dayId) {
  await deleteDoc(doc(db, 'gymPlans', uid, 'days', dayId));
}

export function newExercise({ name, sets, reps, restSeconds, order }) {
  return {
    id: `${Date.now()}-${Math.round(Math.random() * 9999)}`,
    name,
    sets,
    reps,
    restSeconds,
    order,
  };
}
