import { useEffect, useRef, useState } from 'react'

export type DropdownOption = {
  value: string
  label: string
  /** Options sharing a group are shown together, under a header that folds them. */
  group?: string
  /** Shown as a dot before the option and its group. */
  color?: string
}

function summary(options: DropdownOption[], selected: string[], placeholder: string): string {
  const labels = options.filter(({ value }) => selected.includes(value)).map(({ label }) => label)
  return labels.length > 0 ? labels.join(', ') : placeholder
}

/** Null when no option has a group: the list is then shown flat. */
function groupOptions(
  options: DropdownOption[]
): { name: string; items: DropdownOption[] }[] | null {
  if (!options.some(({ group }) => group)) return null
  return [...Map.groupBy(options, ({ group }) => group ?? '')].map(([name, items]) => ({
    name,
    items
  }))
}

/** Picks several values, or one with `single`. Nothing selected shows the placeholder. */
export function Dropdown(props: {
  label: string
  placeholder: string
  options: DropdownOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  single?: boolean
  /** With `single`: a choice is always kept, it can only be replaced. */
  required?: boolean
  /** The label is only read by screen readers: the value is enough. */
  hideLabel?: boolean
  /** As wide as its container, its list too. */
  fill?: boolean
}): React.JSX.Element {
  const {
    label,
    placeholder,
    options,
    selected,
    onChange,
    single = false,
    required = false,
    hideLabel = false,
    fill = false
  } = props
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: MouseEvent): void => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const groups = groupOptions(options)
  // Families holding a choice start unfolded, so that it can be seen at once.
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const toggleList = (): void => {
    if (!open) {
      const chosen = options.filter(({ value }) => selected.includes(value))
      setOpenGroups([...new Set(chosen.flatMap(({ group }) => (group ? [group] : [])))])
    }
    setOpen(!open)
  }

  const renderOption = ({
    value,
    label: optionLabel,
    color
  }: DropdownOption): React.JSX.Element => {
    const isSelected = selected.includes(value)
    return (
      <button
        key={value || 'none'}
        type="button"
        aria-pressed={isSelected}
        onClick={() => toggle(value)}
        className={`mt-0.5 block w-full rounded-md px-3 py-1.5 text-left text-sm first:mt-0 ${
          isSelected ? 'bg-accent font-semibold text-on-accent' : 'text-ink hover:bg-line'
        }`}
      >
        {color && (
          <span
            aria-hidden
            className="mr-2 inline-block size-2 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
        {optionLabel}
      </button>
    )
  }

  const toggle = (value: string): void => {
    if (single) {
      onChange(selected.includes(value) && !required ? [] : [value])
      setOpen(false)
      return
    }
    onChange(
      selected.includes(value)
        ? selected.filter((current) => current !== value)
        : [...selected, value]
    )
  }

  return (
    <div ref={container} className={`relative ${fill ? 'w-full' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={hideLabel ? label : undefined}
        onClick={toggleList}
        className={`flex items-center gap-2 rounded-md bg-panel px-3 py-1.5 text-sm hover:bg-panel-raised ${
          fill ? 'w-full' : ''
        }`}
      >
        {!hideLabel && <span className="text-ink-soft">{label}</span>}
        <span className={`truncate font-medium text-ink ${fill ? 'flex-1 text-left' : 'max-w-44'}`}>
          {summary(options, selected, placeholder)}
        </span>
        <span aria-hidden className={`text-xs text-ink-soft ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {open && (
        <div
          className={`absolute left-0 z-20 mt-1 min-w-48 rounded-lg border border-line bg-panel-raised p-1 shadow-lg ${
            fill ? 'right-0' : ''
          }`}
        >
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-ink-soft">Rien à choisir pour l’instant.</p>
          )}
          {groups === null
            ? options.map(renderOption)
            : groups.map(({ name, items }) => {
                const isOpen = openGroups.includes(name)
                const chosen = items.filter(({ value }) => selected.includes(value)).length
                return (
                  <div key={name} className="mt-0.5 first:mt-0">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenGroups(
                          isOpen
                            ? openGroups.filter((group) => group !== name)
                            : [...openGroups, name]
                        )
                      }
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold tracking-wide text-ink-soft uppercase hover:text-ink"
                    >
                      <span
                        aria-hidden
                        className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      >
                        ▸
                      </span>
                      <span className="flex-1" style={{ color: items[0]?.color }}>
                        {name}
                      </span>
                      {chosen > 0 && (
                        <span className="rounded bg-accent px-1.5 text-on-accent normal-case">
                          {chosen}
                        </span>
                      )}
                    </button>
                    {isOpen && <div className="pl-3">{items.map(renderOption)}</div>}
                  </div>
                )
              })}
          {selected.length > 0 && !required && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-md border-t border-line px-2 py-1.5 text-left text-xs text-ink-soft hover:text-ink"
            >
              {placeholder}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
