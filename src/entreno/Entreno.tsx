import { useCallback, useEffect, useMemo, useReducer, useState, type ReactElement } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { db, saveFinished } from '../db'
import { useAuth } from '../auth/context'
import { useNow, useWakeLock } from '../hooks'
import { useSettings } from '../settings'
import { streakWeeks } from '../stats'
import { Summary } from '../summary/Summary'
import { clearActive, loadActive, saveActive } from '../workout/persist'
import { findRecords, type RecordHit } from '../workout/records'
import { workoutReducer, type WorkoutAction } from '../workout/reducer'
import { PipContext } from '../pip/context'
import { usePiP } from '../pip/usePiP'
import type { Workout } from '../workout/types'
import { BetweenView } from './BetweenView'
import { CircuitView } from './CircuitView'
import { ExitSheet, type ExitKind } from './ExitSheet'
import { LogSheet } from './LogSheet'
import { NoteContext } from './noteContext'
import { NoteSheet } from './NoteSheet'
import { StrengthView } from './StrengthView'
import { TimeView } from './TimeView'

/** Ruta /entreno: retoma el entreno guardado en el teléfono; si no hay, vuelve a Hoy. */
export function Entreno() {
  const [initial] = useState(() => loadActive())
  if (!initial) return <Navigate to="/" replace />
  return <EntrenoRun initial={initial} />
}

function EntrenoRun({ initial }: { initial: Workout }) {
  const navigate = useNavigate()
  const { pantallaEncendida } = useSettings()
  const { syncNow } = useAuth()
  const [w, rawDispatch] = useReducer(workoutReducer, initial)
  const pip = usePiP(w, rawDispatch)
  // Cualquier toque del entreno (HECHA, pausa o ±1 min de la bici, empezar el bloque…) sirve de gesto
  // para abrir la ventana flotante con el ajuste "Al tocar": el navegador solo la abre dentro de un toque.
  // Los ticks del reloj van por rawDispatch y no cuentan.
  const { onGesture } = pip
  const dispatch = useCallback(
    (a: WorkoutAction) => {
      if (a.type !== 'TICK' && a.type !== 'SET_FEELING') onGesture()
      rawDispatch(a)
    },
    [onGesture],
  )
  const pipUi = useMemo(() => ({ manual: pip.supported && pip.manual, open: pip.open, toggle: pip.toggle }), [pip.supported, pip.manual, pip.open, pip.toggle])
  const now = useNow(250)
  const [exitOpen, setExitOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [records, setRecords] = useState<RecordHit[]>([])
  const [streak, setStreak] = useState(0)

  // Todo se mide contra instantes de fin: el tick solo despierta al reducer.
  useEffect(() => {
    rawDispatch({ type: 'TICK', now })
  }, [now])

  // Se guarda en cada cambio: si se recarga o se cierra la app, vuelve donde estaba.
  useEffect(() => saveActive(w), [w])

  useWakeLock(pantallaEncendida && w.stage !== 'done')

  const done = w.stage === 'done'

  // Récords contra el historial anterior (sin contar este mismo entreno).
  useEffect(() => {
    if (!done) return
    let cancelled = false
    void db.series
      .where('entrenoId')
      .notEqual(w.id)
      .toArray()
      .then((rows) => {
        if (!cancelled) setRecords(findRecords(rows.map((r) => ({ exerciseId: r.exerciseId, weight: r.pesoKg, reps: r.reps })), w.logs))
      })
    return () => {
      cancelled = true
    }
  }, [done, w.id, w.logs])

  // Racha de semanas contando este entreno.
  useEffect(() => {
    if (!done) return
    let cancelled = false
    void db.entrenos
      .where('id')
      .notEqual(w.id)
      .toArray()
      .then((rows) => {
        if (!cancelled) setStreak(streakWeeks([...rows.map((r) => r.empezadoAt), w.startedAt], w.finishedAt ?? Date.now()))
      })
    return () => {
      cancelled = true
    }
  }, [done, w.id, w.startedAt, w.finishedAt])

  // El entreno terminado va primero al teléfono (IndexedDB); la sincronización con el servidor llega en la fase 3.
  useEffect(() => {
    if (done) void saveFinished(w).then(syncNow)
  }, [done, w, syncNow])

  const closeExit = useCallback(() => setExitOpen(false), [])
  const closeLog = useCallback(() => setLogOpen(false), [])
  const [noteOpen, setNoteOpen] = useState(false)
  const closeNote = useCallback(() => setNoteOpen(false), [])
  const openNote = useCallback(() => setNoteOpen(true), [])

  const handleExit = (kind: ExitKind) => {
    setExitOpen(false)
    if (kind === 'guardar') {
      dispatch({ type: 'EXIT_SAVE', now: Date.now() })
    } else {
      clearActive()
      navigate('/', { replace: true })
    }
  }

  const finish = () => {
    clearActive()
    navigate('/', { replace: true })
  }

  if (done) {
    return <Summary w={w} records={records} streak={streak} onFeeling={(value) => dispatch({ type: 'SET_FEELING', value })} onClose={finish} />
  }

  const block = w.day.blocks[w.index]
  const noteUi = { available: !!block?.note, open: openNote }
  const wrap = (el: ReactElement) => (
    <PipContext.Provider value={pipUi}>
      <NoteContext.Provider value={noteUi}>{el}</NoteContext.Provider>
    </PipContext.Provider>
  )
  const run = w.run
  const openExit = () => setExitOpen(true)

  const overlay = exitOpen ? (
    <ExitSheet
      minutes={Math.floor((now - w.startedAt) / 60_000)}
      blocksDone={w.results.length}
      blocksTotal={w.day.blocks.length}
      onContinue={closeExit}
      onExit={handleExit}
    />
  ) : noteOpen && block ? (
    <NoteSheet name={block.name} note={block.note} onClose={closeNote} />
  ) : undefined

  if (w.stage === 'between') {
    return wrap(<BetweenView w={w} now={now} dispatch={dispatch} onExit={openExit} overlay={overlay} inertFrame={!!overlay} />)
  }

  if (block.kind === 'fuerza' && run.kind === 'fuerza') {
    const log = run.phase === 'descanso' ? w.logs.find((l) => l.blockId === block.id && l.serie === run.serie) : undefined
    const logSheet =
      logOpen && log ? (
        <LogSheet
          serie={run.serie}
          exercise={block.short}
          log={log}
          onSave={(reps) => {
            dispatch({ type: 'LOG_SET', serie: run.serie, reps })
            setLogOpen(false)
          }}
          onClose={closeLog}
        />
      ) : undefined
    return wrap(
      <StrengthView
        w={w}
        block={block}
        run={run}
        now={now}
        dispatch={dispatch}
        onExit={openExit}
        onLog={() => setLogOpen(true)}
        overlay={overlay ?? logSheet}
        inertFrame={!!overlay || !!logSheet}
      />
    )
  }

  if (block.kind === 'tiempo' && run.kind === 'tiempo') {
    return wrap(<TimeView w={w} block={block} run={run} now={now} dispatch={dispatch} onExit={openExit} overlay={overlay} inertFrame={!!overlay} />)
  }

  if (block.kind === 'circuito' && run.kind === 'circuito') {
    return wrap(<CircuitView w={w} block={block} run={run} now={now} dispatch={dispatch} onExit={openExit} overlay={overlay} inertFrame={!!overlay} />)
  }

  return null
}
