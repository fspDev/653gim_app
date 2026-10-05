import { describe, expect, it } from 'vitest'
import { addBloque, fromRow, newBloque } from './editor'
import { rutinaFromDocs, toDayDocs } from './firestoreRutina'
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

describe('plan guardado en Firestore', () => {
  const plan = addBloque(
    { id: 'r', nombre: 'Fuerza', dias: [{ id: 'd1', letra: 'A', bloques: [] }] },
    'd1',
    newBloque('fuerza', { id: 'b1', nombre: 'Sentadilla con barra', series: 4, reps: 8, pesoKg: 40, comentario: '  Bajá lento ', videoUrl: 'https://youtu.be/abc' }),
  )
  const docs = toDayDocs(plan, 1000)

  it('guarda un documento por día con sus bloques, comentario y video', () => {
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ id: 'd1', letra: 'A', order: 1, updatedAt: 1000 })
    expect(docs[0].bloques?.[0]).toMatchObject({ nombre: 'Sentadilla con barra', comentario: 'Bajá lento', video_url: 'https://youtu.be/abc' })
  })

  it('el estudiante ve la indicación y el video del profe', () => {
    const b = mapRutina(rutinaFromDocs(docs, { nombre: 'Fuerza', publicadaAt: 2000 })).days[0].blocks[0]
    expect(b).toMatchObject({ note: 'Bajá lento', video: 'https://youtu.be/abc', weight: 40 })
  })

  it('el último peso del estudiante pisa el del plan, salvo que el profe publique después', () => {
    const prefs = { sentadilla_con_barra: { weight: 45, updatedAt: 3000 } }
    expect(rutinaFromDocs(docs, { publicadaAt: 2000 }, prefs).dias[0].bloques[0].peso_kg).toBe(45)
    expect(rutinaFromDocs(docs, { publicadaAt: 4000 }, prefs).dias[0].bloques[0].peso_kg).toBe(40)
  })

  it('ida y vuelta al editor del panel', () => {
    const back = fromRow(rutinaFromDocs(docs, { nombre: 'Fuerza' }))
    expect(back.dias[0].bloques[0]).toMatchObject({ comentario: 'Bajá lento', videoUrl: 'https://youtu.be/abc', pesoKg: 40 })
  })

  it('un día sin bloques no se puede entrenar', () => {
    expect(mapRutina(rutinaFromDocs([{ id: 'x', letra: 'B', order: 1, bloques: [] }], null)).days).toEqual([])
  })
})
