import { BrowserWindow } from 'electron'
import { analyzeMap, analyzeMods } from '@osu-tracker/pp'
import {
  matchesSearchFilters,
  playerLevel,
  rateMaps,
  searchQuery,
  starsRangeForMods,
  starsRangeWithFilters,
  type Exclusion,
  type SearchFilters,
  type PlayerLevel,
  type TopPlay
} from '@osu-tracker/recommender'
import type {
  CatalogMapRow,
  CatalogSuggestionRow,
  MapStyleValues,
  TrackerStore
} from '@osu-tracker/storage'
import { OsuApiError, type CatalogMap, type OsuClient } from '@osu-tracker/osu-api'
import { osuClient } from './account'

const SEARCH_PAGES = 3
const MAPS_PER_REFRESH = 150
const PLAYING_RETRY_MS = 3000
const SUGGESTIONS_LIMIT = 3000
const OUTDATED_MAPS_LIMIT = 500
const OUTDATED_CHECK_DELAY_MS = 5000

export type FarmingStatus = {
  running: boolean
  done: number
  total: number
  error: string | null
  /** Grows each time a played map joins the suggestions, so that the page reloads them. */
  addedMaps: number
}

export type FarmSuggestion = Omit<CatalogSuggestionRow, 'ppByAccuracy' | 'mapStars'> & {
  accuracy: number
  pp: number
  ssPp: number
  gain: number
  /** Why the map would add nothing to the profile: kept to explain an empty list. */
  excluded: Exclusion | null
}

const status: FarmingStatus = { running: false, done: 0, total: 0, error: null, addedMaps: 0 }

let store: TrackerStore
let isPlaying: () => boolean
let stopped = false

function publish(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('farming:status', status)
  }
}

function topPlays(mode: string): TopPlay[] {
  return store.topScores(mode).map(({ beatmapId, pp, stars, mods, accuracy }) => ({
    beatmapId,
    pp,
    stars,
    mods,
    accuracy
  }))
}

/** Analyzing blocks the app for a moment: it must never get in the way of a play. */
async function waitForBreak(): Promise<void> {
  while (isPlaying() && !stopped) {
    await new Promise((resolve) => setTimeout(resolve, PLAYING_RETRY_MS))
  }
}

/** Each combination of mods gets maps of the difficulty that suits it. */
async function fillCatalog(
  mode: string,
  level: PlayerLevel,
  wantedMods: string[],
  text: string,
  filters: SearchFilters
): Promise<void> {
  const client = osuClient()
  if (!client) throw new Error('Connecte ton compte osu! dans le profil.')

  const searches =
    wantedMods.length > 0
      ? wantedMods.map((mods) => ({ mods: [mods], range: starsRangeForMods(topPlays(mode), mods) }))
      : [
          {
            mods: level.mods.map(({ mods }) => mods),
            range: [level.minStars, level.maxStars] as [number, number]
          }
        ]

  const mapsPerSearch = Math.ceil(MAPS_PER_REFRESH / searches.length)
  const toAnalyze: { map: CatalogMapRow; mods: string[] }[] = []

  for (const search of searches) {
    const { mods } = search
    const range = starsRangeWithFilters(filters, mods, search.range)
    // The filters go to osu! so that the maps analyzed already match them.
    const query = [text, searchQuery(filters, mods)].filter(Boolean).join(' ')
    const found: number[] = []

    let cursor: string | null = null
    for (let page = 0; page < SEARCH_PAGES; page += 1) {
      const result = await client.searchMaps(mode, range[0], range[1], cursor, query)
      store.saveCatalogMaps(result.maps)
      found.push(
        ...result.maps
          .filter((map) => matchesSearchFilters(map, filters, mods))
          .map(({ beatmapId }) => beatmapId)
      )
      cursor = result.cursor
      if (!cursor) break
    }

    const maps = store.mapsToAnalyze(mode, mods, mapsPerSearch, range, found)
    toAnalyze.push(...maps.map((map) => ({ map, mods })))
  }

  status.total = toAnalyze.length
  publish()
  await analyzeMaps(client, toAnalyze)
}

async function analyzeMaps(
  client: OsuClient,
  maps: { map: CatalogMapRow; mods: string[] }[]
): Promise<void> {
  for (const { map, mods } of maps) {
    await waitForBreak()
    if (stopped) return

    try {
      const content = (await client.fetchMapFile(map.beatmapId)).toString('utf8')
      const { style, tags } = await analyzeMap({ content, mode: map.mode, lazer: false })
      const analyses = await analyzeMods({ content, mode: map.mode, lazer: false, mods })
      store.saveMapAnalyses(map.beatmapId, { style, tags }, analyses)
    } catch (error) {
      console.error(`Map ${map.beatmapId} could not be analyzed`, error)
    }

    status.done += 1
    publish()
  }
}

