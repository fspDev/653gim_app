import { describe, expect, it } from 'vitest'
import type { EntrenoRow, SerieRow } from '../db'
import { fromLegacy, toRemote } from '../syncFormat'
import { legacyBloques, rutinaFromFirestore } from './firestoreRutina'
import { mapRutina, shortName, type RutinaRow } from './mapRutina'

const bloque = (o: Partial<RutinaRow['dias'][number]['bloques'][number]> & { id: string; orden: number; tipo: 'fuerza' | 'tiempo' | 'circuito'; nombre: string }) => ({
  ejercicio_id: null,
  series: null,
  reps: null,
  peso_kg: null,
  descanso_s: null,
  minutos: null,
  rondas: null,
  pasos: null,
  ...o,
})

const row: RutinaRow = {
  id: 'r1',
  nombre: 'Plan 3 días',
  dias_por_semana: 3,
  version: 4,
  publicada_at: '2026-09-30T10:00:00Z',
  dias: [
    { id: 'd2', letra: 'B', orden: 2, bloques: [] },
    {
      id: 'd1',
      letra: 'A',
      orden: 1,
      bloques: [
        bloque({ id: 'b2', orden: 2, tipo: 'fuerza', nombre: 'Press banca', ejercicio_id: 'ej-press', series: 4, reps: 8, peso_kg: 35, descanso_s: 120 }),
        bloque({ id: 'b1', orden: 1, tipo: 'tiempo', nombre: 'Bici fija', minutos: 8 }),
        bloque({ id: 'b3', orden: 3, tipo: 'circuito', nombre: 'Core', rondas: 3, pasos: [{ nombre: 'Plancha', segundos: 45 }, { nombre: 'Dead bug', reps: 12 }] }),
      ],
    },
  ],
}

describe('mapRutina', () => {
  const r = mapRutina(row)

  it('ordena días y bloques, y descarta los días vacíos', () => {
    expect(r.days.map((d) => d.letter)).toEqual(['A'])
    expect(r.days[0].blocks.map((b) => b.id)).toEqual(['b1', 'b2', 'b3'])
    expect(r).toMatchObject({ version: 4, diasPorSemana: 3 })
  })

  it('el bloque de fuerza conserva ejercicio, peso y descanso del profe', () => {
    expect(r.days[0].blocks[1]).toMatchObject({ kind: 'fuerza', exerciseId: 'ej-press', series: 4, reps: 8, weight: 35, restSeconds: 120, short: 'PRESS BANCA', minutes: 11 })
  })

  it('el circuito arma pasos por tiempo o por reps', () => {
    expect(r.days[0].blocks[2]).toMatchObject({ kind: 'circuito', rounds: 3, steps: [{ name: 'Plancha', seconds: 45 }, { name: 'Dead bug', reps: 12 }] })
  })

  it('sin descanso cargado queda indefinido para que valga el del Perfil', () => {
    const b = mapRutina({ ...row, dias: [{ id: 'd', letra: 'A', orden: 1, bloques: [bloque({ id: 'x', orden: 1, tipo: 'fuerza', nombre: 'Remo con mancuerna', series: 3, reps: 10 })] }] }).days[0].blocks[0]
    expect(b).toMatchObject({ restSeconds: undefined, weight: 0, exerciseId: 'remo-con-mancuerna', short: 'REMO CON' })
  })
})

describe('shortName', () => {
  it('junta palabras cortas con la siguiente', () => {
    expect(shortName('Sentadilla con barra')).toBe('SENTADILLA')
    expect(shortName('Peso muerto rumano')).toBe('PESO MUERTO')
    expect(shortName('Dominadas')).toBe('DOMINADAS')
  })
})

