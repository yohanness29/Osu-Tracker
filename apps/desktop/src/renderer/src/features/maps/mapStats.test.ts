import { describe, expect, it } from 'vitest'
import type { RecentPlay } from '@osu-tracker/storage'
import { computeMapStats } from './mapStats'

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
    accuracy: 95,
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
    maxCombo: 400,
    sliderBreaks: 0,
    unstableRate: 120,
    hitError: null,
    style: null,
    tags: [],
    mapTimeMs: 60000,
    lengthMs: 60000,
    startedAt: 0,
    endedAt: 1,
    ...overrides
  }
}

describe('computeMapStats', () => {
  it('counts results and keeps the best pass', () => {
    const stats = computeMapStats([
      play({ pp: 120, accuracy: 94 }),
      play({ pp: 100, accuracy: 98 }),
      play({ pp: 500, accuracy: 99, result: 'failed' })
    ])

    expect(stats.counts).toEqual({ passed: 2, failed: 1, retried: 0, quit: 0 })
    expect(stats.bestPp).toBe(120)
    expect(stats.bestAccuracy).toBe(98)
  })

  it('splits the plays by mods, most played first', () => {
    const stats = computeMapStats([
      play({ mods: '', pp: 80 }),
      play({ mods: 'HDDT', pp: 200, stars: 7, maxPp: 300 }),
      play({ mods: 'HDDT', result: 'failed', pp: 900 })
    ])

    expect(stats.byMods[0]).toEqual({
      mods: 'HDDT',
      plays: 2,
      passed: 1,
      stars: 7,
      bestPp: 200,
      bestAccuracy: 95,
      maxPp: 300
    })
    expect(stats.byMods[1]?.mods).toBe('NM')
  })

  it('has no best value without a pass', () => {
    const stats = computeMapStats([play({ result: 'quit' })])
    expect(stats.bestPp).toBeNull()
    expect(stats.byMods[0]?.bestPp).toBeNull()
  })
})
