import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { firebaseConfig } from '../config/firebaseConfig';
import { savePlanDay } from './plans';

// El "usuario" del cliente es su nombre y apellido; lo convertimos a un
// email interno (no visible para el cliente) porque Firebase Auth requiere uno.
function stripDiacritics(str) {
  return str
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const code = ch.codePointAt(0);
      return !(code >= 0x0300 && code <= 0x036f); // combining marks
    })
    .join('');
}

export function usernameToEmail(username) {
  const slug = stripDiacritics((username || '').trim().toLowerCase())
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${slug}@653gym.app`;
}

// Crea el login del cliente sin cerrar la sesión del admin actual,
// usando una segunda instancia de Firebase solo para el alta.
export async function createClientAccount({ firstName, lastName, phone, dni, coachName, planType }) {
  const username = `${firstName} ${lastName}`.trim();
  const email = usernameToEmail(username);
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, String(dni));
    const uid = cred.user.uid;
    await setDoc(doc(db, 'gymUsers', uid), {
      role: 'client',
      firstName,
      lastName,
      phone: phone || '',
      dni: String(dni),
      username,
      coachName: coachName || '',
      planType: planType || 'weekly',
      weeklyDays: [],
      sessionTime: '18:30',
      feeStatus: 'ok',
      notifPrefs: { restEnd: true, gymReminder: true, feeReminder: false },
      createdAt: Date.now(),
    });
    await signOut(secondaryAuth);

    // Plantilla en blanco: un solo día para arrancar, sin ejercicios cargados.
    await savePlanDay(uid, 'day1', {
      label: 'Día 1',
      order: 1,
      groups: { core: [], fuerza: [] },
    });

    return { uid, email, username };
  } finally {
    await deleteApp(secondaryApp);
  }
}

// Cambia la contraseña (DNI) de un cliente sin cerrar la sesión del admin.
// Necesita la contraseña actual porque Firebase Auth no permite cambiarla
// desde afuera sin el SDK de administrador (que requiere plan pago).
export async function changeClientPassword({ email, currentDni, newDni }) {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await signInWithEmailAndPassword(secondaryAuth, email, String(currentDni));
    await updatePassword(cred.user, String(newDni));
    await signOut(secondaryAuth);
  } finally {
    await deleteApp(secondaryApp);
  }
}

export async function updateClientProfile(uid, data) {
  await updateDoc(doc(db, 'gymUsers', uid), data);
}
