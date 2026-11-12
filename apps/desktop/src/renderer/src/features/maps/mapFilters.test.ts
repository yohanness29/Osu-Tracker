import { describe, expect, it } from 'vitest'
import type { MapResults } from '@osu-tracker/storage'
import { filterMaps, NO_FILTERS, sortMaps, starsBounds, styleChoices } from './mapFilters'

function map(overrides: Partial<MapResults>): MapResults {
  return {
    checksum: 'c',
    mode: 'osu',
    beatmapId: 1860169,
    beatmapsetId: 1,
    title: 'RAISE MY SWORD',
    artist: 'GALNERYUS',
    version: 'A THOUSAND FLAMES',
    mapper: 'Sotarks',
    style: 'Stream',
    tags: ['Deathstream'],
    mods: [''],
    lastPlayedAt: 0,
    stars: 5,
    passed: 0,
    failed: 0,
    retried: 0,
    quit: 0,
    ...overrides
  }
}

function titlesOf(maps: MapResults[]): string[] {
  return maps.map(({ title }) => title)
}

describe('filterMaps', () => {
  const stream = map({ title: 'stream', passed: 2, failed: 1, mods: ['', 'HDDT'] })
  const aim = map({ title: 'aim', style: 'Aim', tags: [], failed: 3, mods: ['HR'] })
  const nightcore = map({ title: 'nightcore', style: 'Aim', tags: [], mods: ['NC'] })
  const maps = [stream, aim, nightcore]

  it('keeps everything without filters', () => {
    expect(filterMaps(maps, NO_FILTERS)).toHaveLength(3)
  })

  it('searches the texts and the ID of the maps', () => {
    expect(filterMaps([stream], { ...NO_FILTERS, search: 'galneryus sotarks' })).toHaveLength(1)
    expect(filterMaps([stream], { ...NO_FILTERS, search: '1860169' })).toHaveLength(1)
    expect(filterMaps([stream], { ...NO_FILTERS, search: 'camellia' })).toEqual([])
  })

  it('filters on the main style and the tags', () => {
    expect(titlesOf(filterMaps(maps, { ...NO_FILTERS, styles: ['Deathstream'] }))).toEqual([
      'stream'
    ])
    expect(titlesOf(filterMaps(maps, { ...NO_FILTERS, styles: ['Aim'] }))).toEqual([
      'aim',
      'nightcore'
    ])
  })

  it('filters on the results', () => {
    expect(titlesOf(filterMaps(maps, { ...NO_FILTERS, results: ['passed'] }))).toEqual(['stream'])
    expect(titlesOf(filterMaps(maps, { ...NO_FILTERS, results: ['never-passed'] }))).toEqual([
      'aim',
      'nightcore'
    ])
    expect(titlesOf(filterMaps(maps, { ...NO_FILTERS, results: ['failed'] }))).toEqual([
      'stream',
      'aim'
    ])
  })

  it('filters on the mods played, NC counting as DT', () => {
    expect(titlesOf(filterMaps(maps, { ...NO_FILTERS, mods: ['NM'] }))).toEqual(['stream'])
    expect(titlesOf(filterMaps(maps, { ...NO_FILTERS, mods: ['DT'] }))).toEqual([
      'stream',
      'nightcore'
    ])
  })
})

describe('sortMaps', () => {
  const recent = map({ title: 'recent', lastPlayedAt: 3, passed: 1 })
  const often = map({ title: 'often', lastPlayedAt: 1, passed: 5, failed: 1 })
  const hard = map({ title: 'hard', lastPlayedAt: 2, passed: 1, failed: 4 })
  const maps = [often, hard, recent]

  it('sorts by date, plays or pass rate', () => {
    expect(titlesOf(sortMaps(maps, 'recent'))).toEqual(['recent', 'hard', 'often'])
    expect(titlesOf(sortMaps(maps, 'played'))).toEqual(['often', 'hard', 'recent'])
    expect(titlesOf(sortMaps(maps, 'hardest'))).toEqual(['hard', 'often', 'recent'])
  })
})

describe('styleChoices', () => {
  it('sorts the styles and tags of the maps into their families', () => {
    const maps = [map({}), map({ style: 'Aim', tags: ['Gros jumps'] })]
    expect(styleChoices(maps).map(({ value, group }) => [group, value])).toEqual([
      ['Aim', 'Aim'],
      ['Aim', 'Gros jumps'],
      ['Stream et stamina', 'Stream'],
      ['Stream et stamina', 'Deathstream']
    ])
  })
})

describe('stars', () => {
  const maps = [map({ title: 'easy', stars: 3.2 }), map({ title: 'hard', stars: 6.7 })]

  it('keeps the maps inside the range', () => {
    expect(titlesOf(filterMaps(maps, { ...NO_FILTERS, stars: { min: 4, max: null } }))).toEqual([
      'hard'
    ])
    expect(titlesOf(filterMaps(maps, { ...NO_FILTERS, stars: { min: null, max: 4 } }))).toEqual([
      'easy'
    ])
  })

  it('gives whole bounds around every map', () => {
    expect(starsBounds(maps)).toEqual([3, 7])
  })
})
