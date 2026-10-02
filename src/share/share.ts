import { toBlob } from 'html-to-image'
import { STORY_HEIGHT, STORY_WIDTH } from './StoryCard'

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

const isSafari = () => /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)

/** Saca la tarjeta como PNG de 1080×1920. */
export async function renderStory(node: HTMLElement): Promise<Blob> {
  // Que las tipografías estén cargadas antes de dibujar, o la imagen sale con la letra de reemplazo.
  await Promise.allSettled([document.fonts.load('200px Anton'), document.fonts.load('800 40px "Barlow Condensed"'), document.fonts.load('600 44px Inter')])
  await document.fonts.ready

  const options = { width: STORY_WIDTH, height: STORY_HEIGHT, pixelRatio: 1, cacheBust: true }
  // Safari dibuja mal la primera vez (fuentes e imágenes sin cargar): la primera pasada se descarta.
  if (isSafari()) await toBlob(node, options)
  const blob = await toBlob(node, options)
  if (!blob) throw new Error('No se pudo generar la imagen.')
  return blob
}

/**
 * Comparte la imagen con la hoja nativa (Web Share con archivos).
 * Si el navegador no puede compartir archivos, la descarga.
 */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: 'image/png' })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (e) {
      // Cerrar la hoja de compartir no es un error.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Cualquier otra falla del share: cae a la descarga.
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
