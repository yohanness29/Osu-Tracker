import type { RecentPlay, SessionSummary } from '@osu-tracker/storage'
import { MODES } from '../../shared/modes'

export type TreeNode<Child> = { key: string; label: string; children: Child[] }
export type DayNode = TreeNode<SessionSummary>
export type MonthNode = TreeNode<DayNode>
export type YearNode = TreeNode<MonthNode>

export type CalendarDay = { key: string; day: number; sessions: SessionSummary[] }

export type Share = { label: string; percent: number }

export type ModeShare = Share & { key: string; maps: number }

export type SessionStats = {
  averageAccuracy: number | null
  bestPp: number | null
  averageStars: number | null
  averageAr: number | null
  hitError: number | null
  n100: number
  n50: number
  misses: number
  modes: ModeShare[]
  mods: Share[]
}

export function dayKey(timestamp: number): string {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function groupNodes<Item, Child>(
  items: Item[],
  keyOf: (item: Item) => string,
  labelOf: (item: Item) => string,
  childrenOf: (items: Item[]) => Child[]
): TreeNode<Child>[] {
  return [...Map.groupBy(items, keyOf)].map(([key, group]) => ({
    key,
    label: labelOf(group[0]!),
    children: childrenOf(group)
  }))
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Sessions must be sorted, latest first. */
export function buildTree(sessions: SessionSummary[]): YearNode[] {
  const format = (timestamp: number, options: Intl.DateTimeFormatOptions): string =>
    capitalize(new Date(timestamp).toLocaleDateString('fr-FR', options))

  return groupNodes(
    sessions,
    (session) => dayKey(session.startedAt).slice(0, 4),
    (session) => String(new Date(session.startedAt).getFullYear()),
    (yearSessions) =>
      groupNodes(
        yearSessions,
        (session) => dayKey(session.startedAt).slice(0, 7),
        (session) => format(session.startedAt, { month: 'long' }),
        (monthSessions) =>
          groupNodes(
            monthSessions,
            (session) => dayKey(session.startedAt),
            (session) => format(session.startedAt, { weekday: 'long', day: 'numeric' }),
            (daySessions) => daySessions
          )
      )
  )
}

/** Weeks of a month, Monday first. Cells outside the month are null. */
export function buildMonth(
  year: number,
  month: number,
  sessions: SessionSummary[]
): (CalendarDay | null)[][] {
  const byDay = Map.groupBy(sessions, (session) => dayKey(session.startedAt))
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingCells = (new Date(year, month, 1).getDay() + 6) % 7

  const cells: (CalendarDay | null)[] = Array.from({ length: leadingCells }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dayKey(new Date(year, month, day).getTime())
    cells.push({ key, day, sessions: byDay.get(key) ?? [] })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
}

export type MapAttempt = {
  /** The play that ended the attempts, or the last retry if the map was never finished. */
  play: RecentPlay
  retries: number
}

function isFinished({ result }: RecentPlay): boolean {
  return result === 'passed' || result === 'failed'
}

/**
 * Groups the plays of a session by map, latest first. Consecutive tries on a map end on its
 * pass or fail. Tries left without a retry or a result say nothing and are dropped.
 */
export function groupAttempts(plays: RecentPlay[]): MapAttempt[] {
  const attempts: MapAttempt[] = []
  let current: MapAttempt | null = null

  for (const play of plays.toSorted((a, b) => a.startedAt - b.startedAt)) {
    const previous: MapAttempt | null = current
    const sameMap =
      previous?.play.beatmapChecksum === play.beatmapChecksum && previous.play.mode === play.mode

    if (previous && !sameMap && previous.retries > 0) attempts.push(previous)

    const retries = (sameMap ? previous!.retries : 0) + (play.result === 'retried' ? 1 : 0)
    const shown = play.result === 'quit' && sameMap ? previous!.play : play

    if (isFinished(play)) {
      attempts.push({ play, retries })
      current = null
    } else {
      current = { play: shown, retries }
    }
  }

  if (current && current.retries > 0) attempts.push(current)

  return attempts.reverse()
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function shares(entries: [string, number][]): Share[] {
  const totals = new Map<string, number>()
  for (const [label, value] of entries) totals.set(label, (totals.get(label) ?? 0) + value)

  const total = [...totals.values()].reduce((sum, value) => sum + value, 0)
  if (total === 0) return []

  return [...totals]
    .map(([label, value]) => ({ label, percent: Math.round((value / total) * 100) }))
    .sort((a, b) => b.percent - a.percent)
}

/** Every mode, played or not, with its share of the playing time. */
function modeShares(plays: RecentPlay[]): ModeShare[] {
  const duration = (play: RecentPlay): number => play.endedAt - play.startedAt
  const total = plays.reduce((sum, play) => sum + duration(play), 0)

  return MODES.map(({ key, label }) => {
    const modePlays = plays.filter((play) => play.mode === key)
    const time = modePlays.reduce((sum, play) => sum + duration(play), 0)

    return {
      key,
      label,
      percent: total > 0 ? Math.round((time / total) * 100) : 0,
      maps: new Set(modePlays.map((play) => play.beatmapChecksum)).size
    }
  })
}

export function computeStats(plays: RecentPlay[]): SessionStats {
  // A play left before the first object says nothing about the player.
  const played = plays.filter((play) => play.score > 0)
  const passed = played.filter((play) => play.result === 'passed')

  return {
    averageAccuracy: average(passed.map((play) => play.accuracy)),
    bestPp: passed.length > 0 ? Math.max(...passed.map((play) => play.pp)) : null,
    averageStars: average(played.map((play) => play.stars)),
    averageAr: average(played.map((play) => play.ar)),
    hitError: average(played.flatMap(({ hitError }) => hitError ?? [])),
    n100: played.reduce((sum, play) => sum + play.n100, 0),
    n50: played.reduce((sum, play) => sum + play.n50, 0),
    misses: played.reduce((sum, play) => sum + play.misses, 0),
    modes: modeShares(played),
    mods: shares(played.map((play) => [play.mods || 'NM', 1]))
  }
}
