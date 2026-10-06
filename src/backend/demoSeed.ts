import { emailFor } from '../cuentas'
import { periodoOf, addMonths } from '../cuotas'
import { COL } from '../firebase'
import { localDateKey, slugify } from '../keys'
import { newBloque, type ERutina } from '../rutina/editor'
import { toDayDocs } from '../rutina/firestoreRutina'
import type { Data } from './types'

/**
 * Datos de ejemplo del modo demo. Cuentas (solo existen en este navegador):
 * profe admin / demo1234 · socios juan.perez (30111222), lucia.gomez (31222333) y martin.diaz (40333444):
 * la contraseña de cada socio es su DNI.
 */

const DAY = 24 * 60 * 60 * 1000
export const DEMO_CLAVE = 'demo1234'

function planJuan(): ERutina {
  const f = (nombre: string, series: number, reps: number, pesoKg: number, extra: { comentario?: string } = {}) =>
    newBloque('fuerza', { id: `b-${slugify(nombre)}`, ejercicioId: slugify(nombre), nombre, series, reps, pesoKg, descansoS: 90, ...extra })
  const bici = (subtitulo: 'Calentamiento' | 'Final', minutos: number, id: string) =>
    newBloque('tiempo', { id, nombre: subtitulo === 'Calentamiento' ? 'Bici fija' : 'Bici y elongación', minutos, subtitulo, indicacion: subtitulo === 'Calentamiento' ? 'Ritmo suave · 70–80 rpm' : 'Pedaleo suave y elongá al terminar' })
  return {
    id: 'rutina',
    nombre: 'Fuerza general',
    dias: [
      {
        id: 'dia-a',
        letra: 'A',
        bloques: [
          bici('Calentamiento', 8, 'a-cal'),
          f('Sentadilla con barra', 4, 8, 40, { comentario: 'Bajá en 3 segundos y empujá fuerte. Rodillas hacia afuera.' }),
          f('Press banca', 4, 8, 30, { comentario: 'Escápulas juntas todo el tiempo.' }),
          f('Remo con mancuerna', 3, 10, 16),
          bici('Final', 5, 'a-fin'),
        ],
      },
      {
        id: 'dia-b',
        letra: 'B',
        bloques: [
          bici('Calentamiento', 8, 'b-cal'),
          f('Peso muerto rumano', 3, 10, 40, { comentario: 'Espalda neutra; la barra pegada a las piernas.' }),
          f('Press militar', 3, 10, 20),
          newBloque('circuito', {
            id: 'b-core',
            nombre: 'Core',
            rondas: 3,
            pasos: [
              { nombre: 'Plancha frontal', segundos: 40 },
              { nombre: 'Dead bug', reps: 12 },
            ],
            comentario: 'Sin apuro: la calidad primero.',
          }),
          bici('Final', 5, 'b-fin'),
        ],
      },
    ],
  }
}

/** Entrenos de las últimas semanas, alternando A y B, con el peso subiendo de a poco. */
function logsFor(plan: ERutina, sesiones: number, now: number): Record<string, Data> {
  const out: Record<string, Data> = {}
  for (let i = 0; i < sesiones; i++) {
    const at = now - (sesiones - i) * 2.4 * DAY - 6 * 60 * 60 * 1000
    const day = plan.dias[i % plan.dias.length]
    const id = `demo-log-${i}`
    const series: Data[] = []
    let t = at + 8 * 60 * 1000
    for (const b of day.bloques.filter((x) => x.tipo === 'fuerza')) {
      const peso = b.pesoKg + Math.floor(i / 4) * 2.5
      for (let n = 1; n <= b.series; n++) {
        t += 2.5 * 60 * 1000
        const reps = n === b.series && i % 3 === 0 ? b.reps - 2 : b.reps
        series.push({ id: `${id}-${b.id}-${n}`, bloqueId: b.id, exerciseId: b.ejercicioId ?? slugify(b.nombre), ejercicio: b.nombre, serieN: n, targetReps: b.reps, reps, pesoKg: peso, esfuerzo: n === b.series ? 3 : null, hechaAt: t })
      }
    }
    const kilos = series.reduce((k, s) => k + Number(s.pesoKg) * Number(s.reps), 0)
    out[id] = {
      v: 2,
      id,
      dayId: day.id,
      dayLetter: day.letra,
      dayName: `Día ${day.letra}`,
      empezadoAt: at,
      terminadoAt: t + 6 * 60 * 1000,
      estado: i % 5 === 3 ? 'parcial' : 'completo',
      sensacion: i % 4,
      kilosTotal: kilos,
      bloquesHechos: day.bloques.length - (i % 5 === 3 ? 1 : 0),
      bloquesTotal: day.bloques.length,
      date: localDateKey(at),
      series,
    }
  }
  return out
}

