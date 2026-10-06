import { stripDiacritics } from './keys'

/**
 * Cuentas sin servidor propio. Cada usuario ("nombre.apellido") entra con una cuenta interna de Firebase
 * que nunca ve. Como sin servidor no se le puede cambiar la contraseña a otro, el profe "resetea" creando
 * una cuenta interna nueva (juan.perez+2@…) y apuntando el usuario a esa; la vieja queda sin acceso.
 */

export const EMAIL_DOMAIN = '653gym.app'
export const MIN_CLAVE = 6

/** Lo que escribe la persona → usuario normalizado: "Juan Pérez" o "JUAN.PEREZ " → "juan.perez". */
export function normalizeUsername(input: string): string {
  return stripDiacritics(input.trim().toLowerCase())
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

/** Nombre y apellido → usuario: "María José" + "Gómez Paz" → "maria.jose.gomez.paz". */
export function usernameFrom(nombre: string, apellido: string): string {
  return normalizeUsername(`${nombre} ${apellido}`)
}

/** Si "juan.perez" ya existe: "juan.perez2", "juan.perez3"… */
export function nextFreeUsername(base: string, taken: (u: string) => boolean): string {
  if (!taken(base)) return base
  for (let n = 2; ; n++) if (!taken(`${base}${n}`)) return `${base}${n}`
}

/** Cuenta interna número `n` de un usuario: la 1 es juan.perez@…, las siguientes juan.perez+2@… */
export function emailFor(username: string, n = 1): string {
  return n <= 1 ? `${username}@${EMAIL_DOMAIN}` : `${username}+${n}@${EMAIL_DOMAIN}`
}

/** "30.123.456" → "30123456": el DNI solo con números (así es la contraseña de los socios). */
export const soloDni = (texto: string) => texto.replace(/\D/g, '')

/** `null` si el DNI (ya sin puntos) sirve de contraseña; si no, qué le falta. */
export function problemaDni(dni: string): string | null {
  if (dni.length < 6) return 'El DNI tiene que tener al menos 6 números.'
  if (dni.length > 9) return 'Ese DNI tiene demasiados números.'
  return null
}

/** `null` si sirve; si no, qué le falta. */
export function problemaClave(clave: string): string | null {
  if (clave.length < MIN_CLAVE) return `Tiene que tener al menos ${MIN_CLAVE} caracteres.`
  if (/\s/.test(clave)) return 'Sin espacios.'
  return null
}
