/** An on/off switch: the knob slides to the right and the track takes the accent color. */
export function Switch(props: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
}): React.JSX.Element {
  const { checked, onChange, disabled, label } = props
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
        checked ? 'bg-accent' : 'bg-line'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block size-5 rounded-full bg-ink shadow transition-transform ${
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
