import { useMemo, useState } from 'react'
import type { SessionSummary } from '@osu-tracker/storage'
import { formatDuration } from '../../shared/format'
import { buildMonth, dayKey, type CalendarDay } from './sessions'

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MAX_ACCENT_PERCENT = 55

function playTime(sessions: SessionSummary[]): number {
  return sessions.reduce((sum, session) => sum + session.playTimeMs, 0)
}

function DayCell(props: {
  day: CalendarDay
  today: boolean
  maxPlayTime: number
  onOpen: (sessionId: string) => void
}): React.JSX.Element {
  const { day, today, maxPlayTime, onOpen } = props
  const time = playTime(day.sessions)
  const latest = day.sessions[0]
  const accent = Math.round(12 + (time / maxPlayTime) * (MAX_ACCENT_PERCENT - 12))
  const count = day.sessions.length

  if (!latest) {
    return (
      <div
        className={`h-20 rounded-lg bg-panel p-2 text-sm text-ink-faint tabular-nums ${
          today ? 'ring-1 ring-ink-soft' : ''
        }`}
      >
        {day.day}
      </div>
    )
  }

  return (
    <button
      onClick={() => onOpen(latest.id)}
      title={`${count} session${count > 1 ? 's' : ''} · ${formatDuration(time)}`}
      style={{
        background: `color-mix(in oklab, var(--color-accent) ${accent}%, var(--color-panel))`
      }}
      className={`flex h-20 flex-col rounded-lg p-2 text-left transition-transform hover:scale-[1.03] ${
        today ? 'ring-1 ring-ink' : ''
      }`}
    >
      <span className="text-sm font-bold tabular-nums">{day.day}</span>
      <span className="mt-auto text-xs font-medium tabular-nums">{formatDuration(time)}</span>
      <span className="text-xs text-ink tabular-nums">
        {count} session{count > 1 ? 's' : ''}
      </span>
    </button>
  )
}

export function CalendarView(props: {
  sessions: SessionSummary[]
  onOpen: (sessionId: string) => void
}): React.JSX.Element {
  const { sessions, onOpen } = props
  const [month, setMonth] = useState(() => {
    const date = new Date(sessions[0]?.startedAt ?? Date.now())
    return { year: date.getFullYear(), month: date.getMonth() }
  })

  const [todayKey] = useState(() => dayKey(Date.now()))

  const weeks = useMemo(() => buildMonth(month.year, month.month, sessions), [month, sessions])
  const days = weeks.flat().filter((cell) => cell !== null)
  const activeDays = days.filter((day) => day.sessions.length > 0)
  const maxPlayTime = Math.max(1, ...activeDays.map((day) => playTime(day.sessions)))
  const totalPlayTime = activeDays.reduce((sum, day) => sum + playTime(day.sessions), 0)

  const label = new Date(month.year, month.month).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  })
  const move = (offset: number): void => {
    const date = new Date(month.year, month.month + offset)
    setMonth({ year: date.getFullYear(), month: date.getMonth() })
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => move(-1)}
          aria-label="Mois précédent"
          className="size-9 rounded-lg bg-panel hover:bg-panel-raised"
        >
          ←
        </button>
        <button
          onClick={() => move(1)}
          aria-label="Mois suivant"
          className="size-9 rounded-lg bg-panel hover:bg-panel-raised"
        >
          →
        </button>
        <h2 className="ml-2 text-2xl font-bold first-letter:uppercase">{label}</h2>
        <span className="ml-auto text-sm text-ink-soft tabular-nums">
          {activeDays.length} jour{activeDays.length > 1 ? 's' : ''} joué
          {activeDays.length > 1 ? 's' : ''} · {formatDuration(totalPlayTime)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="px-2 text-xs font-medium text-ink-soft">
            {day}
          </div>
        ))}
        {weeks
          .flat()
          .map((cell, index) =>
            cell ? (
              <DayCell
                key={cell.key}
                day={cell}
                today={cell.key === todayKey}
                maxPlayTime={maxPlayTime}
                onOpen={onOpen}
              />
            ) : (
              <div key={`empty-${index}`} />
            )
          )}
      </div>
    </div>
  )
}
