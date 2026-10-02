// Claves y formatos compartidos. Sin Firebase: lo usan también la lógica pura y los tests.

/** Cuenta interna de Firebase a partir del nombre (el socio nunca la ve). */
export function usernameToEmail(username: string): string {
  const slug = stripDiacritics(username.trim().toLowerCase())
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
  return `${slug}@653gym.app`
}

export const ADMIN_EMAIL = 'admin@653gym.app'

export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** "Press banca con barra" → "press-banca-con-barra". Es la clave del ejercicio en historial y biblioteca. */
export function slugify(name: string): string {
  return stripDiacritics((name || '').trim().toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Clave de `gymUsers.exercisePrefs` (formato de la app anterior). */
export function prefKey(name: string): string {
  return slugify(name).replace(/-/g, '_')
}

/** Fecha local AAAA-MM-DD (no UTC: con toISOString el día cambiaba a las 21 h en Argentina). */
export function localDateKey(ts = Date.now()): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
