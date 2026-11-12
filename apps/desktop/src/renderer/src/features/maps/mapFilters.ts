import type { MapResults } from '@osu-tracker/storage'
import type { DropdownOption } from '../../shared/Dropdown'
import { matchesSearch } from '../../shared/search'
import { groupedStyleOptions } from '../../shared/styleGroups'
import { splitMods } from '../../shared/format'

export type MapFilters = {
  search: string
  styles: string[]
  results: string[]
  mods: string[]
  /** Null for no bound. */
  stars: { min: number | null; max: number | null }
}

export const NO_FILTERS: MapFilters = {
  search: '',
  styles: [],
  results: [],
  mods: [],
  stars: { min: null, max: null }
}

/** Whole stars around the maps, so the ends of the slider keep every map. */
export function starsBounds(maps: MapResults[]): [number, number] {
  if (maps.length === 0) return [0, 10]
  const stars = maps.map((map) => map.stars)
  return [Math.floor(Math.min(...stars)), Math.ceil(Math.max(...stars))]
}

function matchesStars(map: MapResults, { min, max }: MapFilters['stars']): boolean {
  return (min === null || map.stars >= min) && (max === null || map.stars <= max)
}

export const RESULT_CHOICES = [
  { value: 'passed', label: 'Déjà passée' },
  { value: 'never-passed', label: 'Jamais passée' },
  { value: 'failed', label: 'Avec des fails' }
]

export const MODS_CHOICES = [
  { value: 'NM', label: 'NM' },
  { value: 'HD', label: 'HD' },
  { value: 'HR', label: 'HR' },
  { value: 'DT', label: 'DT' },
  { value: 'EZ', label: 'EZ' },
  { value: 'HT', label: 'HT' },
  { value: 'FL', label: 'FL' }
]

export const SORT_CHOICES = [
  { value: 'recent', label: 'Récentes' },
  { value: 'played', label: 'Plus jouées' },
  { value: 'hardest', label: 'Plus difficiles pour toi' }
]

function played({ passed, failed, retried, quit }: MapResults): number {
  return passed + failed + retried + quit
}

/** Share of the finished tries that passed, maps never finished last. */
function passShare(map: MapResults): number {
  const finished = map.passed + map.failed
  return finished === 0 ? Infinity : map.passed / finished
}

function matchesResult(map: MapResults, results: string[]): boolean {
  if (results.length === 0) return true
  return results.some(
    (result) =>
      (result === 'passed' && map.passed > 0) ||
      (result === 'never-passed' && map.passed === 0) ||
      (result === 'failed' && map.failed > 0)
  )
}

/** DT also covers NC, and NM the plays without mods. */
function matchesMods(map: MapResults, mods: string[]): boolean {
  if (mods.length === 0) return true
  const playedMods = map.mods.flatMap((combination) => {
    const list = splitMods(combination)
    if (list.length === 0) return ['NM']
    return list.map((mod) => (mod === 'NC' ? 'DT' : mod))
  })
  return mods.some((mod) => playedMods.includes(mod))
}

function matchesStyles(map: MapResults, styles: string[]): boolean {
  if (styles.length === 0) return true
  return styles.some((style) => style === map.style || map.tags.includes(style))
}

export function filterMaps(maps: MapResults[], filters: MapFilters): MapResults[] {
  return maps.filter(
    (map) =>
      matchesSearch(map, filters.search) &&
      matchesStyles(map, filters.styles) &&
      matchesResult(map, filters.results) &&
      matchesMods(map, filters.mods) &&
      matchesStars(map, filters.stars)
  )
}

export function sortMaps(maps: MapResults[], sort: string): MapResults[] {
  switch (sort) {
    case 'played':
      return maps.toSorted((a, b) => played(b) - played(a))
    case 'hardest':
      return maps.toSorted((a, b) => passShare(a) - passShare(b) || played(b) - played(a))
    default:
      return maps.toSorted((a, b) => b.lastPlayedAt - a.lastPlayedAt)
  }
}

/** The styles and tags of the maps, sorted into their families. */
export function styleChoices(maps: MapResults[]): DropdownOption[] {
  return groupedStyleOptions(
    maps.flatMap(({ style, tags }) => [...(style ? [style] : []), ...tags])
  )
}
