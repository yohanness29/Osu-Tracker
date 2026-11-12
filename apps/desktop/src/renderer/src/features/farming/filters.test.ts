import { describe, expect, it } from 'vitest'
import type { FarmSuggestion } from '../../../../main/farming'
import {
  activeCriteriaCount,
  expandMods,
  matchesCriteria,
  matchesLength,
  matchesSearch,
  matchesStyles,
  criteriaForPlayer,
  rangeFromSlider,
  searchFilters,
  suggestionTags,
  CRITERIA
} from './filters'

const map: FarmSuggestion = {
  beatmapId: 358362,
  beatmapsetId: 1,
  checksum: 'abc',
  mode: 'osu',
  title: 'BLACK or WHITE?',
  artist: 'Café Tacvba',
  mapper: 'Fast',
  version: "SCV's INFINITE",
  mods: 'HDDT',
  stars: 6.2,
  ar: 10.3,
  od: 9.8,
  cs: 4,
  hp: 6,
  bpm: 180,
  lengthSeconds: 120,
  playCount: 1,
  style: 'Aim',
  tags: ['Bursts'],
  accuracy: 98,
  pp: 200,
  ssPp: 300,
  gain: 5,
  excluded: null
}

describe('matchesCriteria', () => {
  it('keeps maps inside every range', () => {
    expect(matchesCriteria(map, { ar: { min: 10, max: 10.5 }, od: { min: 9, max: null } })).toBe(
      true
    )
  })

  it('leaves out maps outside a range', () => {
    expect(matchesCriteria(map, { ar: { min: null, max: 10 } })).toBe(false)
  })

  it('reads BPM with the speed of the mods', () => {
    expect(matchesCriteria(map, { bpm: { min: 260, max: 280 } })).toBe(true)
    expect(matchesCriteria(map, { bpm: { min: 170, max: 190 } })).toBe(false)
  })

  it('leaves out maps with an unknown value only when it is asked for', () => {
    const unknown = { ...map, od: null }
    expect(matchesCriteria(unknown, { od: { min: 9, max: null } })).toBe(false)
    expect(matchesCriteria(unknown, { od: { min: null, max: null } })).toBe(true)
  })
})

describe('expandMods', () => {
  it('has nothing to try without selection', () => {
    expect(expandMods([])).toEqual([])
  })

  it('keeps a single mod and NM alone', () => {
    expect(expandMods(['HR'])).toEqual(['HR'])
    expect(expandMods([''])).toEqual([''])
  })

  it('covers the usual combinations of DT', () => {
    expect(expandMods(['DT'])).toEqual(['DT', 'HDDT', 'HRDT'])
  })

  it('tries every combination of the selected mods', () => {
    expect(expandMods(['HR', 'HD'])).toEqual(['HD', 'HR', 'HDHR'])
    expect(expandMods(['DT', 'HD'])).toEqual(['HD', 'DT', 'HDDT', 'HRDT'])
  })

  it('adds NM without combining it', () => {
    expect(expandMods(['', 'HD', 'HR', 'DT']).toSorted()).toEqual(
      ['', 'HD', 'HR', 'HDHR', 'DT', 'HDDT', 'HRDT', 'HDHRDT'].toSorted()
    )
  })
})

describe('matchesLength', () => {
  it('keeps every map without selection', () => {
    expect(matchesLength(map, [])).toBe(true)
  })

  it('accepts several ranges, with the length really played', () => {
    // 120 seconds in DT are played in 80.
    expect(matchesLength(map, ['short', 'long'])).toBe(true)
    expect(matchesLength(map, ['medium'])).toBe(false)
    expect(matchesLength({ ...map, mods: '' }, ['medium'])).toBe(true)
  })

  it('has a last range without limit', () => {
    expect(matchesLength({ ...map, mods: '', lengthSeconds: 900 }, ['marathon'])).toBe(true)
  })
})

describe('matchesSearch', () => {
  it('finds words in any order, without case or accents', () => {
    expect(matchesSearch(map, 'white cafe')).toBe(true)
  })

  it('searches the difficulty, the mapper and the id', () => {
    expect(matchesSearch(map, 'infinite')).toBe(true)
    expect(matchesSearch(map, 'fast')).toBe(true)
    expect(matchesSearch(map, '358362')).toBe(true)
  })

  it('needs every word', () => {
    expect(matchesSearch(map, 'white nothing')).toBe(false)
  })
})

describe('activeCriteriaCount', () => {
  it('ignores empty ranges', () => {
    expect(activeCriteriaCount({ ar: { min: 9, max: null }, od: { min: null, max: null } })).toBe(1)
  })
})

describe('style tags', () => {
  it('adds the tags of the settings with the mods', () => {
    expect(suggestionTags(map)).toEqual(['Bursts', 'AR haut'])
    expect(suggestionTags({ ...map, mods: '', ar: 9, lengthSeconds: 330 })).toEqual([
      'Bursts',
      'Marathon'
    ])
  })

  it('keeps maps having any selected style or tag', () => {
    expect(matchesStyles(map, [])).toBe(true)
    expect(matchesStyles(map, ['Stream', 'Aim'])).toBe(true)
    expect(matchesStyles(map, ['AR haut'])).toBe(true)
    expect(matchesStyles(map, ['Deathstream'])).toBe(false)
  })
})

describe('search filters', () => {
  const bpm = CRITERIA.find(({ key }) => key === 'bpm')!

  it('sets no bound with a handle at an end of the slider', () => {
    expect(rangeFromSlider(bpm, [60, 320])).toEqual({ min: null, max: null })
    expect(rangeFromSlider(bpm, [170, 320])).toEqual({ min: 170, max: null })
  })

  it('sends the criteria in use and the span of the lengths chosen', () => {
    expect(
      searchFilters({ bpm: { min: 170, max: 180 }, ar: { min: null, max: null } }, [
        'medium',
        'long'
      ])
    ).toEqual({ bpm: { min: 170, max: 180 }, length: { min: 120, max: 300 } })
    expect(searchFilters({}, ['short'])).toEqual({ length: { min: null, max: 120 } })
    expect(searchFilters({}, ['marathon'])).toEqual({ length: { min: 300, max: null } })
  })
})

describe('criteriaForPlayer', () => {
  it('fits the stars slider to the level of the player', () => {
    const stars = criteriaForPlayer([4.6, 6.2]).find(({ key }) => key === 'stars')!
    expect([stars.min, stars.max]).toEqual([3, 8])
    expect(criteriaForPlayer(null)).toBe(CRITERIA)
  })
})
