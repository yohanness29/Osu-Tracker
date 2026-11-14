/** A small drawing of each mode, in the color of the text around it. */
export function ModeIcon(props: { mode: string; className?: string }): React.JSX.Element | null {
  const shape = SHAPES[props.mode]
  if (!shape) return null
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={props.className ?? 'size-4'}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      {shape}
    </svg>
  )
}

const SHAPES: Record<string, React.JSX.Element> = {
  // A hit circle and its approach ring.
  osu: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  // The face of a drum: centre and rim.
  taiko: (
    <>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.25a3.75 3.75 0 0 0 0 7.5z" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="3.75" />
    </>
  ),
  // A falling fruit and its leaf.
  fruits: (
    <>
      <circle cx="8" cy="10" r="4.75" fill="currentColor" stroke="none" />
      <path d="M8 5.5c0-2 1.25-3.5 3.5-4" strokeLinecap="round" />
    </>
  ),
  // Notes falling in their columns.
  mania: (
    <g fill="currentColor" stroke="none">
      <rect x="1.5" y="9" width="2.5" height="5.5" rx="0.75" />
      <rect x="5" y="2" width="2.5" height="4" rx="0.75" />
      <rect x="8.5" y="6.5" width="2.5" height="8" rx="0.75" />
      <rect x="12" y="1.5" width="2.5" height="5" rx="0.75" />
    </g>
  )
}
