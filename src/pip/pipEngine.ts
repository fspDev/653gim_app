import { canvasSizeFor, drawFrame, START_RATIO } from './drawFrame'
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

/** Safari de iPhone no tiene la API estándar de ventana flotante: usa la suya (webkitSetPresentationMode). */
type WebkitVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture' | 'fullscreen') => void
  webkitPresentationMode?: string
}

const standardPiP = () => typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled
const webkitPiP = () => typeof HTMLVideoElement !== 'undefined' && 'webkitSetPresentationMode' in HTMLVideoElement.prototype

export const isIOS = () =>
  typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/**
 * iPhone: Safari no deja poner en flotante un video dibujado en vivo (captureStream), sí un archivo.
 * Se usa public/descanso.mp4 (scripts/video-descanso.mjs): una cuenta regresiva de 10:00 a 0:00 a 1 cuadro
 * por segundo; para mostrar "quedan N s" se salta al segundo 600 − N y se deja correr. Abierta la ventana,
 * la cuenta sigue sola aunque el iPhone congele la app en segundo plano.
 */
const IOS_COUNT = 600
/** Cuadro quieto "A ENTRENAR" para cuando no hay cuenta regresiva (la serie). */
const IOS_IDLE = 607
let iosMode = false
let pausingOurselves = false

function syncIOS(f: PipFrame) {
  if (!video || video.readyState < 1) return
  const target = f.countdown === null ? IOS_IDLE : Math.max(0, IOS_COUNT - f.countdown)
  if (Math.abs(video.currentTime - target) > 1.5) video.currentTime = target
  const play = f.countdown !== null && f.countdown > 0 && !f.paused
  if (play && video.paused) void video.play().catch(() => {})
  if (!play && !video.paused) {
    pausingOurselves = true
    video.pause()
    pausingOurselves = false
  }
}

export function isPiPSupported(): boolean {
  return standardPiP() || webkitPiP()
}

export const isPiPOpen = () =>
  !!video && (document.pictureInPictureElement === video || (video as WebkitVideo).webkitPresentationMode === 'picture-in-picture')

/** Pide la ventana flotante por la API que tenga el navegador. */
async function requestPiP(): Promise<void> {
  if (!video) throw new Error('Sin video')
  if (standardPiP()) {
    watchWindow(await video.requestPictureInPicture())
    return
  }
  const v = video as WebkitVideo
  if (v.webkitSupportsPresentationMode && !v.webkitSupportsPresentationMode('picture-in-picture')) {
    throw new Error('Este iPhone no permite la ventana flotante para este video.')
  }
  v.webkitSetPresentationMode?.('picture-in-picture')
  // Safari no avisa si se niega: se espera el cambio de modo y, si no llega, se informa.
  await new Promise<void>((resolve, reject) => {
    if (v.webkitPresentationMode === 'picture-in-picture') return resolve()
    const t = setTimeout(() => {
      v.removeEventListener('webkitpresentationmodechanged', on)
      reject(new Error('El iPhone no abrió la ventana flotante.'))
    }, 1500)
    const on = () => {
      if (v.webkitPresentationMode !== 'picture-in-picture') return
      clearTimeout(t)
      v.removeEventListener('webkitpresentationmodechanged', on)
      resolve()
    }
    v.addEventListener('webkitpresentationmodechanged', on)
  })
}

function exitPiP() {
  if (!isPiPOpen() || !video) return
  if (document.pictureInPictureElement === video) void document.exitPictureInPicture().catch(() => {})
  else (video as WebkitVideo).webkitSetPresentationMode?.('inline')
}

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
    requestPiP().catch(() => {
      openedByLeave = false
    })
  })
}

function ensureElements() {
  if (canvas) return
  iosMode = isIOS()
  canvas = document.createElement('canvas')
  // Arranca en 5:4, la proporción con la que Android abrió la ventana en las pruebas; se ajusta a la real al abrirse.
  const start = canvasSizeFor(START_RATIO)
  canvas.width = start.w
  canvas.height = start.h
  ctx = canvas.getContext('2d')

  video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  // Safari: pasa solo a flotante al salir de la app si el video está andando.
  video.setAttribute('autopictureinpicture', '')
  // Tiene que estar en el DOM (no display:none) para poder pedir PiP. Con su tamaño real (no 2×2): Android
  // toma de ahí la proporción de la ventana y, si no coincide con el video, lo estira.
  Object.assign(
    video.style,
    isIOS()
      ? { position: 'fixed', left: '0', bottom: '0', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' }
      : { position: 'fixed', left: '-9999px', top: '0', width: `${start.w}px`, height: `${start.h}px`, pointerEvents: 'none' },
  )
  if (iosMode) {
    video.preload = 'auto'
    video.src = `${import.meta.env.BASE_URL}descanso.mp4`
  }
  document.body.appendChild(video)

  video.addEventListener('enterpictureinpicture', (e) => {
    watchWindow((e as PictureInPictureEvent).pictureInPictureWindow)
    emit()
  })
  video.addEventListener('leavepictureinpicture', () => {
    openedByLeave = false
    emit()
  })
  // iPhone: los mismos avisos, con el evento de Safari.
  video.addEventListener('webkitpresentationmodechanged', () => {
    if ((video as WebkitVideo).webkitPresentationMode !== 'picture-in-picture') openedByLeave = false
    emit()
  })
  // El ⏯ de la ventanita pausa el video: lo usamos para pausar el cronómetro y lo
  // volvemos a reproducir enseguida (un video pausado deja la ventana congelada).
  video.addEventListener('pause', () => {
    if (pausingOurselves || !isPiPOpen()) return
    run(frame?.controls.playPause)
    void video?.play().catch(() => {})
  })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Por si el navegador no usa el handler de arriba pero igual lo permite.
      if (autoOnLeave && video && !isPiPOpen()) {
        openedByLeave = true
        requestPiP().catch(() => {
          openedByLeave = false
        })
      }
    } else {
      // Android pausa los videos sin sonido en segundo plano: al volver, que siga.
      if (stream && video?.paused) void video.play().catch(() => {})
      // Si se abrió sola al salir, al volver a la app se cierra sola.
      if (openedByLeave && isPiPOpen()) exitPiP()
    }
  })
}