/** Maps analyzed by an older version get their difficulty values with mods. */
async function updateOutdatedAnalyses(): Promise<void> {
  const client = osuClient()
  const maps = store.outdatedAnalyses(OUTDATED_MAPS_LIMIT)
  if (!client || maps.length === 0 || status.running) return

  Object.assign(status, { running: true, done: 0, total: maps.length, error: null })
  publish()

  try {
    await analyzeMaps(client, maps)
  } finally {
    status.running = false
    publish()
  }
}

/** Maps analyzed before tags existed: their file is read again, nothing else changes. */
async function addMissingTags(): Promise<void> {
  const client = osuClient()
  if (!client) return

  const played = store.playedMapsWithoutTags(OUTDATED_MAPS_LIMIT)
  const catalog = store.catalogMapsWithoutTags(OUTDATED_MAPS_LIMIT)
  const maps = [
    ...played.map(({ beatmapId, mode, beatmapChecksum }) => ({
      beatmapId,
      mode,
      save: (style: MapStyleValues) => store.saveMapStyle(beatmapChecksum, mode, style)
    })),
    ...catalog.map(({ beatmapId, mode }) => ({
      beatmapId,
      mode,
      save: (style: MapStyleValues) => store.saveCatalogStyle(beatmapId, style)
    }))
  ]
  if (maps.length === 0 || status.running) return

  Object.assign(status, { running: true, done: 0, total: maps.length, error: null })
  publish()

  try {
    for (const { beatmapId, mode, save } of maps) {
      await waitForBreak()
      if (stopped) return

      try {
        const content = (await client.fetchMapFile(beatmapId)).toString('utf8')
        const { style, tags } = await analyzeMap({ content, mode, lazer: false })
        save({ style, tags })
      } catch (error) {
        console.error(`Map ${beatmapId} could not be analyzed`, error)
      }

      status.done += 1
      publish()
    }
  } finally {
    status.running = false
    publish()
  }
}

const PP_GIVING_STATUSES = ['ranked', 'approved']
// Played mods kept for the suggestions: others, such as EZ or FL, are not suggested.
const SUGGESTED_MODS = /^(HD|HR|DT)*$/

/** The combinations of mods the player really uses, no mods at least. */
function usualMods(mode: string): string[] {
  return playerLevel(topPlays(mode))?.mods.map(({ mods }) => mods) ?? ['']
}

/** Saves a map in the catalog and analyzes it with these mods. */
async function addToCatalog(client: OsuClient, map: CatalogMap, mods: string[]): Promise<void> {
  store.saveCatalogMaps([map])
  const content = (await client.fetchMapFile(map.beatmapId)).toString('utf8')
  const { style, tags } = await analyzeMap({ content, mode: map.mode, lazer: false })
  const analyses = await analyzeMods({ content, mode: map.mode, lazer: false, mods })
  store.saveMapAnalyses(map.beatmapId, { style, tags }, analyses)
}

const playedQueue = new Map<number, { mode: string; mods: string }>()
let addingPlayed = false

/**
 * Every ranked map played joins the suggestions, with the usual mods of the player and those
 * of the play. Runs between plays, one map at a time.
 */
export function addPlayedMap(beatmapId: number, mode: string, mods: string): void {
  if (beatmapId <= 0) return
  playedQueue.set(beatmapId, { mode, mods })
  addPlayedMaps().catch(console.error)
}

async function addPlayedMaps(): Promise<void> {
  if (addingPlayed) return
  addingPlayed = true
  try {
    for (const [beatmapId, played] of playedQueue) {
      await waitForBreak()
      if (stopped) return
      playedQueue.delete(beatmapId)

      const client = osuClient()
      if (!client) continue
      const mods = [
        ...new Set([
          ...usualMods(played.mode),
          ...(SUGGESTED_MODS.test(played.mods) ? [played.mods] : [])
        ])
      ]
      if (store.isCatalogAnalyzed(beatmapId, mods)) continue

      try {
        const { map, status: mapStatus } = await client.getCatalogMap(beatmapId)
        // Converted maps and maps giving no pp have no place among the suggestions.
        if (map.mode !== played.mode || !PP_GIVING_STATUSES.includes(mapStatus)) continue
        await addToCatalog(client, map, mods)
        status.addedMaps += 1
        publish()
      } catch (error) {
        console.error(`Played map ${beatmapId} could not be added to the suggestions`, error)
      }
    }
  } finally {
    addingPlayed = false
  }
}

export type ImportedMap = {
  beatmapId: number
  checksum: string
  mode: string
  title: string
  version: string
  /** Only ranked and approved maps give pp. */
  givesPp: boolean
  /** The best way to play it among the mods analyzed, even when it would add nothing. */
  best: Pick<FarmSuggestion, 'mods' | 'accuracy' | 'pp' | 'gain' | 'excluded'> | null
}

