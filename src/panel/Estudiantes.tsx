import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { problemaDni, soloDni, usernameFrom } from '../cuentas'
import { estadoLabel, DEFAULT_CUOTA } from '../cuotas'
import { altaEstudiante, loadEstudiantes, type AltaDatos } from './api'
import { Credenciales, Dialog } from './Dialog'
import styles from './Estudiantes.module.css'
import { buildFila, countBy, cuotaTone, matches, type Fila, type Filtro } from './listado'
import ui from './ui.module.css'

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'semana', label: 'Entrenaron esta semana' },
  { value: 'sin-plan', label: 'Sin plan' },
  { value: 'cuota', label: 'Cuota vencida' },
  { value: 'inactivos', label: 'Más de 10 días sin entrenar' },
]

export function Estudiantes() {
  const [rows, setRows] = useState<Fila[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [query, setQuery] = useState('')
  const [alta, setAlta] = useState(false)

  const load = useCallback(() => {
    const now = Date.now()
    loadEstudiantes(now)
      .then((list) => {
        setError(null)
        setRows(list.map((r) => buildFila(r.e, r.e.rutina?.dias ?? null, r.entrenos, r.cuota, now)))
      })
      .catch(() => setError('No pudimos cargar los socios. Revisá la conexión y probá de nuevo.'))
  }, [])

  useEffect(load, [load])

  const visible = useMemo(() => (rows ?? []).filter((r) => matches(r, filtro, query)), [rows, filtro, query])
  const vencidas = rows ? countBy(rows, 'cuota') : 0
  const semana = rows?.filter((r) => r.semana > 0).length ?? 0

  return (
    <main className={ui.page}>
      <div className={styles.head}>
        <div>
          <h1 className={ui.title}>SOCIOS</h1>
          <div className={ui.sub}>
            {rows ? `${rows.length} ${rows.length === 1 ? 'socio' : 'socios'} · ${semana} entrenaron esta semana${vencidas ? ` · ${vencidas} con la cuota vencida` : ''}` : 'Cargando…'}
          </div>
        </div>
        <button className={ui.primary} onClick={() => setAlta(true)}>
          + NUEVO SOCIO
        </button>
      </div>

      <div className={styles.tools}>
        <label htmlFor="buscar" className={ui.srOnly}>
          Buscar socio
        </label>
        <input id="buscar" className={`${ui.input} ${styles.search}`} placeholder="Buscar por nombre" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className={styles.filters} role="group" aria-label="Filtros">
          {FILTROS.map((f) => (
            <button key={f.value} className={styles.filter} aria-pressed={filtro === f.value} onClick={() => setFiltro(f.value)}>
              {f.label} <span className={styles.count}>{rows ? countBy(rows, f.value) : ''}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className={ui.error} role="alert">
          {error}{' '}
          <button className={ui.link} style={{ color: 'inherit' }} onClick={load}>
            Reintentar
          </button>
        </p>
      )}

      <ul className={styles.list}>
        {visible.map((r) => {
          const tone = cuotaTone(r.cuota)
          return (
            <li key={r.id}>
              <Link to={`/panel/estudiante/${r.id}`} className={styles.row}>
                <div className={styles.who}>
                  <div className={styles.avatar} aria-hidden="true">
                    {r.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.whoText}>
                    <div className={styles.name}>{r.nombre}</div>
                    <div className={styles.user}>{r.username}</div>
                  </div>
                </div>
                <div className={styles.cell} data-label="Plan">
                  {r.plan ?? <span className={ui.muted}>Sin plan</span>}
                </div>
                <div className={styles.cell} data-label="Último entreno">
                  <span className={r.inactivo ? styles.strong : r.lastAt === null ? ui.muted : undefined}>{r.lastLabel}</span>
                  {r.streak > 0 && <span className={styles.streak}> · {r.streak} sem seguidas</span>}
                </div>
                <div className={styles.cell} data-label="Cuota">
                  {tone ? (
                    <span className={ui.badge} data-tone={tone}>
                      {tone === 'alerta' && '! '}
                      {estadoLabel(r.cuota)}
                    </span>
                  ) : (
                    <span className={ui.muted}>Sin cuota</span>
                  )}
                </div>
                <svg className={styles.chev} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          )
        })}
      </ul>
      {rows && visible.length === 0 && !error && (
        <p className={ui.empty}>{rows.length === 0 ? 'Todavía no tenés socios. Con "Nuevo socio" das de alta al primero.' : 'Nadie coincide con la búsqueda o el filtro.'}</p>
      )}

      {alta && (
        <AltaDialog
          onClose={() => {
            setAlta(false)
            load()
          }}
        />
      )}
    </main>
  )
}

/** Alta: el usuario sale de nombre.apellido y la contraseña es el DNI (como siempre en el 653). */
function AltaDialog({ onClose }: { onClose: () => void }) {
  const [d, setD] = useState<AltaDatos>(() => ({ nombre: '', apellido: '', dni: '', telefono: '', profe: '', objetivo: '', cuota: { ...DEFAULT_CUOTA } }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<{ username: string } | null>(null)
  const set = <K extends keyof AltaDatos>(k: K, v: AltaDatos[K]) => setD((x) => ({ ...x, [k]: v }))
  const dni = soloDni(d.dni)
  const problema = dni ? problemaDni(dni) : null
  const ok = d.nombre.trim() && d.apellido.trim() && dni && !problema

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await altaEstudiante(d)
      setHecho({ username: r.username })
    } catch (err) {
      setError(err instanceof Error && err.message !== 'otro' && err.message !== 'red' ? err.message : 'No pudimos crear la cuenta. Revisá la conexión y probá de nuevo.')
    }
    setBusy(false)
  }

  if (hecho) {
    return (
      <Dialog title="¡LISTO!" text={`${d.nombre.trim()} ya puede entrar. Pasale estos datos: después le armás el plan.`} onClose={onClose}>
        <Credenciales username={hecho.username} clave={dni} nombre={d.nombre.trim()} telefono={d.telefono} />
        <div className={ui.actions}>
          <button className={ui.secondary} onClick={onClose}>
            CERRAR
          </button>
        </div>
      </Dialog>
    )
  }

  const preview = usernameFrom(d.nombre, d.apellido)

  return (
    <Dialog title="NUEVO SOCIO" onClose={onClose}>
      <form onSubmit={submit}>
        <div className={ui.cols2}>
          <div>
            <label htmlFor="alta-nombre" className={ui.label}>
              NOMBRE
            </label>
            <input id="alta-nombre" className={ui.input} value={d.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus required />
          </div>
          <div>
            <label htmlFor="alta-apellido" className={ui.label}>
              APELLIDO
            </label>
            <input id="alta-apellido" className={ui.input} value={d.apellido} onChange={(e) => set('apellido', e.target.value)} required />
          </div>
        </div>
        <div className={ui.hint} style={{ marginTop: 6 }}>
          {preview ? `Usuario: ${preview} (si ya existe, se le suma un número)` : 'El usuario se arma con nombre.apellido'}
        </div>

        <label htmlFor="alta-dni" className={ui.label}>
          DNI (ES LA CONTRASEÑA)
        </label>
        <input id="alta-dni" className={ui.input} inputMode="numeric" placeholder="Sin puntos" value={d.dni} onChange={(e) => set('dni', e.target.value)} aria-invalid={!!problema} required />
        <div className={ui.hint} style={{ marginTop: 6 }}>
          {problema ?? 'Entra con su nombre y apellido y el DNI. Después la puede cambiar desde su Perfil.'}
        </div>

        <label htmlFor="alta-tel" className={ui.label}>
          TELÉFONO (WHATSAPP)
        </label>
        <input id="alta-tel" className={ui.input} inputMode="tel" placeholder="351 555 0102" value={d.telefono} onChange={(e) => set('telefono', e.target.value)} />

        <label htmlFor="alta-profe" className={ui.label}>
          PROFE
        </label>
        <input id="alta-profe" className={ui.input} placeholder="Opcional" value={d.profe} onChange={(e) => set('profe', e.target.value)} />

        <label htmlFor="alta-obj" className={ui.label}>
          OBJETIVO
        </label>
        <input id="alta-obj" className={ui.input} placeholder="Opcional" value={d.objetivo} onChange={(e) => set('objetivo', e.target.value)} />

        <div className={ui.cols2}>
          <div>
            <label htmlFor="alta-monto" className={ui.label}>
              CUOTA MENSUAL ($)
            </label>
            <input
              id="alta-monto"
              className={ui.input}
              inputMode="numeric"
              placeholder="0 = la marcás a mano"
              value={d.cuota.monto || ''}
              onChange={(e) => set('cuota', { ...d.cuota, monto: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            />
          </div>
          <div>
            <label htmlFor="alta-dia" className={ui.label}>
              VENCE EL DÍA
            </label>
            <select id="alta-dia" className={ui.select} value={d.cuota.dia} onChange={(e) => set('cuota', { ...d.cuota, dia: Number(e.target.value) })}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
        <div className={ui.actions}>
          <button type="button" className={ui.link} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={ui.primary} disabled={!ok || busy}>
            {busy ? 'CREANDO…' : 'DAR DE ALTA'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
