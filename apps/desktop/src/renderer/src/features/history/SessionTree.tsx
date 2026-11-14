import { useMemo, useState } from 'react'
import type { SessionSummary } from '@osu-tracker/storage'
import { buildTree, dayKey } from './sessions'
import { onActionMenu } from '../../shared/actionMenuStore'
import { sessionActions } from './sessionActions'

type TreeProps = {
  sessions: SessionSummary[]
  selectedId: string
  onSelect: (sessionId: string) => void
}

function Folder(props: {
  label: string
  depth: number
  open: boolean
  hint?: string
  onToggle: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <li>
      <button
        onClick={props.onToggle}
        aria-expanded={props.open}
        style={{ paddingLeft: props.depth * 14 + 8 }}
        className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm hover:bg-panel-raised"
      >
        <span aria-hidden className={`text-xs text-ink-faint ${props.open ? 'rotate-90' : ''}`}>
          ▸
        </span>
        <span className="truncate font-medium">{props.label}</span>
        {props.hint && (
          <span className="ml-auto shrink-0 text-xs text-ink-faint tabular-nums">{props.hint}</span>
        )}
      </button>
      {props.open && <ul>{props.children}</ul>}
    </li>
  )
}

function SessionItem(props: {
  session: SessionSummary
  number: number
  depth: number
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const { session, number, depth, selected, onSelect } = props

  return (
    <li>
      <button
        onClick={onSelect}
        onContextMenu={onActionMenu(sessionActions(session.id))}
        title="Clic droit pour exporter"
        aria-current={selected}
        style={{ paddingLeft: depth * 14 + 22 }}
        className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm ${
          selected ? 'bg-accent font-semibold text-page' : 'text-ink-soft hover:bg-panel-raised'
        }`}
      >
        <span className="truncate">{session.name ?? `Session ${number}`}</span>
        <span className="ml-auto shrink-0 text-xs tabular-nums opacity-80">
          {session.plays} play{session.plays > 1 ? 's' : ''}
        </span>
      </button>
    </li>
  )
}

export function SessionTree({ sessions, selectedId, onSelect }: TreeProps): React.JSX.Element {
  const tree = useMemo(() => buildTree(sessions), [sessions])
  const [toggled, setToggled] = useState(new Map<string, boolean>())

  const selected = sessions.find(({ id }) => id === selectedId)
  const selectedDay = selected ? dayKey(selected.startedAt) : ''
  const isOpen = (key: string): boolean => toggled.get(key) ?? selectedDay.startsWith(key)
  const toggle = (key: string): void => setToggled(new Map(toggled).set(key, !isOpen(key)))

  return (
    <ul>
      {tree.map((year) => (
        <Folder
          key={year.key}
          label={year.label}
          depth={0}
          open={isOpen(year.key)}
          onToggle={() => toggle(year.key)}
        >
          {year.children.map((month) => (
            <Folder
              key={month.key}
              label={month.label}
              depth={1}
              open={isOpen(month.key)}
              onToggle={() => toggle(month.key)}
            >
              {month.children.map((day) => (
                <Folder
                  key={day.key}
                  label={day.label}
                  depth={2}
                  hint={String(day.children.length)}
                  open={isOpen(day.key)}
                  onToggle={() => toggle(day.key)}
                >
                  {day.children.map((session, index) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      number={day.children.length - index}
                      depth={2}
                      selected={session.id === selectedId}
                      onSelect={() => onSelect(session.id)}
                    />
                  ))}
                </Folder>
              ))}
            </Folder>
          ))}
        </Folder>
      ))}
    </ul>
  )
}
