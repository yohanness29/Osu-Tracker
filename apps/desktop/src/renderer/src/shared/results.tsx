import type { PlayResult } from '@osu-tracker/shared'
import type { ResultCounts } from '@osu-tracker/storage'

// Stacking order matters: neighbours were validated for colour blindness in this order.
const RESULTS: { key: PlayResult; label: string; icon: string; color: string; text: string }[] = [
  { key: 'passed', label: 'Pass', icon: '✓', color: 'bg-passed', text: 'border-passed' },
  { key: 'failed', label: 'Fail', icon: '✕', color: 'bg-failed', text: 'border-failed' },
  { key: 'quit', label: 'Quit', icon: '→', color: 'bg-quit', text: 'border-quit' },
  { key: 'retried', label: 'Retry', icon: '↻', color: 'bg-retried', text: 'border-retried' }
]

// Retries are a counter and quits are left out: only finished plays say something.
const FINISHED_RESULTS = RESULTS.filter(({ key }) => key === 'passed' || key === 'failed')

export function ResultBadge({ result }: { result: PlayResult }): React.JSX.Element {
  const { icon, label, text } = RESULTS.find(({ key }) => key === result)!
  return (
    <span
      className={`inline-flex w-20 items-center gap-1.5 rounded-md border-l-[3px] bg-panel-raised px-2 py-1 text-xs font-semibold text-ink ${text}`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  )
}

export function ResultBar({ counts }: { counts: ResultCounts }): React.JSX.Element {
  const total = FINISHED_RESULTS.reduce((sum, { key }) => sum + counts[key], 0)

  return (
    <div className="flex h-2 gap-0.5" role="img" aria-label={resultsLabel(counts)}>
      {total === 0 && <div className="flex-1 rounded-sm bg-panel-raised" />}
      {FINISHED_RESULTS.filter(({ key }) => counts[key] > 0).map(({ key, label, color }) => (
        <div
          key={key}
          className={`${color} rounded-sm first:rounded-l last:rounded-r`}
          style={{ flexGrow: counts[key] }}
          title={`${label} : ${counts[key]}`}
        />
      ))}
    </div>
  )
}

export function ResultLegend({ counts }: { counts: ResultCounts }): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
      {FINISHED_RESULTS.map(({ key, label, color }) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span className={`size-2 rounded-sm ${color}`} />
          {label} <span className="font-semibold text-ink tabular-nums">{counts[key]}</span>
        </span>
      ))}
      {counts.retried > 0 && (
        <span className="font-semibold text-ink tabular-nums">{counts.retried} retry</span>
      )}
    </div>
  )
}

function resultsLabel(counts: ResultCounts): string {
  return FINISHED_RESULTS.map(({ key, label }) => `${label} ${counts[key]}`).join(', ')
}
