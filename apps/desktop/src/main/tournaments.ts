import { BrowserWindow } from 'electron'
import { analyzeMap, analyzeMods } from '@osu-tracker/pp'
import { clockRate } from '@osu-tracker/recommender'
import { parseMatchId, parsePool } from '@osu-tracker/stats'
import { OsuApiError } from '@osu-tracker/osu-api'
import type {
  PoolMapInput,
  RecentPlay,
  Tournament,
  TournamentMatch,
  TournamentPool,
  TournamentUpdate,
  TrackerStore
} from '@osu-tracker/storage'
import { getAccountStatus, osuClient } from './account'

export type TournamentData = {
  tournament: Tournament
  pools: TournamentPool[]
  matches: TournamentMatch[]
  /** Every play on the maps of the pools, in the mode of the tournament. */
  plays: RecentPlay[]
  /** The connected player, to find their scores among those of a match. */
  me: { userId: number; username: string } | null
}

export type PoolImport = { poolId: string; errors: string[] }

export type MatchImport = { name: string; games: number; warmups: number }

export type ImportProgress = { done: number; total: number } | null

let store: TrackerStore
let isPlaying: () => boolean

function publishProgress(progress: ImportProgress): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('tournaments:progress', progress)
  }
}

function connectedClient(): NonNullable<ReturnType<typeof osuClient>> {
  const client = osuClient()
  if (!client) throw new Error('Connecte ton compte osu! dans le profil.')
  return client
}

export function setupTournaments(trackerStore: TrackerStore, playing: () => boolean): void {
  store = trackerStore
  isPlaying = playing
}

export function getTournaments(): Tournament[] {
  return store.tournaments()
}

export function createTournament(name: string, mode: string): string {
  return store.createTournament(name, mode, Date.now())
}

export function updateTournament(tournamentId: string, changes: TournamentUpdate): void {
  store.updateTournament(tournamentId, changes)
}

export function deleteTournament(tournamentId: string): void {
  store.deleteTournament(tournamentId)
}

export function getTournament(tournamentId: string): TournamentData | null {
  const tournament = store.tournaments().find(({ id }) => id === tournamentId)
  if (!tournament) return null

  const pools = store.tournamentPools(tournamentId)
  const beatmapIds = [
    ...new Set(pools.flatMap(({ maps }) => maps.map(({ beatmapId }) => beatmapId)))
  ]
  const user = getAccountStatus().user
  return {
    tournament,
    pools,
    matches: store.tournamentMatches(tournamentId),
    plays: store.playsOnMaps(beatmapIds, tournament.mode),
    me: user ? { userId: user.id, username: user.name } : null
  }
}

/**
 * Reads each map of a pasted pool from osu!, then analyzes it with the mods of its slot, as it
 * will be played. A map that cannot be read is left out and named in the errors.
 */
export async function addPool(
  tournamentId: string,
  name: string,
  text: string
): Promise<PoolImport> {
  if (isPlaying())
    throw new Error('Import bloqué pendant une partie : réessaie à la fin de la map.')
  const tournament = store.tournaments().find(({ id }) => id === tournamentId)
  if (!tournament) throw new Error('Ce tournoi n’existe plus.')

  const { entries, errors } = parsePool(text)
  if (entries.length === 0) {
    throw new Error('Aucune map lisible : écris une map par ligne, par exemple « NM1 4630139 ».')
  }
  const client = connectedClient()
  const maps: PoolMapInput[] = []
  const failures = errors.map((line) => `Ligne illisible : ${line}`)

  try {
    for (const [index, entry] of entries.entries()) {
      publishProgress({ done: index, total: entries.length })
      try {
        const { map } = await client.getCatalogMap(entry.beatmapId)
        const content = (await client.fetchMapFile(entry.beatmapId)).toString('utf8')
        const { style, tags } = await analyzeMap({ content, mode: tournament.mode, lazer: false })
        const [analysis] = await analyzeMods({
          content,
          mode: tournament.mode,
          lazer: false,
          mods: [entry.mods]
        })
        const rate = clockRate(entry.mods)
        maps.push({
          slot: entry.slot,
          mods: entry.mods,
          freeMod: entry.freeMod,
          beatmapId: map.beatmapId,
          beatmapsetId: map.beatmapsetId,
          checksum: map.checksum,
          title: map.title,
          artist: map.artist,
          version: map.version,
          mapper: map.mapper,
          stars: analysis?.stars ?? map.stars,
          ar: analysis?.ar ?? map.ar,
          od: analysis?.od ?? 0,
          cs: analysis?.cs ?? 0,
          hp: analysis?.hp ?? 0,
          bpm: map.bpm * rate,
          lengthSeconds: map.lengthSeconds / rate,
          style,
          tags
        })
      } catch (error) {
        const reason =
          error instanceof OsuApiError && error.status === 404
            ? 'map introuvable sur osu!'
            : error instanceof Error
              ? error.message
              : String(error)
        failures.push(`${entry.slot} (${entry.beatmapId}) : ${reason}`)
      }
    }
  } finally {
    publishProgress(null)
  }

  if (maps.length === 0) {
    throw new Error(`Aucune map n’a pu être lue. ${failures.join(' · ')}`)
  }
  return { poolId: store.createPool(tournamentId, name, maps, Date.now()), errors: failures }
}

export function deletePool(poolId: string): void {
  store.deletePool(poolId)
}

/** Reads a match from its link. Warm-up maps are left out. */
export async function importMatch(tournamentId: string, link: string): Promise<MatchImport> {
  const matchId = parseMatchId(link)
  if (matchId === null) {
    throw new Error('Lien de match illisible : colle un lien osu.ppy.sh/community/matches/…')
  }
  const client = connectedClient()

  let match
  try {
    match = await client.getMatch(matchId)
  } catch (error) {
    if (error instanceof OsuApiError && error.status === 404) {
      throw new Error(`Aucun match osu! avec l’identifiant ${matchId}.`, { cause: error })
    }
    throw error
  }

  // With the pools known, a warm-up is a map out of them played before the first pool map: a pool
  // map counts even when the referee forgot ScoreV2. Without pools, the scoring tells them apart.
  const poolMaps = new Set(
    store
      .tournamentPools(tournamentId)
      .flatMap(({ maps }) => maps.map(({ beatmapId }) => beatmapId))
  )
  const firstPoolGame = match.games.findIndex(({ beatmapId }) => poolMaps.has(beatmapId))
  const games =
    poolMaps.size > 0 && firstPoolGame !== -1
      ? match.games.slice(firstPoolGame)
      : match.games.filter(({ warmup }) => !warmup)
  store.saveMatch(
    tournamentId,
    {
      osuMatchId: match.matchId,
      name: match.name,
      startedAt: match.startedAt,
      scores: games.flatMap((game) =>
        game.scores.map((score) => ({
          gameId: game.gameId,
          beatmapId: game.beatmapId,
          title: game.title,
          version: game.version,
          playedAt: game.playedAt,
          ...score
        }))
      )
    },
    Date.now()
  )
  return { name: match.name, games: games.length, warmups: match.games.length - games.length }
}

export function deleteMatch(matchId: string): void {
  store.deleteMatch(matchId)
}
