import { useRef, useState } from 'react'

type DragStart = { x: number; y: number; left: number; top: number; pointerId: number }

/**
 * Moves a scrolled area by dragging it with the mouse, like a map. Spread the handlers on the
 * element that scrolls.
 */
export function useDragScroll(): {
  dragging: boolean
  handlers: Pick<
    React.HTMLAttributes<HTMLElement>,
    'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
  >
} {
  const start = useRef<DragStart | null>(null)
  const [dragging, setDragging] = useState(false)

  const stop = (event: React.PointerEvent<HTMLElement>): void => {
    if (!start.current) return
    event.currentTarget.releasePointerCapture(start.current.pointerId)
    start.current = null
    setDragging(false)
  }

  return {
    dragging,
    handlers: {
      onPointerDown: (event) => {
        // The left button only, and only with a mouse: touch screens already scroll.
        if (event.button !== 0 || event.pointerType !== 'mouse') return
        const element = event.currentTarget
        start.current = {
          x: event.clientX,
          y: event.clientY,
          left: element.scrollLeft,
          top: element.scrollTop,
          pointerId: event.pointerId
        }
        element.setPointerCapture(event.pointerId)
        setDragging(true)
      },
      onPointerMove: (event) => {
        if (!start.current) return
        const element = event.currentTarget
        element.scrollLeft = start.current.left - (event.clientX - start.current.x)
        element.scrollTop = start.current.top - (event.clientY - start.current.y)
      },
      onPointerUp: stop,
      onPointerCancel: stop
    }
  }
}
