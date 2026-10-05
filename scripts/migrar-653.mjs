// Copia los datos del 653 (gymUsers, gymPlans, gymSessions, gymExerciseLibrary) a la estructura nueva
// (g653Config, g653Logins, g653Students + days/logs, g653Exercises). No borra ni cambia nada de lo viejo.
// Se puede correr de nuevo: pisa lo copiado con los datos actuales (para el pase final a producción).
//
// Uso:  node scripts/migrar-653.mjs           → muestra qué haría (no escribe)
//       node scripts/migrar-653.mjs --escribir
// Necesita la sesión de la CLI de Firebase (`firebase login`) con acceso al proyecto.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const PROJECT = 'somaapp-7166a'
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const DOMINIO = '653gym.app'
const ESCRIBIR = process.argv.includes('--escribir')

async function token() {
  const c = JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'))
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: c.tokens.refresh_token,
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      grant_type: 'refresh_token',
    }),
  })
  return (await r.json()).access_token
}
const TOKEN = await token()
const H = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }

/* ───── Formato de Firestore REST ↔ JS ───── */

function decode(v) {
  if (v === undefined) return undefined
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decode)
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, decode(x)]))
  return null
}
function encode(x) {
  if (x === null || x === undefined) return { nullValue: null }
  if (typeof x === 'boolean') return { booleanValue: x }
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }
  if (typeof x === 'string') return { stringValue: x }
  if (Array.isArray(x)) return { arrayValue: { values: x.map(encode) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encode(v)])) } }
}

async function list(path) {
  const out = []
  let page = ''
  do {
    const r = await fetch(`${BASE}/${path}?pageSize=300${page ? `&pageToken=${page}` : ''}`, { headers: H })
    const j = await r.json()
    if (!r.ok) throw new Error(`${path}: ${JSON.stringify(j)}`)
    for (const d of j.documents ?? []) out.push({ id: d.name.split('/').pop(), data: decode({ mapValue: { fields: d.fields ?? {} } }) })
    page = j.nextPageToken ?? ''
  } while (page)
  return out
}

/* ───── Conversiones (mismas reglas que la app anterior) ───── */

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const normalizeUsername = (s) => strip((s ?? '').trim().toLowerCase()).replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')
const slugify = (s) => strip((s ?? '').trim().toLowerCase()).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const localDateKey = (ts) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const vacio = { ejercicio_id: null, series: null, reps: null, peso_kg: null, descanso_s: null, minutos: null, rondas: null, pasos: null, subtitulo: null, indicacion: null }

/** Día de la app anterior (grupos core/fuerza) → bloques, con bici al principio y al final (5 min por defecto). */
function legacyBloques(d) {
  const ex = [...(d.groups?.core ?? []), ...(d.groups?.fuerza ?? [])]
  if (ex.length === 0) return []
  const warm = d.warmupMinutes ?? 5
  const cool = d.cooldownMinutes ?? 5
  const out = []
  if (warm > 0) out.push({ ...vacio, id: `${d.id}-warmup`, orden: 0, tipo: 'tiempo', nombre: 'Bici fija', minutos: warm, subtitulo: 'Calentamiento', indicacion: 'Ritmo suave · 70–80 rpm' })
  for (const e of ex) {
    out.push({ ...vacio, id: e.id, orden: out.length, tipo: 'fuerza', ejercicio_id: slugify(e.name), nombre: e.name, series: e.sets, reps: e.reps, descanso_s: e.restSeconds })
  }
  if (cool > 0) out.push({ ...vacio, id: `${d.id}-cooldown`, orden: out.length, tipo: 'tiempo', nombre: 'Bici y elongación', minutos: cool, subtitulo: 'Final', indicacion: 'Pedaleo suave y elongá al terminar' })
  return out
}

function letraOf(d, i) {
  if (d.letra) return d.letra
  const m = /^d[ií]a\s+(\S+)$/i.exec((d.label ?? '').trim())
  return m ? m[1].toUpperCase() : String(i + 1)
}

/** Día de entrenamiento de la app original (`logs/{AAAA-MM-DD}`) → entreno en formato nuevo. */
function fromLegacy(docId, s) {
  const id = `legacy-${docId}`
  const lifts = (s.exercises ?? []).filter((e) => e.kind !== 'timed' && e.sets?.length)
  const series = lifts.flatMap((e) =>
    e.sets.map((st, i) => ({
      id: `${id}-${e.exerciseId}-${i + 1}`,
      bloqueId: e.exerciseId,
      exerciseId: slugify(e.name),
      ejercicio: e.name,
      serieN: i + 1,
      targetReps: e.reps ?? 0,
      reps: st.reps ?? e.reps ?? 0,
      pesoKg: st.weight ?? 0,
      esfuerzo: null,
      hechaAt: st.completedAt ?? s.startedAt ?? 0,
    })),
  )
  if (series.length === 0) return null
  const times = series.map((r) => r.hechaAt).filter(Boolean)
  const all = s.exercises ?? []
  const hechos = all.filter((e) => (e.sets?.length ?? 0) >= e.targetSets).length
  const start = s.startedAt ?? Math.min(...times)
  return {
    id,
    v: 2,
    date: s.date ?? localDateKey(start),
    dayId: s.dayId ?? '',
    dayLetter: '',
    dayName: 'Entreno',
    empezadoAt: start,
    terminadoAt: Math.max(start, ...times),
    estado: hechos === all.length ? 'completo' : 'parcial',
    sensacion: null,
    kilosTotal: Math.round(series.reduce((k, r) => k + r.pesoKg * r.reps, 0)),
    bloquesHechos: hechos,
    bloquesTotal: all.length,
    series,
  }
}

