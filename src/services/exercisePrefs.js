import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Las preferencias se guardan por NOMBRE de ejercicio (no por id del plan),
// para que sobrevivan a que el profe re-arme el plan y se compartan entre
// todos los días que tengan el mismo ejercicio.
export function exerciseKey(name) {
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
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Guarda el último peso / descanso usado en un ejercicio, para que la próxima
// vez arranque con esos valores en vez de los de fábrica.
export async function saveExercisePref(uid, name, { weight, restSeconds }) {
  const key = exerciseKey(name);
  if (!key) return;
  const patch = {};
  if (weight !== undefined) patch.weight = weight;
  if (restSeconds !== undefined) patch.restSeconds = restSeconds;
  if (!Object.keys(patch).length) return;
  patch.updatedAt = Date.now();
  try {
    await setDoc(doc(db, 'gymUsers', uid), { exercisePrefs: { [key]: patch } }, { merge: true });
  } catch (e) {}
}

export function getExercisePref(prefs, name) {
  if (!prefs) return null;
  return prefs[exerciseKey(name)] || null;
}