export function demoSeed(now = Date.now()) {
  const docs: Record<string, Data> = {}
  const users: Record<string, { uid: string; password: string }> = {}

  const profeEmail = emailFor('admin')
  users[profeEmail] = { uid: 'demo-profe', password: DEMO_CLAVE }
  docs[`${COL.config}/profe`] = { uid: 'demo-profe', nombre: 'Profe', apellido: '653', username: 'admin', createdAt: now - 120 * DAY }
  docs[`${COL.logins}/admin`] = { email: profeEmail, rol: 'profe' }

  const actual = periodoOf(new Date(now))
  const alumnos = [
    { sid: 'demo-juan', nombre: 'Juan', apellido: 'Pérez', dni: '30111222', profe: 'Nico', monto: 35000, tel: '351 555 0101', objetivo: 'Ganar fuerza y bajar 4 kg', alta: now - 75 * DAY, plan: true, sesiones: 16, pagos: [-3, -2, -1, 0] },
    { sid: 'demo-lucia', nombre: 'Lucía', apellido: 'Gómez', dni: '31222333', profe: 'Nico', monto: 35000, tel: '351 555 0102', objetivo: 'Volver a entrenar después de una lesión de rodilla', alta: now - 50 * DAY, plan: true, sesiones: 5, pagos: [-1] },
    { sid: 'demo-martin', nombre: 'Martín', apellido: 'Díaz', dni: '40333444', profe: '', monto: 0, tel: '', objetivo: '', alta: now - 2 * DAY, plan: false, sesiones: 0, pagos: [] },
  ]

  for (const a of alumnos) {
    const username = slugify(`${a.nombre} ${a.apellido}`).replace(/-/g, '.')
    const email = emailFor(username)
    const uid = `demo-uid-${a.sid}`
    users[email] = { uid, password: a.dni }
    docs[`${COL.logins}/${username}`] = { email, sid: a.sid, rol: 'estudiante' }
    const plan = planJuan()
    docs[`${COL.students}/${a.sid}`] = {
      nombre: a.nombre,
      apellido: a.apellido,
      username,
      uid,
      email,
      telefono: a.tel,
      objetivo: a.objetivo,
      dni: a.dni,
      profe: a.profe,
      createdAt: a.alta,
      ultimoAcceso: a.sesiones ? now - DAY : undefined,
      rutina: a.plan ? { nombre: plan.nombre, version: 1, publicadaAt: a.alta + DAY, dias: plan.dias.length } : null,
      cuota: { monto: a.monto, dia: 10 },
      // Sin monto, la cuota se marca a mano (como en la app anterior del 653).
      cuotaManual: a.monto ? null : { alDia: true, vence: localDateKey(now + 26 * DAY) },
    }
    if (a.plan) for (const d of toDayDocs(plan, a.alta + DAY)) docs[`${COL.students}/${a.sid}/days/${d.id}`] = { ...d, id: undefined }
    for (const [id, log] of Object.entries(logsFor(plan, a.sesiones, now))) docs[`${COL.students}/${a.sid}/logs/${id}`] = log
    for (const m of a.pagos) {
      const periodo = addMonths(actual, m)
      docs[`${COL.students}/${a.sid}/pagos/pago-${periodo}`] = { periodo, monto: 35000, fecha: `${periodo}-05`, medio: m === 0 ? 'transferencia' : 'efectivo', nota: '', createdAt: now }
    }
  }

  // Evolución de Juan: peso y cintura cada tres semanas.
  ;[0, 21, 42, 63].forEach((d, i) => {
    const fecha = localDateKey(now - 70 * DAY + d * DAY)
    docs[`${COL.students}/demo-juan/medidas/m${i}`] = { fecha, pesoKg: 84 - i * 1.2, grasaPct: 24 - i * 0.8, cinturaCm: 96 - i * 1.5, nota: i === 0 ? 'Medición inicial' : '', createdAt: now }
  })
  docs[`${COL.exercises}/sentadilla-con-barra`] = { nombre: 'Sentadilla con barra', grupo: 'Piernas', updatedAt: now }

  return { docs: JSON.parse(JSON.stringify(docs)) as Record<string, Data>, users }
}
