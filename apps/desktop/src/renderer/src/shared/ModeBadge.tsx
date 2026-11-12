import { MODES, modeLabel } from './modes'

export function ModeBadge({ mode }: { mode: string }): React.JSX.Element {
  const icon = MODES.find(({ key }) => key === mode)?.icon

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-panel-raised px-1.5 py-0.5 text-xs font-semibold text-ink">
      {icon && <span aria-hidden>{icon}</span>}
      {modeLabel(mode)}
    </span>
  )
}
