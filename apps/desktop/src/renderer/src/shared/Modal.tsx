import { useEffect } from 'react'

/** A window over the page: closed by Escape, by a click beside it or by its button. */
export function Modal(props: {
  title: string
  onClose: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const { onClose } = props

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        // Only a click on the backdrop itself, not one that started inside the window.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{props.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mt-1 -mr-2 rounded-md px-2 py-1 text-ink-soft hover:bg-panel-raised hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{props.children}</div>
      </div>
    </div>
  )
}
