/**
 * Cuotas mensuales: cada estudiante tiene un monto y un día de vencimiento; cada pago cubre un mes ("2026-10").
 * Se deben los meses desde el del alta hasta el actual (el actual, recién pasado el día de vencimiento).
 */

export interface CuotaConfig {
  /** Monto mensual en pesos (0 = sin cuota, p. ej. becado). */
  monto: number
  /** Día del mes en que vence (1–28). */
  dia: number
}

export type Medio = 'efectivo' | 'transferencia' | 'otro'

export interface Pago {
  id: string
  /** Mes que cubre: "AAAA-MM". */
  periodo: string
  monto: number
  /** Cuándo pagó: "AAAA-MM-DD". */
  fecha: string
  medio: Medio
  nota: string
  createdAt: number
}

export type EstadoCuota =
  | { tipo: 'sin-cuota' }
  | { tipo: 'al-dia'; proximo: string }
  | { tipo: 'por-vencer'; vence: string; dias: number }
  | { tipo: 'vencida'; meses: string[] }

export const DEFAULT_CUOTA: CuotaConfig = { monto: 0, dia: 10 }

export const periodoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export function addMonths(periodo: string, n: number): string {
  const [y, m] = periodo.split('-').map(Number)
  return periodoOf(new Date(y, m - 1 + n, 1))
}

/** "2026-10" → "octubre 2026" (o solo "octubre" con `sinAnio`). */
export function periodoLabel(periodo: string, sinAnio = false): string {
  const [y, m] = periodo.split('-').map(Number)
  const mes = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long' })
  return sinAnio ? mes : `${mes} ${y}`
}

const fechaVto = (periodo: string, dia: number) => `${periodo}-${String(dia).padStart(2, '0')}`

/** Meses que corresponde pagar hasta hoy (incluido el actual aunque no haya vencido), del más viejo al más nuevo. */
export function mesesCorrespondientes(altaAt: number, now: number): string[] {
  const out: string[] = []
  const last = periodoOf(new Date(now))
  for (let p = periodoOf(new Date(altaAt)); p <= last; p = addMonths(p, 1)) out.push(p)
  return out
}

/**
 * Cuota marcada a mano, como en la app anterior del 653: el profe dice si está al día y hasta cuándo.
 * Se usa cuando el socio no tiene monto cargado (si lo tiene, mandan los pagos).
 */
export interface CuotaManual {
  alDia: boolean
  /** Hasta cuándo está pagada: "AAAA-MM-DD"; null = sin fecha. */
  vence: string | null
}

/** Días de anticipación con que una cuota manual pasa a "por vencer". */
export const AVISO_DIAS = 5

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function estadoManual(m: CuotaManual, now: number): EstadoCuota {
  if (!m.alDia) return { tipo: 'vencida', meses: [] }
  if (!m.vence) return { tipo: 'al-dia', proximo: '' }
  const hoy = isoDate(new Date(now))
  if (m.vence < hoy) return { tipo: 'vencida', meses: [] }
  const [y, mo, d] = m.vence.split('-').map(Number)
  const t = new Date(now)
  const dias = Math.round((new Date(y, mo - 1, d).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 86_400_000)
  if (dias <= AVISO_DIAS) return { tipo: 'por-vencer', vence: m.vence, dias }
  return { tipo: 'al-dia', proximo: m.vence }
}

export function estadoCuota(cfg: CuotaConfig | null | undefined, pagos: Pick<Pago, 'periodo'>[], altaAt: number, now: number, manual?: CuotaManual | null): EstadoCuota {
  if (!cfg || !cfg.monto) return manual ? estadoManual(manual, now) : { tipo: 'sin-cuota' }
  const pagados = new Set(pagos.map((p) => p.periodo))
  const hoy = new Date(now)
  const actual = periodoOf(hoy)
  const debe = mesesCorrespondientes(altaAt, now).filter((p) => !pagados.has(p))
  const vencidos = debe.filter((p) => p < actual || hoy.getDate() > cfg.dia)
  if (vencidos.length) return { tipo: 'vencida', meses: vencidos }
  if (debe.includes(actual)) return { tipo: 'por-vencer', vence: fechaVto(actual, cfg.dia), dias: cfg.dia - hoy.getDate() }
  // Pagó el actual (y quizás adelantó): el próximo vencimiento es el del primer mes sin pagar.
  let p = addMonths(actual, 1)
  while (pagados.has(p)) p = addMonths(p, 1)
  return { tipo: 'al-dia', proximo: fechaVto(p, cfg.dia) }
}

/** "2026-11-10" → "10/11". */
export const fechaCorta = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`

export function estadoLabel(e: EstadoCuota): string {
  switch (e.tipo) {
    case 'sin-cuota':
      return 'Sin cuota'
    case 'al-dia':
      return e.proximo ? `Al día · próxima ${fechaCorta(e.proximo)}` : 'Al día'
    case 'por-vencer':
      return e.dias === 0 ? 'Vence hoy' : `Vence el ${fechaCorta(e.vence)}`
    case 'vencida':
      // Sin meses: cuota marcada a mano como no pagada.
      if (e.meses.length === 0) return 'Cuota vencida'
      return e.meses.length === 1 ? `Debe ${periodoLabel(e.meses[0], true)}` : `Debe ${e.meses.length} cuotas`
  }
}

export const fmtPesos = (n: number) => `$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
