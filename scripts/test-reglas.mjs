// Prueba firestore.rules contra la API de prueba de Firebase Rules (no lee ni escribe datos).
// Uso: node scripts/test-reglas.mjs   (necesita la sesión de la CLI de Firebase: `firebase login`)
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const PROJECT = 'somaapp-7166a'
const D = '/databases/(default)/documents'
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')

async function token() {
  const c = JSON.parse(readFileSync(`${homedir()}/.config/configstore/firebase-tools.json`, 'utf8'))
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    // Cliente público de la CLI de Firebase (el mismo que usa firebase-tools).
    body: new URLSearchParams({
      refresh_token: c.tokens.refresh_token,
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      grant_type: 'refresh_token',
    }),
  })
  return (await r.json()).access_token
}

const PROFE = 'uid-profe'
const ALUMNO = 'uid-alumno'
const OTRO = 'uid-otro'
const ficha = { uid: ALUMNO, nombre: 'Juan', cuota: { monto: 1, dia: 10 } }

// get() de las reglas: quién es el profe y de quién es la ficha "s1".
const mocks = (profeExiste = true) => [
  { function: 'get', args: [{ exactValue: `${D}/amConfig/profe` }], result: profeExiste ? { value: { data: { uid: PROFE } } } : { undefined: {} } },
  { function: 'get', args: [{ exactValue: `${D}/amStudents/s1` }], result: { value: { data: ficha } } },
  { function: 'get', args: [{ exactValue: `${D}/g653Config/profe` }], result: profeExiste ? { value: { data: { uid: PROFE } } } : { undefined: {} } },
  { function: 'get', args: [{ exactValue: `${D}/g653Students/s1` }], result: { value: { data: ficha } } },
  // Otro profe dado de alta en g653Admins.
  { function: 'exists', args: [{ exactValue: `${D}/g653Admins/uid-admin2` }], result: { value: true } },
  { function: 'exists', args: [{ anyValue: {} }], result: { value: false } },
  { function: 'get', args: [{ anyValue: {} }], result: { value: { data: { role: 'client' } } } },
]

const req = (uid, method, path, data) => ({ ...(uid ? { auth: { uid } } : {}), method, path: `${D}/${path}`, ...(data ? { resource: { data } } : {}) })

