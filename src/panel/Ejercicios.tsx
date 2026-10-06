import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { slugify } from '../keys'
import { eliminarEjercicio, GRUPOS, guardarEjercicio, loadEjercicios, type Ejercicio } from './api'
import { Dialog } from './Dialog'
import styles from './Ejercicios.module.css'
import ui from './ui.module.css'

/** Biblioteca del profe: cada ejercicio con su grupo muscular. */
export function Ejercicios() {
  const [list, setList] = useState<Ejercicio[] | null>(null)
  const [q, setQ] = useState('')
  const [grupo, setGrupo] = useState('')
  const [error, setError] = useState(false)
  const [editando, setEditando] = useState<Ejercicio | 'nuevo' | null>(null)
  const [borrar, setBorrar] = useState<Ejercicio | null>(null)

  const load = useCallback(() => {
    loadEjercicios()
      .then((l) => {
        setError(false)
        setList(l)
      })
      .catch(() => setError(true))
  }, [])
  useEffect(load, [load])

  const grupos = useMemo(() => [...new Set([...GRUPOS, ...(list ?? []).map((e) => e.grupo).filter((g): g is string => !!g)])], [list])
  const visible = useMemo(() => {
    const t = slugify(q)
    return (list ?? []).filter((e) => (!t || e.id.includes(t) || slugify(e.nombre).includes(t)) && (!grupo || e.grupo === grupo))
  }, [list, q, grupo])

  return (
    <main className={ui.page}>
      <div className={styles.head}>
        <div>
          <h1 className={ui.title}>EJERCICIOS</h1>
          <div className={ui.sub}>
            {list ? `${list.length} ejercicios. ` : ''}Los que sumás acá quedan para todos los planes.
          </div>
        </div>
        <button className={ui.primary} onClick={() => setEditando('nuevo')}>
          + NUEVO EJERCICIO
        </button>
      </div>

      <div className={styles.tools}>
        <input className={`${ui.input} ${styles.search}`} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ejercicio" />
        <div className={styles.filters} role="group" aria-label="Grupo muscular">
          <button className={styles.filter} aria-pressed={!grupo} onClick={() => setGrupo('')}>
            Todos
          </button>
          {grupos
            .filter((g) => list?.some((e) => e.grupo === g))
            .map((g) => (
              <button key={g} className={styles.filter} aria-pressed={grupo === g} onClick={() => setGrupo(grupo === g ? '' : g)}>
                {g}
              </button>
            ))}
        </div>
      </div>

      {error && <p className={ui.error}>No pudimos cargar la biblioteca. Revisá la conexión y probá de nuevo.</p>}

      <ul className={styles.list}>
        {visible.map((e) => {
          return (
            <li key={e.id} className={styles.row}>
              <div className={styles.info}>
                <div className={styles.name}>{e.nombre}</div>
                <div className={ui.hint}>{e.grupo ?? 'Sin grupo'}</div>
              </div>
              <div className={styles.rowActions}>
                <button className={ui.ghost} onClick={() => setEditando(e)}>
                  Editar
                </button>
                <button className={ui.iconBtn} aria-label={`Eliminar ${e.nombre}`} onClick={() => setBorrar(e)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                  </svg>
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {list && visible.length === 0 && <p className={ui.empty}>{list.length === 0 ? 'La biblioteca está vacía. Sumá el primer ejercicio.' : 'Ningún ejercicio coincide.'}</p>}

      {editando && (
        <EditarDialog
          e={editando === 'nuevo' ? null : editando}
          nombreInicial={editando === 'nuevo' ? q.trim() : ''}
          grupos={grupos}
          existentes={list ?? []}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null)
            load()
          }}
        />
      )}
      {borrar && (
        <Dialog title="¿ELIMINAR?" text={`"${borrar.nombre}" sale de la biblioteca. Los planes que ya lo tienen no cambian.`} onClose={() => setBorrar(null)}>
          <div className={ui.actions}>
            <button className={ui.link} onClick={() => setBorrar(null)}>
              No
            </button>
            <button
              className={ui.danger}
              onClick={async () => {
                await eliminarEjercicio(borrar.id).catch(() => {})
                setBorrar(null)
                load()
              }}
            >
              SÍ, ELIMINAR
            </button>
          </div>
        </Dialog>
      )}
    </main>
  )
}

function EditarDialog({
  e,
  nombreInicial,
  grupos,
  existentes,
  onClose,
  onSaved,
}: {
  e: Ejercicio | null
  nombreInicial: string
  grupos: string[]
  existentes: Ejercicio[]
  onClose: () => void
  onSaved: () => void
}) {
  const [nombre, setNombre] = useState(e?.nombre ?? nombreInicial)
  const [grupo, setGrupo] = useState(e?.grupo ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Un ejercicio nuevo con el nombre de otro que ya existe lo pisaría.
  const repetido = !e && existentes.some((x) => x.id === slugify(nombre))
  const ok = !!nombre.trim() && !repetido

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      await guardarEjercicio({ nombre: nombre.replace(/\s+/g, ' '), grupo: grupo || null }, e?.id)
      onSaved()
    } catch {
      setError('No se pudo guardar. Probá de nuevo.')
      setBusy(false)
    }
  }

  return (
    <Dialog title={e ? 'EDITAR EJERCICIO' : 'NUEVO EJERCICIO'} onClose={onClose}>
      <form onSubmit={submit}>
        <label htmlFor="ej-nombre" className={ui.label}>
          NOMBRE
        </label>
        <input id="ej-nombre" className={ui.input} value={nombre} onChange={(x) => setNombre(x.target.value)} autoFocus />
        {repetido && (
          <div className={ui.hint} style={{ marginTop: 6 }}>
            Ya hay un ejercicio con ese nombre: editalo desde la lista.
          </div>
        )}
        {e && nombre.trim() !== e.nombre && (
          <div className={ui.hint} style={{ marginTop: 6 }}>
            Los planes ya armados conservan el nombre anterior.
          </div>
        )}

        <label htmlFor="ej-grupo" className={ui.label}>
          GRUPO MUSCULAR
        </label>
        <input id="ej-grupo" className={ui.input} list="ej-grupos" value={grupo} placeholder="Piernas, Espalda…" onChange={(x) => setGrupo(x.target.value)} />
        <datalist id="ej-grupos">
          {grupos.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>

        {error && <p className={ui.error}>{error}</p>}
        <div className={ui.actions}>
          <button type="button" className={ui.link} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={ui.primary} disabled={!ok || busy}>
            {busy ? 'GUARDANDO…' : 'GUARDAR'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
