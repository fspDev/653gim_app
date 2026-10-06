import { describe, expect, it } from 'vitest'
import { estadoCuota, estadoLabel, estadoManual, mesesCorrespondientes, periodoLabel } from './cuotas'

const at = (iso: string) => new Date(`${iso}T12:00:00`).getTime()
const cfg = { monto: 30000, dia: 10 }

describe('cuotas', () => {
  it('meses desde el alta', () => {
    expect(mesesCorrespondientes(at('2026-08-20'), at('2026-10-04'))).toEqual(['2026-08', '2026-09', '2026-10'])
  })

  it('sin monto no hay cuota', () => {
    expect(estadoCuota({ monto: 0, dia: 10 }, [], at('2026-01-01'), at('2026-10-04')).tipo).toBe('sin-cuota')
  })

  it('el mes actual sin pagar y antes del vencimiento: por vencer', () => {
    const e = estadoCuota(cfg, [{ periodo: '2026-09' }], at('2026-09-01'), at('2026-10-04'))
    expect(e).toEqual({ tipo: 'por-vencer', vence: '2026-10-10', dias: 6 })
    expect(estadoLabel(e)).toBe('Vence el 10/10')
  })

  it('pasado el día de vencimiento: vencida', () => {
    const e = estadoCuota(cfg, [{ periodo: '2026-09' }], at('2026-09-01'), at('2026-10-11'))
    expect(e).toEqual({ tipo: 'vencida', meses: ['2026-10'] })
    expect(estadoLabel(e)).toBe('Debe octubre')
  })

  it('meses viejos sin pagar cuentan aunque el actual no venció', () => {
    const e = estadoCuota(cfg, [], at('2026-08-15'), at('2026-10-04'))
    expect(e).toEqual({ tipo: 'vencida', meses: ['2026-08', '2026-09'] })
    expect(estadoLabel(e)).toBe('Debe 2 cuotas')
  })

  it('al día: el próximo vencimiento salta los meses adelantados', () => {
    const pagos = [{ periodo: '2026-10' }, { periodo: '2026-11' }]
    expect(estadoCuota(cfg, pagos, at('2026-10-01'), at('2026-10-04'))).toEqual({ tipo: 'al-dia', proximo: '2026-12-10' })
  })

  it('nombre del mes', () => {
    expect(periodoLabel('2026-10')).toBe('octubre 2026')
  })
})

describe('cuota marcada a mano (sin monto)', () => {
  const sinMonto = { monto: 0, dia: 10 }
  const hoy = at('2026-10-06')

  it('al día con fecha lejana: al día hasta esa fecha', () => {
    const e = estadoCuota(sinMonto, [], at('2026-01-01'), hoy, { alDia: true, vence: '2026-11-05' })
    expect(e).toEqual({ tipo: 'al-dia', proximo: '2026-11-05' })
    expect(estadoLabel(e)).toBe('Al día · próxima 5/11')
  })

  it('a pocos días de la fecha: por vencer', () => {
    expect(estadoManual({ alDia: true, vence: '2026-10-09' }, hoy)).toEqual({ tipo: 'por-vencer', vence: '2026-10-09', dias: 3 })
  })

  it('pasada la fecha, o marcada como no pagada: vencida', () => {
    expect(estadoLabel(estadoManual({ alDia: true, vence: '2026-10-05' }, hoy))).toBe('Cuota vencida')
    expect(estadoManual({ alDia: false, vence: '2026-12-01' }, hoy).tipo).toBe('vencida')
  })

  it('al día sin fecha', () => {
    expect(estadoLabel(estadoManual({ alDia: true, vence: null }, hoy))).toBe('Al día')
  })

  it('con monto cargado mandan los pagos, aunque esté marcada a mano', () => {
    const e = estadoCuota(cfg, [{ periodo: '2026-10' }], at('2026-10-01'), hoy, { alDia: false, vence: null })
    expect(e.tipo).toBe('al-dia')
  })
})