/**
 * Adds one map to the suggestions, whatever its difficulty, and says what it would give.
 * Without chosen mods, those the player usually plays are analyzed.
 */
export async function importMap(
  beatmapId: number,
  wantedMods: string[],
  targetAccuracy: number | null
): Promise<ImportedMap> {
  if (isPlaying())
    throw new Error('Import bloqué pendant une partie : réessaie à la fin de la map.')
  if (status.running)
    throw new Error('Une analyse est déjà en cours : réessaie quand elle est finie.')
  const client = osuClient()
  if (!client) throw new Error('Connecte ton compte osu! dans le profil.')

  Object.assign(status, { running: true, done: 0, total: 1, error: null })
  publish()

  try {
    const { map, status: mapStatus } = await client.getCatalogMap(beatmapId)
    const level = playerLevel(topPlays(map.mode))
    const mods = wantedMods.length > 0 ? wantedMods : usualMods(map.mode)
    await addToCatalog(client, map, mods)
    status.done = 1

    const rows = store
      .catalogSuggestions(map.mode)
      .filter((row) => row.beatmapId === beatmapId && mods.includes(row.mods))
    const [best] = level ? rateMaps(rows, topPlays(map.mode), level, targetAccuracy) : []

    return {
      beatmapId,
      checksum: map.checksum,
      mode: map.mode,
      title: map.title,
      version: map.version,
      givesPp: PP_GIVING_STATUSES.includes(mapStatus),
      best: best
        ? {
            mods: best.map.mods,
            accuracy: best.accuracy,
            pp: best.pp,
            gain: best.gain,
            excluded: best.excluded
          }
        : null
    }
  } catch (error) {
    if (error instanceof OsuApiError && error.status === 404) {
      throw new Error(`Aucune map osu! avec l’identifiant ${beatmapId}.`, { cause: error })
    }
    throw error
  } finally {
    status.running = false
    publish()
  }
}

function omitInternalFields(
  map: CatalogSuggestionRow
): Omit<FarmSuggestion, 'accuracy' | 'pp' | 'ssPp' | 'gain' | 'excluded'> {
  const { beatmapId, beatmapsetId, checksum, mode, title, artist, mapper, version, mods } = map
  const { stars, ar, bpm, lengthSeconds, playCount, style, tags, od, cs, hp } = map
  return {
    beatmapId,
    beatmapsetId,
    checksum,
    mode,
    title,
    artist,
    mapper,
    version,
    mods,
    stars,
    ar,
    od,
    cs,
    hp,
    bpm,
    lengthSeconds,
    playCount,
    style,
    tags
  }
}

/** Stars of the top plays of the player in a mode: what the search uses without a filter. */
export function getPlayerStars(mode: string): [number, number] | null {
  const level = playerLevel(topPlays(mode))
  return level ? [level.minStars, level.maxStars] : null
}

export function getFarmingStatus(): FarmingStatus {
  return status
}

/** With `mods`, only these combinations: an empty string means no mods. */
export function getSuggestions(
  mode: string,
  targetAccuracy: number | null,
  mods: string[]
): FarmSuggestion[] {
  const top = topPlays(mode)
  const level = playerLevel(top)
  if (!level) return []

  // Every way to play a map is kept: the page shows the best one left by its filters.
  const maps = store
    .catalogSuggestions(mode)
    .filter((map) => mods.length === 0 || mods.includes(map.mods))

  return rateMaps(maps, top, level, targetAccuracy)
    .slice(0, SUGGESTIONS_LIMIT)
    .map(({ map, accuracy, pp, ssPp, gain, excluded }) => ({
      ...omitInternalFields(map),
      accuracy,
      pp,
      ssPp,
      gain,
      excluded
    }))
}

export async function refreshCatalog(
  mode: string,
  mods: string[],
  text: string,
  filters: SearchFilters = {}
): Promise<void> {
  // The page blocks it too: this also covers a click just before the map starts.
  if (status.running || isPlaying()) return

  const level = playerLevel(topPlays(mode))
  Object.assign(status, { running: level !== null, done: 0, total: 0, error: null })
  if (!level) {
    status.error = 'Aucun top play dans ce mode : relie ton compte ou joue quelques maps.'
    publish()
    return
  }
  publish()

  try {
    await fillCatalog(mode, level, mods, text, filters)
  } catch (error) {
    status.error = error instanceof Error ? error.message : String(error)
  } finally {
    status.running = false
    publish()
  }
}

export function setupFarming(trackerStore: TrackerStore, playing: () => boolean): void {
  store = trackerStore
  isPlaying = playing
  setTimeout(async () => {
    await updateOutdatedAnalyses().catch(console.error)
    await addMissingTags().catch(console.error)
  }, OUTDATED_CHECK_DELAY_MS)
}

export function stopFarming(): void {
  stopped = true
}
