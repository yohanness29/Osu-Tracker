import type { RecentPlay, ResultCounts } from '@osu-tracker/storage'

export type ModsSummary = {
  mods: string
  plays: number
  passed: number
  stars: number
  bestPp: number | null
  bestAccuracy: number | null
  maxPp: number | null
}

export type MapStats = {
  counts: ResultCounts
  bestPp: number | null
  bestAccuracy: number | null
  byMods: ModsSummary[]
}

function best(values: number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null
}

/** Best values only count passes: a failed or abandoned play has no final score. */
export function computeMapStats(plays: RecentPlay[]): MapStats {
  const counts: ResultCounts = { passed: 0, failed: 0, retried: 0, quit: 0 }
  for (const play of plays) counts[play.result] += 1

  const passes = plays.filter((play) => play.result === 'passed')

  const byMods = [...Map.groupBy(plays, (play) => play.mods || 'NM')]
    .map(([mods, group]) => {
      const groupPasses = group.filter((play) => play.result === 'passed')
      return {
        mods,
        plays: group.length,
        passed: groupPasses.length,
        stars: group[0]!.stars,
        bestPp: best(groupPasses.map((play) => play.pp)),
        bestAccuracy: best(groupPasses.map((play) => play.accuracy)),
        maxPp: group.find((play) => play.maxPp !== null)?.maxPp ?? null
      }
    })
    .sort((a, b) => b.plays - a.plays)

  return {
    counts,
    bestPp: best(passes.map((play) => play.pp)),
    bestAccuracy: best(passes.map((play) => play.accuracy)),
    byMods
  }
}
