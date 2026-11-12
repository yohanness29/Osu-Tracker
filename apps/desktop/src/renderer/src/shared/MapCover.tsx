import { useState } from 'react'

const COVERS_URL = 'https://assets.ppy.sh/beatmaps'
// Invisible at its left edge, fully shown from the middle.
const FADE_IN = 'linear-gradient(to right, transparent, black 55%)'

export function MapCover(props: {
  beatmapsetId: number
  variant: 'list' | 'card'
  className: string
  /** Fades in from the left, for a cover placed on the right part of a card. */
  fadeIn?: boolean
}): React.JSX.Element {
  const { beatmapsetId, variant, className, fadeIn = false } = props
  const [failed, setFailed] = useState(false)

  // Maps that are not on the website have no cover.
  if (failed || beatmapsetId <= 0) {
    return <div className={`bg-panel-raised ${className}`} />
  }

  return (
    <img
      src={`${COVERS_URL}/${beatmapsetId}/covers/${variant}@2x.jpg`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
      style={fadeIn ? { maskImage: FADE_IN, WebkitMaskImage: FADE_IN } : undefined}
    />
  )
}