describe('Firestore: días de la app anterior', () => {
  const day = {
    id: 'day1',
    label: 'Día 1',
    order: 1,
    groups: {
      core: [{ id: 'e1', name: 'Plancha con peso', sets: 3, reps: 12, restSeconds: 45 }],
      fuerza: [{ id: 'e2', name: 'Press Banca', sets: 4, reps: 8, restSeconds: 90 }],
    },
  }

  it('suma bici al principio y al final (5 min por defecto) y usa el nombre como clave del ejercicio', () => {
    const b = legacyBloques(day)
    expect(b.map((x) => x.tipo)).toEqual(['tiempo', 'fuerza', 'fuerza', 'tiempo'])
    expect(b[0]).toMatchObject({ id: 'day1-warmup', minutos: 5, subtitulo: 'Calentamiento' })
    expect(b[2]).toMatchObject({ id: 'e2', ejercicio_id: 'press-banca', series: 4, reps: 8, descanso_s: 90 })
  })

  it('con 0 minutos no hay bloque de bici', () => {
    expect(legacyBloques({ ...day, warmupMinutes: 0, cooldownMinutes: 0 }).every((x) => x.tipo === 'fuerza')).toBe(true)
  })

  it('el último peso y descanso del socio pisan lo del profe; "Día 1" queda como letra "1"', () => {
    const r = mapRutina(rutinaFromFirestore([day], undefined, { press_banca: { weight: 42.5, restSeconds: 120 } }))
    const press = r.days[0].blocks.find((x) => x.id === 'e2')
    expect(press).toMatchObject({ kind: 'fuerza', weight: 42.5, restSeconds: 120, exerciseId: 'press-banca' })
    expect(r.days[0].letter).toBe('1')
  })

  it('un día del panel nuevo usa sus bloques tal cual', () => {
    const r = rutinaFromFirestore([{ id: 'd', letra: 'B', order: 1, bloques: [bloque({ id: 'x', orden: 0, tipo: 'tiempo', nombre: 'Remo', minutos: 6 })] }], { nombre: 'Fuerza', version: 3 }, undefined)
    expect(r).toMatchObject({ nombre: 'Fuerza', version: 3, dias: [{ letra: 'B', bloques: [{ id: 'x', minutos: 6 }] }] })
  })
})

describe('sync: formato de Firestore', () => {
  const entreno: EntrenoRow = { id: 'w1', dayId: 'day1', dayLetter: '1', dayName: 'Día 1', empezadoAt: new Date(2026, 8, 30, 22, 30).getTime(), terminadoAt: new Date(2026, 8, 30, 23, 30).getTime(), estado: 'parcial', sensacion: 3, kilosTotal: 600, bloquesHechos: 2, bloquesTotal: 4, synced: 0 }
  const serie = (n: number): SerieRow => ({ id: `s${n}`, entrenoId: 'w1', bloqueId: 'e2', exerciseId: 'press-banca', ejercicio: 'Press Banca', serieN: n, targetReps: 8, reps: 8, pesoKg: 40, esfuerzo: null, hechaAt: entreno.empezadoAt + n * 60_000 })

  it('usa la fecha local (no UTC) y deja el formato de la app anterior para su panel', () => {
    const r = toRemote(entreno, [serie(1), serie(2)])
    expect(r.date).toBe('2026-09-30')
    expect(r).not.toHaveProperty('synced')
    expect(r.exercises).toEqual([{ exerciseId: 'e2', name: 'Press Banca', group: 'fuerza', targetSets: 2, reps: 8, sets: [{ weight: 40, reps: 8, completedAt: serie(1).hechaAt }, { weight: 40, reps: 8, completedAt: serie(2).hechaAt }] }])
  })

  it('convierte un día de la app anterior en historial; los días sin series no cuentan', () => {
    const legacy = { date: '2026-09-20', dayId: 'day1', startedAt: 1000, exercises: [{ exerciseId: 'e2', name: 'Press Banca', targetSets: 2, reps: 8, sets: [{ weight: 40, reps: 8, completedAt: 2000 }, { weight: 42.5, reps: 8, completedAt: 3000 }] }, { exerciseId: 'warmup', kind: 'timed', name: 'Calentamiento', targetSets: 1, reps: 0, sets: [{ completedAt: 1500 }] }] }
    const r = fromLegacy('2026-09-20', legacy)!
    expect(r.entreno).toMatchObject({ id: 'legacy-2026-09-20', estado: 'completo', kilosTotal: 660, synced: 1 })
    expect(r.series.map((s) => [s.exerciseId, s.pesoKg])).toEqual([['press-banca', 40], ['press-banca', 42.5]])
    expect(fromLegacy('x', { exercises: [{ exerciseId: 'e', name: 'E', targetSets: 3, reps: 8, sets: [] }] })).toBeNull()
  })
})
