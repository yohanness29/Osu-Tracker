import { describe, expect, it } from 'vitest'
import type { RecentPlay, SessionSummary } from '@osu-tracker/storage'
import { buildMonth, buildTree, computeStats, dayKey, groupAttempts } from './sessions'

function session(id: string, date: Date): SessionSummary {
  return {
    id,
    name: null,
    startedAt: date.getTime(),
    endedAt: date.getTime() + 1000,
    startPp: 0,
    endPp: 0,
    plays: 1,
    playTimeMs: 1000,
    passed: 1,
    failed: 0,
    retried: 0,
    quit: 0
  }
}

function play(overrides: Partial<RecentPlay>): RecentPlay {
  return {
    id: 'p',
    sessionId: 's',
    beatmapChecksum: 'c',
    beatmapId: 1,
    beatmapsetId: 1,
    title: 't',
    version: 'v',
    artist: 'a',
    mapper: 'm',
    mode: 'osu',
    mods: '',
    result: 'passed',
    partial: false,
    accuracy: 100,
    pp: 100,
    maxPp: null,
    noModMaxPp: null,
    netGain: null,
    rank: 'A',
    score: 1,
    stars: 5,
    ar: 9,
    bpm: 180,
    n300: 100,
    n100: 0,
    n50: 0,
    misses: 0,
    sliderBreaks: 0,
    unstableRate: 120,
    hitError: null,
    style: null,
    tags: [],
    mapTimeMs: 60000,
    lengthMs: 60000,
    startedAt: 0,
    endedAt: 1000,
    ...overrides
  }
}

describe('buildTree', () => {
  it('groups sessions by year, month and day', () => {
    const tree = buildTree([
      session('c', new Date(2026, 9, 31, 22)),
      session('b', new Date(2026, 9, 31, 8)),
      session('a', new Date(2025, 0, 2, 12))
    ])

    expect(tree.map((year) => year.key)).toEqual(['2026', '2025'])
    expect(tree[0]?.children[0]?.label).toBe('Octobre')
    expect(tree[0]?.children[0]?.children[0]?.label).toBe('Samedi 31')
    expect(tree[0]?.children[0]?.children[0]?.children.map(({ id }) => id)).toEqual(['c', 'b'])
  })
})

describe('buildMonth', () => {
  it('starts weeks on Monday and places sessions on their local day', () => {
    // October 2026 starts on a Thursday.
    const sessions = [session('a', new Date(2026, 9, 31, 23, 30))]
    const weeks = buildMonth(2026, 9, sessions)

    expect(weeks[0]?.slice(0, 4).map((cell) => cell?.day ?? null)).toEqual([null, null, null, 1])
    expect(weeks.flat().filter((cell) => cell !== null)).toHaveLength(31)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks.flat().find((cell) => cell?.day === 31)?.sessions).toEqual(sessions)
  })
})

describe('dayKey', () => {
  it('uses the local date', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05')
  })
})

describe('groupAttempts', () => {
  const tries = (...results: [string, RecentPlay['result']][]): RecentPlay[] =>
    results.map(([beatmapChecksum, result], index) =>
      play({ id: String(index), beatmapChecksum, result, startedAt: index })
    )

  const summary = (plays: RecentPlay[]): [string, string, number][] =>
    groupAttempts(plays).map(({ play: { beatmapChecksum, result }, retries }) => [
      beatmapChecksum,
      result,
      retries
    ])

  it('counts the retries that led to a result, latest map first', () => {
    const plays = tries(['a', 'retried'], ['a', 'retried'], ['a', 'passed'], ['b', 'failed'])
    expect(summary(plays)).toEqual([
      ['b', 'failed', 0],
      ['a', 'passed', 2]
    ])
  })

  it('starts a new count after each result on a map', () => {
    const plays = tries(['a', 'failed'], ['a', 'retried'], ['a', 'passed'])
    expect(summary(plays)).toEqual([
      ['a', 'passed', 1],
      ['a', 'failed', 0]
    ])
  })

  it('keeps a map given up after retries', () => {
    expect(summary(tries(['a', 'retried'], ['a', 'retried'], ['a', 'quit']))).toEqual([
      ['a', 'retried', 2]
    ])
  })

  it('drops maps that were only quit', () => {
    expect(summary(tries(['a', 'quit'], ['b', 'passed']))).toEqual([['b', 'passed', 0]])
  })

  it('separates the same map in two modes', () => {
    const plays = [
      play({ beatmapChecksum: 'a', mode: 'osu', result: 'retried', startedAt: 1 }),
      play({ beatmapChecksum: 'a', mode: 'taiko', result: 'passed', startedAt: 2 })
    ]
    expect(summary(plays)).toEqual([
      ['a', 'passed', 0],
      ['a', 'retried', 1]
    ])
  })
})

describe('computeStats', () => {
  it('ignores plays without score and averages passes only for accuracy', () => {
    const stats = computeStats([
      play({ accuracy: 98, pp: 200, mods: 'HDDT', stars: 6 }),
      play({ accuracy: 94, pp: 100, mods: 'HDDT', stars: 4 }),
      play({ accuracy: 50, pp: 500, result: 'failed', stars: 8 }),
      play({ score: 0, accuracy: 0, stars: 99, result: 'quit' })
    ])

    expect(stats.averageAccuracy).toBe(96)
    expect(stats.bestPp).toBe(200)
    expect(stats.averageStars).toBe(6)
    expect(stats.mods).toEqual([
      { label: 'HDDT', percent: 67 },
      { label: 'NM', percent: 33 }
    ])
  })

  it('splits the time between modes and counts distinct maps', () => {
    const stats = computeStats([
      play({ mode: 'osu', beatmapChecksum: 'a', endedAt: 2000 }),
      play({ mode: 'osu', beatmapChecksum: 'a', endedAt: 1000 }),
      play({ mode: 'mania', beatmapChecksum: 'b', endedAt: 1000 })
    ])

    expect(stats.modes).toEqual([
      { key: 'osu', label: 'osu!', percent: 75, maps: 1 },
      { key: 'taiko', label: 'Taiko', percent: 0, maps: 0 },
      { key: 'fruits', label: 'Catch', percent: 0, maps: 0 },
      { key: 'mania', label: 'Mania', percent: 25, maps: 1 }
    ])
  })

  it('has no averages without a pass', () => {
    const stats = computeStats([play({ result: 'failed' })])
    expect(stats.averageAccuracy).toBeNull()
    expect(stats.bestPp).toBeNull()
  })
})
