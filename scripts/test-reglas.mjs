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
