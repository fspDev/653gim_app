/** El proyecto de Firebase compartido con SomaApp y AM: todo lo de esta versión lleva el prefijo "g653". */
export const firebaseConfig = {
  apiKey: 'AIzaSyAeBQNCxL8tzeRfAfyjTOOqcivt5lFEgjk',
  authDomain: 'somaapp-7166a.firebaseapp.com',
  projectId: 'somaapp-7166a',
  storageBucket: 'somaapp-7166a.firebasestorage.app',
  messagingSenderId: '804374144817',
  appId: '1:804374144817:web:73c38e8af161da4a503210',
}

export const COL = {
  /** `g653Config/profe`: quién es el profe ({ uid, nombre, username }). */
  config: 'g653Config',
  /** `g653Logins/{usuario}`: con qué cuenta interna entra cada usuario ({ email, sid?, rol }). */
  logins: 'g653Logins',
  /** `g653Students/{sid}` + subcolecciones `days`, `logs`, `pagos`, `medidas`. */
  students: 'g653Students',
  /** Biblioteca de ejercicios del profe. */
  exercises: 'g653Exercises',
} as const
