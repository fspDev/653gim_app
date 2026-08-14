import { collection, doc, getDocs, setDoc, increment, query, orderBy, limit as fsLimit } from 'firebase/firestore';
import { db } from '../config/firebase';

function slugify(name) {
  return (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const code = ch.codePointAt(0);
      return !(code >= 0x0300 && code <= 0x036f);
    })
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function getExerciseLibrary() {
  const q = query(collection(db, 'gymExerciseLibrary'), orderBy('useCount', 'desc'), fsLimit(200));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function upsertLibraryExercise({ name, sets, reps, restSeconds }) {
  const id = slugify(name);
  if (!id) return;
  await setDoc(
    doc(db, 'gymExerciseLibrary', id),
    {
      name: name.trim(),
      defaultSets: sets,
      defaultReps: reps,
      defaultRestSeconds: restSeconds,
      useCount: increment(1),
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}
