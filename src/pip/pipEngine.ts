import { drawFrame, PIP_SIZE } from './drawFrame'
import type { PipCommand, PipFrame } from './frameModel'

/**
 * Ventana flotante "de verdad" (la misma de YouTube): el estado del entreno se dibuja en un <canvas>
 * oculto, que se convierte en un video en vivo (captureStream) y el navegador lo muestra flotando
 * sobre las otras apps.
 */

type Listener = () => void

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let video: HTMLVideoElement | null = null
let stream: MediaStream | null = null
let frame: PipFrame | null = null
let onCommand: ((c: PipCommand) => void) | null = null
let autoOnLeave = false
let openedByLeave = false
const listeners = new Set<Listener>()

export function isPiPSupported(): boolean {
  return typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled
}

export const isPiPOpen = () => !!video && document.pictureInPictureElement === video

export function subscribePiP(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
const emit = () => listeners.forEach((l) => l())

function run(cmd: PipCommand | null | undefined) {
  if (cmd && onCommand) onCommand(cmd)
}

function setActionHandlers() {
  const ms = navigator.mediaSession
  if (!ms) return
  // 'enterpictureinpicture' todavía no está en los tipos de TS.
  const set = (action: MediaSessionAction | 'enterpictureinpicture', handler: MediaSessionActionHandler | null) => {
    try {
      ms.setActionHandler(action as MediaSessionAction, handler)
    } catch {
      /* acción no soportada en este navegador */
    }
  }
  // ⏭ y ⏮ en la ventanita: Chrome los muestra si hay un handler registrado.
  set('nexttrack', frame?.controls.next ? () => run(frame?.controls.next) : null)
  set('previoustrack', frame?.controls.prev ? () => run(frame?.controls.prev) : null)
  // El navegador lo llama al salir de la pestaña/app con el video andando: ahí deja abrir
  // la ventana sin que el usuario la toque (el "PiP automático" de las videollamadas).
  set('enterpictureinpicture', () => {
    if (!autoOnLeave || !video) return
    openedByLeave = true
    video.requestPictureInPicture().catch(() => {
      openedByLeave = false
    })
  })
}

function ensureElements() {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.width = PIP_SIZE
  canvas.height = PIP_SIZE
  ctx = canvas.getContext('2d')

  video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  // Safari: pasa solo a flotante al salir de la app si el video está andando.
  video.setAttribute('autopictureinpicture', '')
  // Tiene que estar en el DOM (no display:none) para poder pedir PiP; queda fuera de la pantalla.
  Object.assign(video.style, { position: 'fixed', left: '-9999px', top: '0', width: '2px', height: '2px' })
  document.body.appendChild(video)

  video.addEventListener('enterpictureinpicture', emit)
  video.addEventListener('leavepictureinpicture', () => {
    openedByLeave = false
    emit()
  })
  // El ⏯ de la ventanita pausa el video: lo usamos para pausar el cronómetro y lo
  // volvemos a reproducir enseguida (un video pausado deja la ventana congelada).
  video.addEventListener('pause', () => {
    if (!isPiPOpen()) return
    run(frame?.controls.playPause)
    void video?.play().catch(() => {})
  })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Por si el navegador no usa el handler de arriba pero igual lo permite.
      if (autoOnLeave && video && !isPiPOpen()) {
        openedByLeave = true
        video.requestPictureInPicture().catch(() => {
          openedByLeave = false
        })
      }
    } else {
      // Android pausa los videos sin sonido en segundo plano: al volver, que siga.
      if (stream && video?.paused) void video.play().catch(() => {})
      // Si se abrió sola al salir, al volver a la app se cierra sola.
      if (openedByLeave && isPiPOpen()) void document.exitPictureInPicture().catch(() => {})
    }
  })
}

async function ensureStream() {
  ensureElements()
  if (!stream && canvas && video) {
    stream = canvas.captureStream(4)
    video.srcObject = stream
  }
  if (video?.paused) await video.play()
}

/** Dibuja el estado actual. Barato: se puede llamar en cada tick. */
export function renderPiP(f: PipFrame) {
  ensureElements()
  frame = f
  if (ctx) drawFrame(ctx, f)
  setActionHandlers()
}

export function setPiPCommandHandler(handler: ((c: PipCommand) => void) | null) {
  onCommand = handler
}

/**
 * Deja el video andando (oculto) para que, si el usuario cambia de app, el navegador lo pueda
 * pasar a flotante. Un video mudo puede arrancar sin que el usuario toque nada.
 */
export async function armPiP(autoOpenOnLeave: boolean) {
  if (!isPiPSupported()) return
  autoOnLeave = autoOpenOnLeave
  try {
    await ensureStream()
  } catch {
    /* sin video: no hay ventana flotante */
  }
}

export function disarmPiP() {
  autoOnLeave = false
  // Sin cuadro, el 'pause' que dispara video.pause() de abajo no ejecuta ningún comando.
  frame = null
  if (isPiPOpen()) void document.exitPictureInPicture().catch(() => {})
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  if (video) {
    video.pause()
    video.srcObject = null
  }
  for (const action of ['nexttrack', 'previoustrack', 'enterpictureinpicture'] as unknown as MediaSessionAction[]) {
    try {
      navigator.mediaSession?.setActionHandler(action, null)
    } catch {
      /* no soportada */
    }
  }
}

/** Abre la ventana a mano. Tiene que llamarse dentro de un toque del usuario. */
export async function openPiP(): Promise<boolean> {
  if (!isPiPSupported()) return false
  try {
    await ensureStream()
    if (!isPiPOpen()) {
      openedByLeave = false
      await video!.requestPictureInPicture()
    }
    return true
  } catch {
    return false
  }
}

export function closePiP() {
  if (isPiPOpen()) void document.exitPictureInPicture().catch(() => {})
}
