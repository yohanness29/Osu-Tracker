import { TAG_DESCRIPTIONS } from './mapTags'
import { styleGroupOf } from './styleGroups'

const SHOWN_TAGS = 3

/** The main style stands out with a tinted background, the tags only with their outline. */
function mainStyleColors(style: string): React.CSSProperties {
  const { color } = styleGroupOf(style)
  return { color, backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)` }
}

function tagColors(tag: string): React.CSSProperties {
  const { color } = styleGroupOf(tag)
  return { color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }
}

/** The main style of a map, then what else stands out in it. */
export function MapStyle(props: {
  style: string | null
  tags: string[]
  /** Tags shown before the others are summed up. */
  limit?: number
}): React.JSX.Element | null {
  const { style, tags, limit = SHOWN_TAGS } = props
  if (!style && tags.length === 0) return null

  const shown = tags.slice(0, limit)
  const hidden = tags.slice(limit)

  return (
    <>
      {style && (
        <span
          title={styleGroupOf(style).meaning}
          className="shrink-0 rounded px-1.5 py-0.5 font-semibold"
          style={mainStyleColors(style)}
        >
          {style}
        </span>
      )}
      {shown.map((tag) => (
        <span
          key={tag}
          title={[TAG_DESCRIPTIONS[tag], styleGroupOf(tag).meaning].filter(Boolean).join('\n')}
          className="shrink-0 rounded border px-1.5 py-0.5"
          style={tagColors(tag)}
        >
          {tag}
        </span>
      ))}
      {hidden.length > 0 && (
        <span title={hidden.join(', ')} className="shrink-0 text-ink-soft">
          +{hidden.length}
        </span>
      )}
    </>
  )
}
