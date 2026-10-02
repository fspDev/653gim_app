import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore, type Dispatch } from 'react'
import { showAlert } from '../notify'
import { useSettings } from '../settings'
import type { WorkoutAction } from '../workout/reducer'
import type { Workout } from '../workout/types'
import { frameOf, type PipCommand } from './frameModel'
import { armPiP, closePiP, disarmPiP, disarmPiPSoon, isPiPOpen, isPiPSupported, openPiP, renderPiP, setPiPCommandHandler, subscribePiP } from './pipEngine'

/** Instante en que termina lo que está corriendo y hay que avisar (descanso o bloque por tiempo). */
function alarmOf(w: Workout): { at: number; key: string; title: string; body: string } | null {
  if (w.stage !== 'block') return null
  const block = w.day.blocks[w.index]
  const next = w.day.blocks[w.index + 1]
  const run = w.run
  if (run.kind === 'fuerza' && block.kind === 'fuerza' && run.phase === 'descanso') {
    const last = run.serie >= block.series
    return {
      at: run.restEnd,
      key: `rest-${block.id}-${run.serie}-${run.restEnd}`,
      title: '¡Descanso terminado! 💪',
      body: last ? `Sigue: ${next?.name ?? 'fin del entreno'}` : `Serie ${run.serie + 1} de ${block.short} · ${run.weight.toLocaleString('es-AR')} kg`,
    }
  }
  if (run.kind === 'tiempo' && run.pausedLeft === null) {
    return { at: run.endAt, key: `time-${block.id}-${run.endAt}`, title: `¡${block.name}: listo!`, body: next ? `Sigue: ${next.name}` : 'Terminaste el entreno' }
  }
  return null
}

function commandToAction(cmd: PipCommand, w: Workout, now: number): WorkoutAction | null {
  switch (cmd) {
    case 'done':
      return { type: 'DONE', now }
    case 'skip-rest':
      return { type: 'FINISH_REST', now }
    case 'rest-plus':
      return { type: 'ADJUST_REST', deltaSeconds: 15, now }
    case 'time-toggle':
      return { type: 'TIME_TOGGLE', now }
    case 'time-finish': {
      const run = w.run
      if (run.kind !== 'tiempo') return null
      const left = run.pausedLeft ?? run.endAt - now
      return { type: 'TIME_ADD', deltaSeconds: -Math.ceil(left / 1000) - 1, now }
    }
    case 'circuit-next':
      return { type: 'CIRCUIT_NEXT', now }
    case 'circuit-prev':
      return { type: 'CIRCUIT_PREV', now }
    case 'circuit-toggle':
      return { type: 'CIRCUIT_TOGGLE', now }
    case 'between-start':
      return { type: 'BETWEEN_START', now }
    case 'between-toggle':
      return { type: 'BETWEEN_TOGGLE', now }
  }
}

const usePiPOpen = () => useSyncExternalStore(subscribePiP, isPiPOpen, () => false)

/**
 * Compañero del entreno cuando la app no está a la vista: ventana flotante con controles,
 * reloj que no se congela en segundo plano y aviso con vibración al terminar descanso o bloque.
 */
export function usePiP(w: Workout, dispatch: Dispatch<WorkoutAction>) {
  const { flotante } = useSettings()
  const wRef = useRef(w)
  useLayoutEffect(() => {
    wRef.current = w
  }, [w])
  const fired = useRef<string | null>(null)
  // El último aviso pendiente. No se toma del estado actual en cada tick: el reloj de la pantalla
  // puede haber pasado ya a la serie siguiente y el aviso se perdería.
  const alarmRef = useRef<ReturnType<typeof alarmOf>>(null)
  useEffect(() => {
    const a = alarmOf(w)
    if (a) alarmRef.current = a
    // Terminó antes de tiempo (saltó el descanso, cortó el bloque): ya no hay que avisar.
    else if (alarmRef.current && alarmRef.current.at > Date.now()) alarmRef.current = null
  }, [w])
  const open = usePiPOpen()
  const active = w.stage !== 'done'
  const supported = isPiPSupported()

  // Los controles de la ventanita ejecutan acciones del entreno.
  useEffect(() => {
    setPiPCommandHandler((cmd) => {
      const action = commandToAction(cmd, wRef.current, Date.now())
      if (action) dispatch(action)
    })
    return () => setPiPCommandHandler(null)
  }, [dispatch])

  // El video queda listo mientras se entrena; con "al cambiar de app" se abre solo al salir.
  useEffect(() => {
    if (!active || flotante === 'nunca') {
      disarmPiP()
      return
    }
    void armPiP(flotante === 'salir')
  }, [active, flotante])

  useEffect(() => () => disarmPiPSoon(), [])

  // Cada cambio del entreno se dibuja enseguida.
  useEffect(() => {
    if (flotante !== 'nunca') renderPiP(frameOf(w, Date.now()))
  }, [w, flotante])

  // Reloj de un worker: en segundo plano no se congela, así la cuenta de la ventanita sigue,
  // el entreno avanza (el descanso termina y pasa a la serie) y el aviso sale a tiempo.
  useEffect(() => {
    if (!active) return
    const worker = new Worker(new URL('./ticker.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<number>) => {
      const now = e.data
      const current = wRef.current
      dispatch({ type: 'TICK', now })
      if (flotante !== 'nunca') renderPiP(frameOf(current, now))
      const alarm = alarmRef.current
      if (alarm && now >= alarm.at && fired.current !== alarm.key) {
        fired.current = alarm.key
        // Con la app a la vista ya vibra y suena desde la pantalla del entreno. Si el sistema tuvo la
        // app congelada y el fin fue hace rato, avisar ahora llegaría tarde.
        if (document.hidden && now - alarm.at < 15_000) void showAlert(alarm.title, alarm.body)
      }
    }
    worker.postMessage('start')
    return () => {
      worker.postMessage('stop')
      worker.terminate()
    }
  }, [active, dispatch, flotante])

  /** Con "Al tocar": se abre dentro de un toque del entreno (el navegador exige un gesto). */
  const onGesture = useCallback(() => {
    if (active && flotante === 'serie' && supported && !isPiPOpen()) void openPiP()
  }, [active, flotante, supported])

  const toggle = useCallback(() => {
    if (isPiPOpen()) closePiP()
    else void openPiP()
  }, [])

  // El botón 🗗 está siempre (salvo "Nunca"): es la forma que funciona en todos los celulares.
  // Lo automático (al salir o al tocar) es un extra que depende del navegador.
  return { supported: supported && flotante !== 'nunca', open, manual: true, onGesture, toggle }
}