const cases = [
  ['cualquiera lee quién es el profe', 'ALLOW', req(null, 'get', 'amConfig/profe')],
  ['la primera vez, alguien se anota como profe con su propio uid', 'ALLOW', req('nuevo', 'create', 'amConfig/profe', { uid: 'nuevo', nombre: 'A', apellido: 'M', username: 'a.m', createdAt: 1 }), null, false],
  ['no se puede anotar con el uid de otro', 'DENY', req('nuevo', 'create', 'amConfig/profe', { uid: 'otro', nombre: 'A' }), null, false],
  ['nadie cambia quién es el profe', 'DENY', req(PROFE, 'update', 'amConfig/profe', { uid: ALUMNO, nombre: 'A' }), { uid: PROFE, nombre: 'A' }],
  ['el profe cambia su nombre y usuario', 'ALLOW', req(PROFE, 'update', 'amConfig/profe', { uid: PROFE, nombre: 'Andy', username: 'andy' }), { uid: PROFE, nombre: 'A', username: 'a.m' }],
  ['un estudiante no cambia los datos del profe', 'DENY', req(ALUMNO, 'update', 'amConfig/profe', { uid: PROFE, nombre: 'X' }), { uid: PROFE, nombre: 'A' }],
  ['el profe tiene su propia ficha para entrenar', 'ALLOW', req(PROFE, 'create', 'amStudents/yo-uid-profe', { uid: PROFE })],
  ['el profe sube sus entrenos', 'ALLOW', req(PROFE, 'create', 'amStudents/yo-uid-profe/logs/e1', { v: 2 })],
  ['antes de entrar se lee un usuario', 'ALLOW', req(null, 'get', 'amLogins/juan.perez')],
  ['no se pueden listar los usuarios', 'DENY', req(null, 'list', 'amLogins/juan.perez')],
  ['un estudiante no crea usuarios', 'DENY', req(ALUMNO, 'create', 'amLogins/x', { email: 'x', sid: 's1' })],
  ['el profe crea usuarios', 'ALLOW', req(PROFE, 'create', 'amLogins/x', { email: 'x', sid: 's1' })],
  ['el estudiante lee su ficha', 'ALLOW', req(ALUMNO, 'get', 'amStudents/s1'), ficha],
  ['otro no lee la ficha ajena', 'DENY', req(OTRO, 'get', 'amStudents/s1'), ficha],
  ['el estudiante guarda sus últimos pesos', 'ALLOW', req(ALUMNO, 'update', 'amStudents/s1', { ...ficha, exercisePrefs: { a: { weight: 5 } } }), ficha],
  ['el estudiante no se cambia la cuota', 'DENY', req(ALUMNO, 'update', 'amStudents/s1', { ...ficha, cuota: { monto: 0, dia: 10 } }), ficha],
  ['el estudiante no se cambia la cuenta', 'DENY', req(ALUMNO, 'update', 'amStudents/s1', { ...ficha, uid: OTRO }), ficha],
  ['el estudiante no se crea fichas', 'DENY', req(ALUMNO, 'create', 'amStudents/s2', { uid: ALUMNO })],
  ['el profe da de alta', 'ALLOW', req(PROFE, 'create', 'amStudents/s2', { uid: 'x' })],
  ['el profe da de baja', 'ALLOW', req(PROFE, 'delete', 'amStudents/s1'), ficha],
  ['el estudiante lee su plan', 'ALLOW', req(ALUMNO, 'get', 'amStudents/s1/days/d1')],
  ['el estudiante no edita su plan', 'DENY', req(ALUMNO, 'update', 'amStudents/s1/days/d1', { bloques: [] }), { bloques: [] }],
  ['otro no lee el plan ajeno', 'DENY', req(OTRO, 'get', 'amStudents/s1/days/d1')],
  ['el profe publica el plan', 'ALLOW', req(PROFE, 'create', 'amStudents/s1/days/d1', { bloques: [] })],
  ['el estudiante sube su entreno', 'ALLOW', req(ALUMNO, 'create', 'amStudents/s1/logs/e1', { v: 2 })],
  ['otro no sube entrenos ajenos', 'DENY', req(OTRO, 'create', 'amStudents/s1/logs/e1', { v: 2 })],
  ['el estudiante no borra entrenos', 'DENY', req(ALUMNO, 'delete', 'amStudents/s1/logs/e1'), { v: 2 }],
  ['el estudiante ve sus pagos', 'ALLOW', req(ALUMNO, 'get', 'amStudents/s1/pagos/p1')],
  ['el estudiante no se anota pagos', 'DENY', req(ALUMNO, 'create', 'amStudents/s1/pagos/p1', { periodo: '2026-10' })],
  ['el profe registra pagos', 'ALLOW', req(PROFE, 'create', 'amStudents/s1/pagos/p1', { periodo: '2026-10' })],
  ['el profe carga medidas', 'ALLOW', req(PROFE, 'create', 'amStudents/s1/medidas/m1', { pesoKg: 80 })],
  ['el estudiante no carga medidas', 'DENY', req(ALUMNO, 'create', 'amStudents/s1/medidas/m1', { pesoKg: 80 })],
  ['biblioteca: solo el profe', 'DENY', req(ALUMNO, 'get', 'amExercises/sentadilla')],
  ['biblioteca: el profe', 'ALLOW', req(PROFE, 'create', 'amExercises/sentadilla', { nombre: 'S' })],
  ['sin sesión no se lee nada de estudiantes', 'DENY', req(null, 'get', 'amStudents/s1'), ficha],
  // Las reglas de 653 siguen igual.
  ['653: un socio no se hace admin', 'DENY', req('socio', 'update', 'gymUsers/socio', { role: 'admin' }), { role: 'client' }],
  ['653: el socio lee su ficha', 'ALLOW', req('socio', 'get', 'gymUsers/socio'), { role: 'client' }],
]

