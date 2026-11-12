import { useEffect, useState } from 'react'

const CONFIRMATION_MS = 1500

export function CopyMapId({ beatmapId }: { beatmapId: number }): React.JSX.Element | null {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), CONFIRMATION_MS)
    return () => clearTimeout(timer)
  }, [copied])

  // Maps that are not on the website have no id.
  if (beatmapId <= 0) return null

  return (
    <button
      type="button"
      title="Copier l’ID de la map"
      onClick={(event) => {
        // Some cards are links to the page of the map.
        event.preventDefault()
        event.stopPropagation()
        window.api.copyText(String(beatmapId)).then(() => setCopied(true))
      }}
      className="shrink-0 rounded bg-panel-raised px-1.5 py-0.5 text-xs font-semibold text-ink-soft tabular-nums hover:text-ink"
    >
      {copied ? 'Copié ✓' : `ID ${beatmapId}`}
    </button>
  )
}
