// Reloj que no se congela: los timers de una página oculta se frenan (hasta 1 por minuto en Chrome),
// los de un worker no. Manda un tick por segundo mientras haya alguien escuchando.
let id: ReturnType<typeof setInterval> | null = null

self.onmessage = (e: MessageEvent<'start' | 'stop'>) => {
  if (e.data === 'start' && id === null) id = setInterval(() => self.postMessage(Date.now()), 1000)
  if (e.data === 'stop' && id !== null) {
    clearInterval(id)
    id = null
  }
}
