import { slugify } from '../keys'

/** Ejercicios con los que arranca la biblioteca del profe; los que él suma (con su video) quedan en `amExercises`. */
const BASE: { nombre: string; grupo: string }[] = [
  { nombre: 'Sentadilla con barra', grupo: 'Piernas' },
  { nombre: 'Sentadilla goblet', grupo: 'Piernas' },
  { nombre: 'Prensa 45°', grupo: 'Piernas' },
  { nombre: 'Peso muerto rumano', grupo: 'Piernas' },
  { nombre: 'Zancadas', grupo: 'Piernas' },
  { nombre: 'Hip thrust', grupo: 'Glúteos' },
  { nombre: 'Press banca', grupo: 'Pecho' },
  { nombre: 'Press inclinado con mancuernas', grupo: 'Pecho' },
  { nombre: 'Flexiones de brazos', grupo: 'Pecho' },
  { nombre: 'Remo con mancuerna', grupo: 'Espalda' },
  { nombre: 'Remo con barra', grupo: 'Espalda' },
  { nombre: 'Jalón al pecho', grupo: 'Espalda' },
  { nombre: 'Dominadas', grupo: 'Espalda' },
  { nombre: 'Press militar', grupo: 'Hombros' },
  { nombre: 'Vuelos laterales', grupo: 'Hombros' },
  { nombre: 'Curl de bíceps', grupo: 'Brazos' },
  { nombre: 'Extensión de tríceps en polea', grupo: 'Brazos' },
  { nombre: 'Plancha frontal', grupo: 'Core' },
]

export const BASE_EJERCICIOS = BASE.map((e) => ({ id: slugify(e.nombre), nombre: e.nombre, grupo: e.grupo }))
