import {
  compareOpponent,
  slotCategory,
  slotTraining,
  type ModCategory,
  type OpponentComparison,
  type PlayerStanding,
  type Readiness
} from '@osu-tracker/stats'
import type { OpponentLevel, PlannedSlot } from '@osu-tracker/recommender'
import type { PoolMap, RecentPlay, TournamentPool } from '@osu-tracker/storage'
import type { TournamentData } from '../../../../main/tournaments'

export type TrainedSlot = PlannedSlot & { map: PoolMap }

/** Each map of a pool with what the training on it shows. */
export function trainedSlots(pool: TournamentPool, plays: RecentPlay[]): TrainedSlot[] {
  return pool.maps.map((map) => ({
    map,
    slot: map.slot,
    title: map.title,
    category: slotCategory(map),
    training: slotTraining(plays, map)
  }))
}

/** What the opponent showed per category: what the match plan compares the player to. */
export function opponentLevel(comparison: OpponentComparison | null): OpponentLevel | null {
  if (!comparison) return null
  const level: OpponentLevel = {}
  for (const { category, theirs } of comparison.categories) {
    if (theirs) level[category] = { accuracy: theirs.accuracy, misses: theirs.misses }
  }
  return Object.keys(level).length > 0 ? level : null
}

export function comparisonWith(
  data: TournamentData,
  opponentId: number | null
): OpponentComparison | null {
  if (!data.me || opponentId === null) return null
  return compareOpponent(data.matches, data.me.userId, opponentId)
}

/** Colors of the slots, as tournament sites usually show them. */
export const CATEGORY_COLORS: Record<ModCategory, string> = {
  NM: '#a8a3b8',
  HD: '#ffd166',
  HR: '#ff6b6b',
  DT: '#b388ff',
  HT: '#7cc8ff',
  EZ: '#5fd38d',
  FL: '#e2e2e2',
  FM: '#5fd38d',
  TB: '#7cc8ff'
}

export const READINESS: Record<Readiness, { label: string; color: string }> = {
  ready: { label: 'Prête', color: 'var(--color-passed)' },
  fragile: { label: 'Fragile', color: '#ffd166' },
  weak: { label: 'À travailler', color: 'var(--color-failed)' },
  untested: { label: 'Pas jouée', color: 'var(--color-ink-faint)' }
}

export function percent(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined ? '–' : `${value.toFixed(digits)} %`
}

export function formatLength(seconds: number): string {
  const rounded = Math.round(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

/**
 * The players the next opponent can be: still in the tournament, by seed. The one already chosen
 * stays, even out.
 */
export function opponentChoices(
  standings: PlayerStanding[],
  meId: number | null,
  chosenId: number | null
): PlayerStanding[] {
  return standings.filter(
    ({ userId, eliminated }) => userId !== meId && (!eliminated || userId === chosenId)
  )
}

export function playerLabel(player: PlayerStanding): string {
  return player.seed === null ? player.username : `#${player.seed} ${player.username}`
}
