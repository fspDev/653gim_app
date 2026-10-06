import { useCallback, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * A qué posición va el elemento `from` si su centro está a la altura `y`.
 * `mids`: centro vertical de cada elemento al empezar a arrastrar. Función pura (se testea).
 */
export function targetIndex(mids: number[], from: number, y: number): number {
  let n = 0
  for (let i = 0; i < mids.length; i++) if (i !== from && mids[i] < y) n++
  return n
}

interface DragState {
  from: number
  to: number
  /** Cuánto se movió el dedo o el mouse desde que agarró. */
  dy: number
  /** Alto del elemento arrastrado más el espacio entre elementos: lo que se corren los demás. */
  step: number
}

/**
 * Ordenar una lista arrastrando de una manija. Anda con mouse y con el dedo (pointer events, no el arrastre
 * nativo, que en el celular no funciona). Los demás elementos se corren mientras tanto; al soltar, `onMove`.
 */
export function useDragSort<T extends HTMLElement>(onMove: (from: number, to: number) => void) {
  const listRef = useRef<T>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  const handleProps = useCallback(
    (index: number) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.button !== 0 || !listRef.current) return
        const items = [...listRef.current.children] as HTMLElement[]
        const rects = items.map((el) => el.getBoundingClientRect())
        const mids = rects.map((r) => r.top + r.height / 2)
        const gap = rects.length > 1 ? (index < rects.length - 1 ? rects[index + 1].top - rects[index].bottom : rects[index].top - rects[index - 1].bottom) : 0
        const step = rects[index].height + Math.max(0, gap)
        const handle = e.currentTarget
        const y0 = e.clientY
        let to = index
        handle.setPointerCapture(e.pointerId)
        e.preventDefault()
        setDrag({ from: index, to, dy: 0, step })

        const move = (ev: PointerEvent) => {
          const dy = ev.clientY - y0
          to = targetIndex(mids, index, mids[index] + dy)
          setDrag({ from: index, to, dy, step })
        }
        const end = (commit: boolean) => () => {
          handle.removeEventListener('pointermove', move)
          handle.removeEventListener('pointerup', onUp)
          handle.removeEventListener('pointercancel', onCancel)
          setDrag(null)
          if (commit && to !== index) onMove(index, to)
        }
        const onUp = end(true)
        const onCancel = end(false)
        handle.addEventListener('pointermove', move)
        handle.addEventListener('pointerup', onUp)
        handle.addEventListener('pointercancel', onCancel)
      },
    }),
    [onMove],
  )

  /** Cómo se ve el elemento `index` mientras se arrastra (el agarrado sigue al dedo; los demás le hacen lugar). */
  const itemStyle = (index: number): CSSProperties | undefined => {
    if (!drag) return undefined
    if (index === drag.from) return { transform: `translateY(${drag.dy}px)`, position: 'relative', zIndex: 2, transition: 'none' }
    let shift = 0
    if (drag.from < drag.to && index > drag.from && index <= drag.to) shift = -drag.step
    if (drag.to < drag.from && index >= drag.to && index < drag.from) shift = drag.step
    return { transform: shift ? `translateY(${shift}px)` : undefined, transition: 'transform 150ms ease' }
  }

  return { listRef, dragging: drag?.from ?? null, handleProps, itemStyle }
}
