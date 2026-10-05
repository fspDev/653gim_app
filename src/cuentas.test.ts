import { describe, expect, it } from 'vitest'
import { emailFor, generarClave, nextFreeUsername, normalizeUsername, problemaClave, usernameFrom } from './cuentas'

describe('usuarios', () => {
  it('arma nombre.apellido sin acentos ni mayúsculas', () => {
    expect(usernameFrom('Juan', 'Pérez')).toBe('juan.perez')
    expect(usernameFrom(' María José ', 'Gómez  Paz')).toBe('maria.jose.gomez.paz')
    expect(usernameFrom('Ñandú', 'Muñoz')).toBe('nandu.munoz')
  })

  it('acepta lo que la persona escriba al entrar', () => {
    expect(normalizeUsername('Juan Pérez')).toBe('juan.perez')
    expect(normalizeUsername('JUAN.PEREZ ')).toBe('juan.perez')
    expect(normalizeUsername('juan..perez')).toBe('juan.perez')
  })

  it('busca el siguiente libre si se repite', () => {
    const taken = new Set(['juan.perez', 'juan.perez2'])
    expect(nextFreeUsername('juan.perez', (u) => taken.has(u))).toBe('juan.perez3')
    expect(nextFreeUsername('ana.gil', (u) => taken.has(u))).toBe('ana.gil')
  })

  it('cuenta interna por número de reseteo', () => {
    expect(emailFor('juan.perez')).toBe('juan.perez@653gym.app')
    expect(emailFor('juan.perez', 3)).toBe('juan.perez+3@653gym.app')
  })
})

describe('contraseñas', () => {
  it('genera palabra-número', () => {
    expect(generarClave(() => 0)).toBe('fuerza-1000')
    expect(generarClave()).toMatch(/^[a-z]+-\d{4}$/)
  })

  it('valida largo y espacios', () => {
    expect(problemaClave('abc')).not.toBeNull()
    expect(problemaClave('con espacio')).not.toBeNull()
    expect(problemaClave('remo-4827')).toBeNull()
  })
})