/** Entreno ya guardado por la app nueva del 653: se queda con los campos que usa la versión de AM. */
function fromV2(d) {
  const keep = ['id', 'v', 'date', 'dayId', 'dayLetter', 'dayName', 'empezadoAt', 'terminadoAt', 'estado', 'sensacion', 'kilosTotal', 'bloquesHechos', 'bloquesTotal', 'series']
  return Object.fromEntries(keep.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]))
}

/* ───── Armado ───── */

const writes = []
const set = (path, data) => writes.push({ update: { name: `projects/${PROJECT}/databases/(default)/documents/${path}`, fields: encode(data).mapValue.fields } })
const resumen = []

const usuarios = await list('gymUsers')
const admin = usuarios.find((u) => u.data.role === 'admin')
if (!admin) throw new Error('No encontré la cuenta del profe (role: admin).')
set('g653Config/profe', { uid: admin.id, nombre: admin.data.firstName || 'Profe', apellido: admin.data.lastName || '', username: 'admin', createdAt: admin.data.createdAt ?? Date.now() })
set('g653Logins/admin', { email: `admin@${DOMINIO}`, rol: 'profe' })
resumen.push(`profe: ${admin.data.firstName ?? ''} ${admin.data.lastName ?? ''} → usuario "admin"`)

const tomados = new Set(['admin'])
for (const u of usuarios.filter((x) => x.data.role === 'client')) {
  const d = u.data
  const username = normalizeUsername(d.username || `${d.firstName ?? ''} ${d.lastName ?? ''}`)
  if (!username || tomados.has(username)) {
    resumen.push(`⚠ ${d.firstName} ${d.lastName}: usuario vacío o repetido ("${username}"), se saltea`)
    continue
  }
  tomados.add(username)
  const email = `${username}@${DOMINIO}`

  const dias = (await list(`gymPlans/${u.id}/days`))
    .map((x) => ({ ...x.data, id: x.id }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const dayDocs = []
  dias.forEach((day, i) => {
    const bloques = (Array.isArray(day.bloques) ? day.bloques : legacyBloques(day)).map((b, orden) => ({ ...b, orden }))
    // Los días vacíos también pasan: el plan queda igual que estaba (el profe los completa desde el panel).
    dayDocs.push({ id: day.id, letra: letraOf(day, i), order: dayDocs.length + 1, updatedAt: day.updatedAt ?? Date.now(), bloques })
  })

  const logs = []
  for (const l of await list(`gymSessions/${u.id}/logs`)) {
    const e = l.data.v === 2 ? fromV2(l.data) : fromLegacy(l.id, l.data)
    if (e) logs.push(e)
  }

  const vence = /^\d{4}-\d{2}-(\d{2})$/.exec(d.feeDueDate ?? '')
  set(`g653Students/${u.id}`, {
    nombre: d.firstName ?? '',
    apellido: d.lastName ?? '',
    username,
    uid: u.id,
    email,
    telefono: d.phone ?? '',
    objetivo: '',
    dni: d.dni ?? '',
    createdAt: d.createdAt ?? Date.now(),
    rutina: dayDocs.length
      ? { nombre: d.rutina?.nombre || 'Rutina', version: d.rutina?.version ?? 0, publicadaAt: d.rutina?.publicadaAt ?? 0, dias: dayDocs.length }
      : null,
    // Sin monto: así nadie aparece debiendo meses de golpe. El profe carga el monto desde Cuotas.
    cuota: { monto: 0, dia: vence ? Math.min(28, Math.max(1, Number(vence[1]))) : 10 },
    ...(d.exercisePrefs ? { exercisePrefs: d.exercisePrefs } : {}),
  })
  set(`g653Logins/${username}`, { email, sid: u.id, rol: 'estudiante' })
  for (const { id, ...day } of dayDocs) set(`g653Students/${u.id}/days/${id}`, day)
  for (const e of logs) set(`g653Students/${u.id}/logs/${e.id}`, e)
  resumen.push(`${d.firstName} ${d.lastName} → "${username}" · ${dayDocs.length} días · ${logs.length} entrenos`)
}

const lib = await list('gymExerciseLibrary')
for (const e of lib) if (e.data.name) set(`g653Exercises/${e.id}`, { nombre: e.data.name, updatedAt: e.data.updatedAt ?? Date.now() })
resumen.push(`biblioteca: ${lib.length} ejercicios`)

console.log(resumen.join('\n'))
console.log(`\n${writes.length} documentos para escribir${ESCRIBIR ? '' : ' (modo prueba: no se escribió nada; agregá --escribir)'}`)

if (ESCRIBIR) {
  for (let i = 0; i < writes.length; i += 400) {
    const r = await fetch(`${BASE}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) })
    if (!r.ok) throw new Error(JSON.stringify(await r.json()))
  }
  console.log('Listo: copiado.')
}
