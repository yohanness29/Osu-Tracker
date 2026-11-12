import { MODES } from './modes'

export function ModeFilter(props: {
  mode: string | null
  onChange: (mode: string | null) => void
  withAll?: boolean
}): React.JSX.Element {
  const { withAll = true } = props
  const options = withAll ? [{ key: null, label: 'Tous' }, ...MODES] : MODES

  return (
    <div className="flex shrink-0 gap-1 rounded-lg bg-panel p-1">
      {options.map(({ key, label }) => (
        <button
          key={label}
          onClick={() => props.onChange(key)}
          aria-pressed={props.mode === key}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            props.mode === key ? 'bg-panel-raised text-ink' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
