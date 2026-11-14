import { ModeIcon } from './ModeIcon'
import { modeLabel } from './modes'

export function ModeBadge({ mode }: { mode: string }): React.JSX.Element {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-panel-raised px-1.5 py-0.5 text-xs font-semibold text-ink">
      <ModeIcon mode={mode} className="size-3" />
      {modeLabel(mode)}
    </span>
  )
}
