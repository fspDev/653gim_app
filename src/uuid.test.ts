import { afterEach, describe, expect, it, vi } from 'vitest'
import { uuid } from './uuid'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuid', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('da un UUID v4 válido', () => {
    expect(uuid()).toMatch(V4)
  })

  it('funciona sin crypto.randomUUID (http por IP en el celular)', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array<ArrayBuffer>) => real.getRandomValues(a) })
    const ids = new Set(Array.from({ length: 200 }, uuid))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(V4)
  })
})
