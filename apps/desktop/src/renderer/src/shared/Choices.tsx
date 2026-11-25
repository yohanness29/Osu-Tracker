/** A row of buttons where one is chosen. */
export function Choices<T>(props: {
  label: string
  value: T
  choices: { value: T; label: string }[]
  onChange: (value: T) => void
}): React.JSX.Element {
  return (
    <div
      className="flex w-fit gap-0.5 rounded-lg bg-panel-raised p-0.5 text-sm"
      role="radiogroup"
      aria-label={props.label}
    >
      {props.choices.map(({ value, label }) => (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={props.value === value}
          onClick={() => props.onChange(value)}
          className={`min-w-9 rounded-md px-2 py-1 tabular-nums ${
            props.value === value
              ? 'bg-accent font-semibold text-on-accent'
              : 'text-ink-soft hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
