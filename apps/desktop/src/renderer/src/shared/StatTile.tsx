export function StatTile(props: {
  label: string
  value: string
  hint?: string
}): React.JSX.Element {
  return (
    <div className="rounded-xl bg-panel/80 p-4 backdrop-blur-sm">
      <div className="text-xs font-medium text-ink-soft">{props.label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{props.value}</div>
      {props.hint && <div className="mt-0.5 text-xs text-ink-faint">{props.hint}</div>}
    </div>
  )
}