const PLACEHOLDER: PipFrame = {
  theme: 'dark',
  kicker: '653',
  big: '653',
  unit: '',
  title: 'GYM & FITNESS',
  sub: '',
  ring: null,
  countdown: null,
  paused: false,
  controls: { next: null, prev: null, playPause: null, legend: '' },
}

let adaptations = 0
let watched: PictureInPictureWindow | null = null

/** Redimensiona el lienzo a la proporción de la ventana flotante (si no, el navegador estira el dibujo). */
function adaptTo(win: PictureInPictureWindow | null | undefined) {
  if (!win || !canvas || !ctx || !win.width || !win.height) return
  const want = canvasSizeFor(win.width / win.height)
  const ratioNow = canvas.width / canvas.height
  const ratioWant = want.w / want.h
  // Con diferencias chicas no se toca (evita que la ventana y el lienzo se persigan).
  if (Math.abs(ratioNow - ratioWant) / ratioWant < 0.03 || adaptations >= 6) return
  adaptations++
  canvas.width = want.w
  canvas.height = want.h
  drawFrame(ctx, frame ?? PLACEHOLDER)
}

function watchWindow(win: PictureInPictureWindow | undefined) {
  if (!win) return
  adaptations = 0
  adaptTo(win)
  if (watched === win) return
  watched = win
  win.addEventListener('resize', () => adaptTo(win))
}

async function ensureStream() {
  ensureElements()
  if (iosMode) {
    if (video && video.readyState < 1) {
      await new Promise<void>((resolve) => {
        const done = () => resolve()
        video!.addEventListener('loadedmetadata', done, { once: true })
        setTimeout(done, 3000)
      })
    }
    syncIOS(frame ?? PLACEHOLDER)
    return
  }
  if (!stream && canvas && video) {
    stream = canvas.captureStream(4)
    video.srcObject = stream
  }
  // El stream solo manda un cuadro cuando el canvas se pinta: sin esto el video queda vacío y Chrome
  // rechaza abrir la ventana ("metadata not loaded").
  if (ctx) drawFrame(ctx, frame ?? PLACEHOLDER)
  if (video?.paused) await video.play()
  if (video && video.readyState < 1) {
    await new Promise<void>((resolve) => {
      const done = () => resolve()
      video!.addEventListener('loadedmetadata', done, { once: true })
      setTimeout(done, 1000)
    })
  }
}

/** Último motivo por el que el navegador no abrió la ventana (para el diagnóstico del Perfil). */
export let lastPiPError: string | null = null

/** Dibuja el estado actual. Barato: se puede llamar en cada tick. */
export function renderPiP(f: PipFrame) {
  ensureElements()
  frame = f
  if (iosMode) syncIOS(f)
  else if (ctx) drawFrame(ctx, f)
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
  cancelPendingDisarm()
  autoOnLeave = autoOpenOnLeave
  try {
    await ensureStream()
  } catch {
    /* sin video: no hay ventana flotante */
  }
}

let disarmTimer: ReturnType<typeof setTimeout> | null = null
function cancelPendingDisarm() {
  if (disarmTimer !== null) clearTimeout(disarmTimer)
  disarmTimer = null
}

/**
 * Apagado diferido: al desmontar la pantalla del entreno. Si enseguida se vuelve a armar (React en
 * desarrollo monta dos veces; la pantalla se reemplaza por otra del entreno), no se cierra nada.
 */
export function disarmPiPSoon() {
  cancelPendingDisarm()
  disarmTimer = setTimeout(() => {
    disarmTimer = null
    disarmPiP()
  }, 300)
}

export function disarmPiP() {
  cancelPendingDisarm()
  autoOnLeave = false
  // Sin cuadro, el 'pause' que dispara video.pause() de abajo no ejecuta ningún comando.
  frame = null
  exitPiP()
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  if (video) {
    pausingOurselves = true
    video.pause()
    pausingOurselves = false
    if (!iosMode) video.srcObject = null
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
  if (!isPiPSupported()) {
    lastPiPError = 'Este navegador no permite ventanas flotantes.'
    return false
  }
  try {
    await ensureStream()
    if (!isPiPOpen()) {
      openedByLeave = false
      await requestPiP()
    }
    lastPiPError = null
    return true
  } catch (e) {
    lastPiPError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    return false
  }
}

/** iPhone: deja el video cargado de antemano, así al tocar "Probar" o el botón flotante abre sin esperar. */
export function preparePiP() {
  if (!isPiPSupported()) return
  ensureElements()
  if (iosMode) video?.load()
}

export function closePiP() {
  exitPiP()
}
