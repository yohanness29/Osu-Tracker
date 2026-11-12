import { useState } from 'react'
import { typedValue } from './sliderValue'

const THUMB =
  'pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent ' +
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 ' +
  '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none ' +
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 ' +
  '[&::-webkit-slider-thumb]:border-page [&::-webkit-slider-thumb]:bg-accent'

/** A value shown as text, which turns into a field when clicked. Enter or leaving keeps it. */
function EditableValue(props: {
  label: string
  value: number
  format: (value: number) => string
  /** Null when the text is not a number: the value then stays as it was. */
  parse: (text: string) => number | null
  onCommit: (value: number) => void
  align: 'left' | 'right'
}): React.JSX.Element {
  const { label, value, format, parse, onCommit, align } = props
  const [editing, setEditing] = useState<string | null>(null)
  const alignment = align === 'right' ? 'text-right' : 'text-left'

  const commit = (): void => {
    const parsed = editing === null ? null : parse(editing)
    if (parsed !== null) onCommit(parsed)
    setEditing(null)
  }

  if (editing !== null) {
    return (
      <input
        autoFocus
        aria-label={label}
        value={editing}
        onChange={(event) => setEditing(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') setEditing(null)
        }}
        className={`w-14 rounded bg-panel-raised px-1 font-medium tabular-nums outline-1 outline-accent ${alignment}`}
      />
    )
  }

  return (
    <button
      type="button"
      title="Cliquer pour saisir la valeur"
      aria-label={`${label} : ${format(value)}, cliquer pour la saisir`}
      onClick={() => setEditing(String(Number(value.toFixed(2))))}
      className={`w-14 cursor-text rounded px-1 font-medium tabular-nums hover:bg-panel-raised ${alignment}`}
    >
      {format(value)}
    </button>
  )
}

/** Two handles on one track: the lowest and highest accepted values. */
export function RangeSlider(props: {
  label: string
  min: number
  max: number
  step: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  format: (value: number) => string
  /** Takes the whole width given to it instead of a fixed one. */
  wide?: boolean
}): React.JSX.Element {
  const { label, min, max, step, value, onChange, format, wide = false } = props
  const [low, high] = value
  const span = max - min || 1
  const left = ((low - min) / span) * 100
  const right = ((high - min) / span) * 100

  return (
    <div className="flex items-center gap-3 rounded-md bg-panel px-3 py-1.5 text-sm">
      <span className={`text-ink-soft ${wide ? 'w-14' : ''}`}>{label}</span>
      <EditableValue
        label={`${label} minimum`}
        value={low}
        format={format}
        parse={(text) => typedValue(text, { min, max, step }, [min, high])}
        onCommit={(typed) => onChange([typed, high])}
        align="right"
      />
      <div className={`relative h-4 ${wide ? 'min-w-24 flex-1' : 'w-48'}`}>
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-panel-raised" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-accent"
          style={{ left: `${left}%`, width: `${right - left}%` }}
        />
        <input
          type="range"
          aria-label={`${label} minimum`}
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={(event) => onChange([Math.min(Number(event.target.value), high), high])}
          className={THUMB}
        />
        <input
          type="range"
          aria-label={`${label} maximum`}
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={(event) => onChange([low, Math.max(Number(event.target.value), low)])}
          className={THUMB}
        />
      </div>
      <EditableValue
        label={`${label} maximum`}
        value={high}
        format={format}
        parse={(text) => typedValue(text, { min, max, step }, [low, max])}
        onCommit={(typed) => onChange([low, typed])}
        align="left"
      />
    </div>
  )
}
