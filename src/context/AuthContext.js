import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const ADMIN_EMAIL = 'admin@653gym.app';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'gymUsers', firebaseUser.uid));
          setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        } catch (e) {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function loginClient(email, password) {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return true;
    } catch (e) {
      setAuthError(mapAuthError(e));
      return false;
    }
  }

  async function loginAdmin(username, password) {
    setAuthError(null);
    if (username.trim() !== 'Admin') {
      setAuthError('Usuario o contraseña incorrectos.');
      return false;
    }
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
      return true;
    } catch (e) {
      setAuthError('Usuario o contraseña incorrectos.');
      return false;
    }
  }

  async function logout() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, authError, setAuthError, loginClient, loginAdmin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function mapAuthError(e) {
  const code = e?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Revisá tu usuario y contraseña.';
  }
  if (code.includes('invalid-email')) return 'Ese nombre de usuario no es válido.';
  if (code.includes('too-many-requests')) return 'Demasiados intentos. Probá de nuevo en unos minutos.';
  return 'No pudimos iniciar sesión. Probá de nuevo.';
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
