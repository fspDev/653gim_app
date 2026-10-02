import { getSettings } from '../settings'

function vibrate(pattern: number | number[]) {
  if (!getSettings().vibracion) return
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

let ctx: AudioContext | null = null

/** El navegador solo deja sonar audio después de un toque: se llama desde HECHA. */
function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
  } catch {
    /* sin audio: queda la vibración */
  }
}

function beep(freq: number, ms: number) {
  if (!getSettings().sonido || !ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + ms / 1000 + 0.05)
}

/** Golpe corto al tocar HECHA. */
export const tap = () => {
  unlockAudio()
  vibrate(30)
}

/** Triple vibración en los últimos 3 s del descanso. */
export const warn = () => vibrate([80, 70, 80, 70, 80])

/** Terminó el descanso: vibración larga y un beep. */
export const restEnd = () => {
  vibrate(400)
  beep(880, 350)
}

/** Cambio de bloque. */
export const step = () => {
  vibrate([60, 50, 60])
  beep(660, 200)
}
