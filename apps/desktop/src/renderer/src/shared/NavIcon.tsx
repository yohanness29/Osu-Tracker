/** The icons of the navigation, shown alone when it is folded. */
export function NavIcon(props: { name: string; className?: string }): React.JSX.Element | null {
  const shape = SHAPES[props.name]
  if (!shape) return null
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={props.className ?? 'size-5'}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shape}
    </svg>
  )
}

const SHAPES: Record<string, React.JSX.Element> = {
  // A live dot and its waves.
  live: (
    <>
      <circle cx="10" cy="10" r="2" fill="currentColor" />
      <path d="M6.5 6.5a5 5 0 0 0 0 7M13.5 6.5a5 5 0 0 1 0 7M4 4a8.5 8.5 0 0 0 0 12M16 4a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  // A clock.
  history: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2" />
    </>
  ),
  // Stacked maps.
  maps: (
    <>
      <rect x="3" y="4" width="14" height="4" rx="1" />
      <rect x="3" y="12" width="14" height="4" rx="1" />
    </>
  ),
  // Bars of a chart.
  analysis: <path d="M4 16V10M8 16V5M12 16V8M16 16V3" />,
  // A star.
  suggestions: <path d="m10 3 2.1 4.4 4.8.6-3.5 3.3.9 4.7L10 13.7 5.7 16l.9-4.7L3.1 8l4.8-.6z" />,
  // A list with a play mark.
  playlists: <path d="M3 5h10M3 10h10M3 15h6M13 13v5l4-2.5z" />,
  // A person.
  profile: (
    <>
      <circle cx="10" cy="7" r="3.5" />
      <path d="M3.5 17a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  // Sliders.
  settings: (
    <>
      <path d="M3 6h14M3 14h14" />
      <circle cx="7" cy="6" r="2" fill="var(--color-panel-raised)" />
      <circle cx="13" cy="14" r="2" fill="var(--color-panel-raised)" />
    </>
  ),
  // A trophy.
  tournaments: (
    <path d="M6 3h8v5a4 4 0 0 1-8 0zM6 5H3.5a2.5 2.5 0 0 0 2.7 3.5M14 5h2.5a2.5 2.5 0 0 1-2.7 3.5M10 12v3M7 17h6" />
  )
}
