import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function getClients() {
  const q = query(collection(db, 'gymUsers'), where('role', '==', 'client'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'gymUsers', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, 'gymUsers', uid), data);
}
