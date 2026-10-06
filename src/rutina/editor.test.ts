import { describe, expect, it } from 'vitest'
import { addBloque, addDia, fromRow, minutesOf, moveBloque, newBloque, nextLetter, parseKg, parseRest, patchBloque, removeBloque, removeDia, removedIds, rpeFor, toRows, totalMinutes, type ERutina } from './editor'
import { mapBloque } from './mapRutina'


describe('editor de rutina', () => {
  const base = (): ERutina => ({ id: 'r', nombre: 'Rutina', dias: [{ id: 'd1', letra: 'A', bloques: [] }] })

  it('días: letra siguiente libre y no se puede borrar el último', () => {
    let r = addDia(addDia(base()))
    expect(r.dias.map((d) => d.letra)).toEqual(['A', 'B', 'C'])
    r = removeDia(r, r.dias[1].id)
    expect(nextLetter(r.dias)).toBe('B')
    expect(removeDia(base(), 'd1').dias).toHaveLength(1)
  })

  it('agregar, editar, mover y quitar bloques', () => {
    const a = newBloque('fuerza', { id: 'a', nombre: 'Sentadilla' })
    const b = newBloque('tiempo', { id: 'b', nombre: 'Bici', minutos: 8 })
    const c = newBloque('fuerza', { id: 'c', nombre: 'Press' })
    let r = [a, b, c].reduce((acc, x) => addBloque(acc, 'd1', x), base())
    r = moveBloque(r, 'd1', 2, 0)
    expect(r.dias[0].bloques.map((x) => x.id)).toEqual(['c', 'a', 'b'])
    // mover fuera de rango no cambia nada
    expect(moveBloque(r, 'd1', 0, 9).dias[0].bloques.map((x) => x.id)).toEqual(['c', 'a', 'b'])
    r = patchBloque(r, 'd1', 'a', { pesoKg: 42.5, series: 4 })
    expect(r.dias[0].bloques[1]).toMatchObject({ pesoKg: 42.5, series: 4 })
    r = removeBloque(r, 'd1', 'b')
    expect(r.dias[0].bloques.map((x) => x.id)).toEqual(['c', 'a'])
  })

  it('interpreta descanso y peso como los escribe un profe', () => {
    expect([parseRest('1:30'), parseRest('90'), parseRest('0:45'), parseRest(''), parseRest('1:99')]).toEqual([90, 90, 45, null, null])
    expect([parseKg('42,5'), parseKg('42.5'), parseKg('20'), parseKg('x'), parseKg('')]).toEqual([42.5, 42.5, 20, null, null])
  })

  it('minutos por bloque y por día', () => {
    expect(minutesOf(newBloque('fuerza', { series: 4, descansoS: 90 }))).toBe(9)
    expect(minutesOf(newBloque('tiempo', { minutos: 8 }))).toBe(8)
    const r = addBloque(addBloque(base(), 'd1', newBloque('tiempo', { minutos: 8 })), 'd1', newBloque('tiempo', { minutos: 5 }))
    expect(totalMinutes(r.dias[0])).toBe(13)
  })

  it('filas para guardar: orden por posición y columnas según el tipo', () => {
    const r = addBloque(
      addBloque(base(), 'd1', newBloque('tiempo', { id: 'b1', nombre: 'Bici', minutos: 8 })),
      'd1',
      newBloque('fuerza', { id: 'b2', nombre: 'Sentadilla', ejercicioId: 'ej1', series: 4, reps: 8, pesoKg: 42.5, descansoS: 90 }),
    )
    const { dias, bloques } = toRows(r)
    expect(dias).toEqual([{ id: 'd1', rutina_id: 'r', letra: 'A', orden: 1 }])
    expect(bloques[0]).toMatchObject({ id: 'b1', orden: 1, tipo: 'tiempo', minutos: 8, series: null, peso_kg: null })
    expect(bloques[1]).toMatchObject({ id: 'b2', orden: 2, tipo: 'fuerza', ejercicio_id: 'ej1', series: 4, reps: 8, peso_kg: 42.5, descanso_s: 90, minutos: null })
  })

  it('qué hay que borrar del servidor al publicar', () => {
    const saved: ERutina = {
      id: 'r',
      nombre: 'R',
      dias: [
        { id: 'd1', letra: 'A', bloques: [newBloque('fuerza', { id: 'x' }), newBloque('fuerza', { id: 'y' })] },
        { id: 'd2', letra: 'B', bloques: [newBloque('fuerza', { id: 'z' })] },
      ],
    }
    const current: ERutina = { ...saved, dias: [{ ...saved.dias[0], bloques: [saved.dias[0].bloques[0]] }] }
    expect(removedIds(saved, current)).toEqual({ dias: ['d2'], bloques: ['y'] })
    expect(removedIds(null, current)).toEqual({ dias: [], bloques: [] })
  })

  it('ida y vuelta: lo que se guarda vuelve igual', () => {
    const r = addBloque(base(), 'd1', newBloque('circuito', { id: 'c1', nombre: 'Core', rondas: 3, pasos: [{ nombre: 'Plancha', segundos: 45 }, { nombre: 'Dead bug', reps: 12 }] }))
    const { dias, bloques } = toRows(r)
    const back = fromRow({ id: 'r', nombre: 'Rutina', dias: dias.map((d) => ({ id: d.id, letra: d.letra, orden: d.orden, bloques: bloques.filter((b) => b.dia_id === d.id) })) })
    expect(back.dias[0].bloques[0]).toMatchObject({ tipo: 'circuito', rondas: 3, pasos: [{ nombre: 'Plancha', segundos: 45 }, { nombre: 'Dead bug', reps: 12 }] })
  })
})

describe('RPE por serie', () => {
  it('se ajusta a la cantidad de series y es null si no hay ninguno', () => {
    expect(rpeFor({ series: 3, rpe: [7, null, 9, 10] })).toEqual([7, null, 9])
    expect(rpeFor({ series: 3, rpe: [8] })).toEqual([8, null, null])
    expect(rpeFor({ series: 3, rpe: [null, null] })).toBeNull()
    expect(rpeFor({ series: 2 })).toBeNull()
  })

  it('ida y vuelta por las filas y llega al bloque de la app', () => {
    const r: ERutina = { id: 'r', nombre: 'Plan', dias: [{ id: 'd', letra: 'A', bloques: [newBloque('fuerza', { id: 'b', nombre: 'Sentadilla', series: 3, rpe: [7, 8, 9] })] }] }
    const { dias, bloques } = toRows(r)
    expect(bloques[0].rpe).toEqual([7, 8, 9])
    const back = fromRow({ id: 'r', nombre: 'Plan', dias: dias.map((d) => ({ ...d, bloques: bloques.map(({ dia_id: _d, ...b }) => b) })) })
    expect(back.dias[0].bloques[0].rpe).toEqual([7, 8, 9])
    const block = mapBloque(bloques[0])
    expect(block.kind === 'fuerza' && block.rpe).toEqual([7, 8, 9])
  })
})
