import { BrowserWindow } from 'electron'
import { analyzeMap, analyzeMods } from '@osu-tracker/pp'
import { clockRate } from '@osu-tracker/recommender'
import {
  bracketEliminations,
  matchRounds,
  parseChallonge,
  parseChallongeBracket,
  parseMatchId,
  parsePool,
  tournamentPlacement,
  type BracketStatus,
  type Placement
} from '@osu-tracker/stats'
import { OsuApiError } from '@osu-tracker/osu-api'
import type {
  PoolMapInput,
  PlayerStatus,
  PoolUpdate,
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
  /** What the Challonge bracket says, when one is linked and could be read. */
  bracket: BracketStatus | null
  /** The players said in or out by hand, above the bracket and the matches. */
  manual: PlayerStatus[]
}

/** A tournament of the list, with where the connected player stands in it. */
export type TournamentSummary = Tournament & { placement: Placement }

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

export async function getTournaments(): Promise<TournamentSummary[]> {
  const userId = getAccountStatus().user?.id ?? null
  return Promise.all(
    store.tournaments().map(async (tournament) => {
      if (userId === null) return { ...tournament, placement: { kind: 'unknown' } }
      const pools = store.tournamentPools(tournament.id)
      // As the tournament page reads them: warm-ups out of the pools left out.
      const matches = matchRounds(store.tournamentMatches(tournament.id), pools).flatMap(
        (round) => round.matches
      )
      const bracket = await bracketStatus(tournament)
      return {
        ...tournament,
        placement: tournamentPlacement(
          matches,
          pools,
          tournament,
          userId,
          bracket,
          store.playerStatuses(tournament.id)
        )
      }
    })
  )
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

export async function getTournament(tournamentId: string): Promise<TournamentData | null> {
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
    me: user ? { userId: user.id, username: user.name } : null,
    bracket: await bracketStatus(tournament),
    manual: store.playerStatuses(tournamentId)
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

export function updatePool(poolId: string, changes: PoolUpdate): void {
  store.updatePool(poolId, changes)
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

// A bracket is read again after this delay, or when the player asks for it.
const BRACKET_FRESH_MS = 10 * 60 * 1000
const brackets = new Map<string, { svg: string; at: number }>()

/**
 * The bracket as Challonge draws it: an SVG image, read here, as the page of the app cannot
 * reach other sites. Its scripts never run: the page shows it as an image.
 */
async function bracketSvg(bracket: string, fresh: boolean): Promise<string> {
  const known = brackets.get(bracket)
  if (known && !fresh && Date.now() - known.at < BRACKET_FRESH_MS) return known.svg
  const response = await fetch(`https://${bracket}.svg`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (osu-tracker)' }
  })
  if (response.status === 404) {
    throw new Error('Ce bracket n’existe pas sur Challonge : vérifie le lien.')
  }
  if (!response.ok) throw new Error(`Challonge a répondu ${response.status}.`)
  if (!response.headers.get('content-type')?.includes('svg')) {
    throw new Error('Challonge n’a pas renvoyé de bracket : il est peut-être privé.')
  }
  const svg = await response.text()
  brackets.set(bracket, { svg, at: Date.now() })
  return svg
}

/** Only the brackets the parser accepts: never any address. */
function bracketOf(tournament: Tournament | undefined): string | null {
  const bracket = tournament?.challonge ?? null
  return bracket !== null && parseChallonge(bracket) === bracket ? bracket : null
}

export async function fetchChallongeBracket(
  tournamentId: string,
  fresh = false
): Promise<string | null> {
  const bracket = bracketOf(store.tournaments().find(({ id }) => id === tournamentId))
  return bracket === null ? null : bracketSvg(bracket, fresh)
}

/** Who the bracket has knocked out; null without a bracket, or when it cannot be read. */
async function bracketStatus(tournament: Tournament): Promise<BracketStatus | null> {
  const bracket = bracketOf(tournament)
  if (bracket === null) return null
  try {
    const matches = parseChallongeBracket(await bracketSvg(bracket, false))
    return matches.length > 0 ? bracketEliminations(matches, tournament.loserBracket) : null
  } catch (error) {
    console.error('Bracket Challonge illisible :', error)
    return null
  }
}

/** Null forgets the choice by hand: the bracket or the matches decide again. */
export function setPlayerStatus(
  tournamentId: string,
  userId: number,
  eliminated: boolean | null
): void {
  store.setPlayerStatus(tournamentId, userId, eliminated)
}

export function deleteMatch(matchId: string): void {
  store.deleteMatch(matchId)
}
