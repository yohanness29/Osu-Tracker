import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const MARGIN = 8

/**
 * A menu shown where the player right-clicked, kept inside the window: near an edge it opens
 * on the other side. Escape, a click elsewhere or leaving the window closes it.
 */
export function FloatingMenu(props: {
  x: number
  y: number
  onClose: () => void
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  const { x, y, onClose, className = 'w-72', children } = props
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!menu.current) return
    const { width, height } = menu.current.getBoundingClientRect()
    const left = Math.min(x, window.innerWidth - width - MARGIN)
    const top = y + height + MARGIN > window.innerHeight ? y - height : y
    setPosition({ left: Math.max(MARGIN, left), top: Math.max(MARGIN, top) })
  }, [x, y])

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent): void => {
      if (!menu.current?.contains(event.target as Node)) onClose()
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={menu}
      role="menu"
      onContextMenu={(event) => event.preventDefault()}
      style={position ?? { left: x, top: y, visibility: 'hidden' }}
      className={`fixed z-50 max-h-[70vh] overflow-y-auto rounded-lg border border-line bg-panel-raised p-1 text-sm shadow-xl ${className}`}
    >
      {children}
    </div>
  )
}
