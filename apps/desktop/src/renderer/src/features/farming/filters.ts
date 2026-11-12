import type { SearchFilters } from '@osu-tracker/recommender'
import type { FarmSuggestion } from '../../../../main/farming'
import { settingTags } from '../../shared/mapTags'
import { clockRate } from '../../shared/mods'
import { matchesSearch } from '../../shared/search'

export { clockRate, matchesSearch }

export type CriterionKey = 'stars' | 'ar' | 'od' | 'cs' | 'hp' | 'bpm'

export type Criterion = {
  key: CriterionKey
  label: string
  step: number
  /** Ends of the slider: a handle left there sets no bound. */
  min: number
  max: number
  format: (value: number) => string
}

const oneDecimal = (value: number): string => value.toFixed(1)

export const CRITERIA: Criterion[] = [
  { key: 'stars', label: 'Étoiles', step: 0.1, min: 0, max: 12, format: (v) => `${v.toFixed(1)}★` },
  { key: 'ar', label: 'AR', step: 0.1, min: 0, max: 11, format: oneDecimal },
  { key: 'od', label: 'OD', step: 0.1, min: 0, max: 11, format: oneDecimal },
  { key: 'cs', label: 'CS', step: 0.1, min: 0, max: 10, format: oneDecimal },
  { key: 'hp', label: 'HP', step: 0.1, min: 0, max: 10, format: oneDecimal },
  { key: 'bpm', label: 'BPM', step: 5, min: 60, max: 320, format: (v) => String(Math.round(v)) }
]

const LEVEL_MARGIN_STARS = 1.5

/**
 * The stars slider spans the level of the player, with some room around it: the ends of a
 * slider from 0 to 12 would leave little room for the stars that matter.
 */
export function criteriaForPlayer(playerStars: [number, number] | null): Criterion[] {
  if (!playerStars) return CRITERIA
  const min = Math.max(0, Math.floor(playerStars[0] - LEVEL_MARGIN_STARS))
  const max = Math.ceil(playerStars[1] + LEVEL_MARGIN_STARS)
  return CRITERIA.map((criterion) =>
    criterion.key === 'stars' ? { ...criterion, min, max } : criterion
  )
}

/** A handle at an end of its slider sets no bound. */
export function rangeFromSlider({ min, max }: Criterion, [low, high]: [number, number]): Range {
  return { min: low > min ? low : null, max: high < max ? high : null }
}

/** What the search for new maps must follow, as shown with the mods. */
export function searchFilters(criteria: Criteria, lengths: string[]): SearchFilters {
  const filters: SearchFilters = Object.fromEntries(
    Object.entries(criteria).filter(([, range]) => range.min !== null || range.max !== null)
  )
  const selected = LENGTH_RANGES.flatMap((range, index) =>
    lengths.includes(range.value)
      ? [{ min: LENGTH_RANGES[index - 1]?.max ?? 0, max: range.max }]
      : []
  )
  if (selected.length > 0) {
    const min = Math.min(...selected.map((range) => range.min))
    const max = Math.max(...selected.map((range) => range.max))
    filters.length = { min: min > 0 ? min : null, max: Number.isFinite(max) ? max : null }
  }
  return filters
}

export const LENGTH_RANGES = [
  { value: 'short', label: 'Moins de 2 min', max: 120 },
  { value: 'medium', label: '2 à 3 min', max: 180 },
  { value: 'long', label: '3 à 5 min', max: 300 },
  { value: 'marathon', label: '5 min et plus', max: Infinity }
]

const COMBINABLE_MODS = ['HD', 'HR', 'DT']
// DT is rarely played alone: choosing it also covers its usual combinations.
const DOUBLE_TIME_VARIANTS = ['HDDT', 'HRDT']

/**
 * Every way to play with the selected mods: HD and HR give HD, HR and HDHR.
 * NM stands alone, since it cannot be combined with anything.
 */
export function expandMods(selected: string[]): string[] {
  const mods = COMBINABLE_MODS.filter((mod) => selected.includes(mod))
  const combinations = Array.from({ length: 2 ** mods.length }, (_, mask) =>
    mods.filter((_mod, index) => mask & (1 << index)).join('')
  ).filter(Boolean)

  const variants = selected.includes('DT') ? DOUBLE_TIME_VARIANTS : []
  const expanded = [...new Set([...combinations, ...variants])]

  return selected.includes('') ? ['', ...expanded] : expanded
}

export type Range = { min: number | null; max: number | null }
export type Criteria = Partial<Record<CriterionKey, Range>>

/** Every tag of a suggestion: those of its patterns, then those of its settings with its mods. */
export function suggestionTags(map: FarmSuggestion): string[] {
  const lengthSeconds = map.lengthSeconds / clockRate(map.mods)
  return [...map.tags, ...settingTags({ ...map, lengthSeconds })]
}

export function matchesStyles(map: FarmSuggestion, styles: string[]): boolean {
  if (styles.length === 0) return true
  const own = [map.style, ...suggestionTags(map)]
  return styles.some((style) => own.includes(style))
}

function valueOf(map: FarmSuggestion, key: CriterionKey): number | null {
  return key === 'bpm' ? map.bpm * clockRate(map.mods) : map[key]
}

export function matchesCriteria(map: FarmSuggestion, criteria: Criteria): boolean {
  return CRITERIA.every(({ key }) => {
    const range = criteria[key]
    if (!range || (range.min === null && range.max === null)) return true

    const value = valueOf(map, key)
    if (value === null) return false
    return (range.min === null || value >= range.min) && (range.max === null || value <= range.max)
  })
}

/** The length really played, in the selected ranges. Nothing selected keeps every map. */
export function matchesLength(map: FarmSuggestion, ranges: string[]): boolean {
  if (ranges.length === 0) return true

  const seconds = map.lengthSeconds / clockRate(map.mods)
  const range = LENGTH_RANGES.find(({ max }) => seconds < max)
  return range !== undefined && ranges.includes(range.value)
}

export function activeCriteriaCount(criteria: Criteria): number {
  return Object.values(criteria).filter(({ min, max }) => min !== null || max !== null).length
}