// 653 con panel de AM (colecciones g653*): los mismos casos, salvo que la cuenta del profe no se crea desde la app.
const g653 = cases
  .filter(([, , rq]) => /\/am(Config|Logins|Students|Exercises)\//.test(rq.path))
  .map(([name, exp, rq, resource, profeExiste]) => {
    const path = rq.path.replace(/\/am(Config|Logins|Students|Exercises)\//, '/g653$1/')
    const nuevoProfe = /^la primera vez/.test(name)
    return [`653: ${name}`, nuevoProfe ? 'DENY' : exp, { ...rq, path }, resource, profeExiste]
  })
cases.push(...g653)

// Varios profes (g653Admins).
const ADMIN2 = 'uid-admin2'
cases.push(
  ['653: otro profe lee las fichas', 'ALLOW', req(ADMIN2, 'get', 'g653Students/s1'), ficha],
  ['653: otro profe publica planes', 'ALLOW', req(ADMIN2, 'create', 'g653Students/s1/days/d1', { bloques: [] })],
  ['653: otro profe da de alta socios', 'ALLOW', req(ADMIN2, 'create', 'g653Students/s2', { uid: 'x' })],
  ['653: otro profe crea usuarios', 'ALLOW', req(ADMIN2, 'create', 'g653Logins/x', { email: 'x', rol: 'profe' })],
  ['653: el profe da de alta a otro profe', 'ALLOW', req(PROFE, 'create', 'g653Admins/nuevo', { uid: 'nuevo', nombre: 'A' })],
  ['653: no se da de alta con un uid que no es el del documento', 'DENY', req(PROFE, 'create', 'g653Admins/nuevo', { uid: 'otro', nombre: 'A' })],
  ['653: un socio no se da de alta como profe', 'DENY', req(ALUMNO, 'create', 'g653Admins/' + ALUMNO, { uid: ALUMNO, nombre: 'A' })],
  ['653: sin sesión no se da de alta', 'DENY', req(null, 'create', 'g653Admins/x', { uid: 'x' })],
  ['653: otro profe da de alta a un tercero', 'ALLOW', req(ADMIN2, 'create', 'g653Admins/tercero', { uid: 'tercero', nombre: 'T' })],
  ['653: un profe da de baja a otro', 'ALLOW', req(PROFE, 'delete', 'g653Admins/' + ADMIN2), { uid: ADMIN2 }],
  ['653: un profe no se da de baja a sí mismo', 'DENY', req(ADMIN2, 'delete', 'g653Admins/' + ADMIN2), { uid: ADMIN2 }],
  ['653: un socio no da de baja profes', 'DENY', req(ALUMNO, 'delete', 'g653Admins/' + ADMIN2), { uid: ADMIN2 }],
  ['653: el profe lee la lista de profes', 'ALLOW', req(PROFE, 'list', 'g653Admins/x')],
  ['653: un socio no lee la lista de profes', 'DENY', req(ALUMNO, 'list', 'g653Admins/x')],
  ['653: otro profe edita su nombre y usuario', 'ALLOW', req(ADMIN2, 'update', 'g653Admins/' + ADMIN2, { uid: ADMIN2, nombre: 'B', username: 'b' }), { uid: ADMIN2, nombre: 'A', username: 'a' }],
  ['653: otro profe no cambia su uid', 'DENY', req(ADMIN2, 'update', 'g653Admins/' + ADMIN2, { uid: 'otro', nombre: 'A' }), { uid: ADMIN2, nombre: 'A' }],
  ['653: un profe no edita los datos de otro profe', 'DENY', req(PROFE, 'update', 'g653Admins/' + ADMIN2, { uid: ADMIN2, nombre: 'X' }), { uid: ADMIN2, nombre: 'A' }],
  ['653: un socio ajeno sigue sin leer fichas', 'DENY', req(OTRO, 'get', 'g653Students/s1'), ficha],
)

const testCases = cases.map(([, expectation, request, resource, profeExiste]) => ({
  expectation,
  request,
  ...(resource ? { resource: { data: resource } } : {}),
  functionMocks: mocks(profeExiste ?? true),
}))

const t = await token()
const res = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}:test`, {
  method: 'POST',
  headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
  body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: rules }] }, testSuite: { testCases } }),
})
const out = await res.json()
if (!res.ok) {
  console.error(JSON.stringify(out, null, 2))
  process.exit(1)
}
let fails = 0
out.testResults.forEach((r, i) => {
  const ok = r.state === 'SUCCESS'
  if (!ok) fails++
  console.log(`${ok ? '✓' : '✗'} ${cases[i][0]}${ok ? '' : ` — ${JSON.stringify(r.debugMessages ?? r.errorPosition ?? r)}`}`)
})
console.log(fails ? `\n${fails} fallaron` : `\nTodas bien (${cases.length})`)
process.exit(fails ? 1 : 0)
