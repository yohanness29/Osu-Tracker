import { z } from "zod";

export const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

export const meSchema = z.object({
  id: z.number(),
  username: z.string(),
  playmode: z.string(),
  is_supporter: z.boolean().optional(),
});

const scoreSchema = z.object({
  id: z.number(),
  pp: z.number().nullable(),
  accuracy: z.number(),
  rank: z.string(),
  // The format depends on the API version: acronyms, or objects holding them.
  mods: z.array(z.union([z.string(), z.object({ acronym: z.string() })])),
  ended_at: z.string().nullish(),
  created_at: z.string().nullish(),
  weight: z.object({ percentage: z.number(), pp: z.number() }).nullish(),
  beatmap: z.object({
    id: z.number(),
    version: z.string(),
    difficulty_rating: z.number(),
    checksum: z.string().nullish(),
  }),
  beatmapset: z.object({
    id: z.number(),
    title: z.string(),
    artist: z.string(),
    creator: z.string().nullish(),
  }),
});

export const scoresSchema = z.array(scoreSchema);

export const attributesSchema = z.object({
  attributes: z.object({ star_rating: z.number() }),
});

export const beatmapSchema = z.object({
  id: z.number(),
  version: z.string(),
  beatmapset: z.object({
    title: z.string(),
    artist: z.string(),
    creator: z.string(),
  }),
});

/** A difficulty asked for by its id: everything the catalog of suggestions needs. */
export const catalogBeatmapSchema = z.object({
  id: z.number(),
  checksum: z.string().nullish(),
  mode: z.string(),
  status: z.string(),
  version: z.string(),
  difficulty_rating: z.number(),
  ar: z.number(),
  bpm: z.number(),
  total_length: z.number(),
  playcount: z.number().nullish(),
  beatmapset: z.object({
    id: z.number(),
    title: z.string(),
    artist: z.string(),
    creator: z.string(),
  }),
});

const SEARCH_MODE_NAMES = ["osu", "taiko", "fruits", "mania"];

export const searchSchema = z.object({
  cursor_string: z.string().nullish(),
  beatmapsets: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      artist: z.string(),
      creator: z.string(),
      beatmaps: z
        .array(
          z.object({
            id: z.number(),
            checksum: z.string().nullish(),
            mode: z.string(),
            version: z.string(),
            difficulty_rating: z.number(),
            ar: z.number(),
            bpm: z.number(),
            total_length: z.number(),
            playcount: z.number().nullish(),
          }),
        )
        .default([]),
    }),
  ),
});

export type CatalogMap = {
  beatmapId: number;
  beatmapsetId: number;
  checksum: string;
  mode: string;
  title: string;
  artist: string;
  mapper: string;
  version: string;
  stars: number;
  ar: number;
  bpm: number;
  lengthSeconds: number;
  playCount: number;
};

export function searchModeNumber(mode: string): number {
  return Math.max(0, SEARCH_MODE_NAMES.indexOf(mode));
}

export function toCatalogMaps(
  { beatmapsets }: z.infer<typeof searchSchema>,
  mode: string,
  minStars: number,
  maxStars: number,
): CatalogMap[] {
  return beatmapsets.flatMap((set) =>
    set.beatmaps.flatMap((map) => {
      const inRange =
        map.difficulty_rating >= minStars && map.difficulty_rating <= maxStars;
      if (map.mode !== mode || !inRange || !map.checksum) return [];

      return [
        {
          beatmapId: map.id,
          beatmapsetId: set.id,
          checksum: map.checksum,
          mode,
          title: set.title,
          artist: set.artist,
          mapper: set.creator,
          version: map.version,
          stars: map.difficulty_rating,
          ar: map.ar,
          bpm: map.bpm,
          lengthSeconds: map.total_length,
          playCount: map.playcount ?? 0,
        },
      ];
    }),
  );
}

export type TopScore = {
  scoreId: number;
  beatmapId: number;
  beatmapsetId: number;
  title: string;
  artist: string;
  version: string;
  /** Null when the API leaves it out: the score then cannot join a playlist. */
  checksum: string | null;
  mapper: string | null;
  stars: number;
  mods: string;
  accuracy: number;
  pp: number;
  weightPercent: number | null;
  rank: string;
  playedAt: number;
};

export type MapTexts = {
  beatmapId: number;
  title: string;
  artist: string;
  version: string;
  mapper: string;
};

// Classic only marks how a lazer score is computed.
const HIDDEN_MODS = ["CL"];

export function toTopScore(score: z.infer<typeof scoreSchema>): TopScore {
  const mods = score.mods
    .map((mod) => (typeof mod === "string" ? mod : mod.acronym))
    .filter((mod) => !HIDDEN_MODS.includes(mod));

  return {
    scoreId: score.id,
    beatmapId: score.beatmap.id,
    beatmapsetId: score.beatmapset.id,
    title: score.beatmapset.title,
    artist: score.beatmapset.artist,
    version: score.beatmap.version,
    checksum: score.beatmap.checksum ?? null,
    mapper: score.beatmapset.creator ?? null,
    stars: score.beatmap.difficulty_rating,
    mods: mods.join(""),
    accuracy: score.accuracy * 100,
    pp: score.pp ?? 0,
    weightPercent: score.weight?.percentage ?? null,
    rank: score.rank,
    playedAt: Date.parse(score.ended_at ?? score.created_at ?? "") || 0,
  };
}

const modSchema = z.union([z.string(), z.object({ acronym: z.string() })]);

// The API answers with the old or the new score format depending on its version: both are read.
const matchScoreSchema = z.object({
  user_id: z.number(),
  accuracy: z.number(),
  max_combo: z.number().nullish(),
  passed: z.boolean().nullish(),
  mods: z.array(modSchema).nullish(),
  score: z.number().nullish(),
  legacy_total_score: z.number().nullish(),
  total_score: z.number().nullish(),
  statistics: z
    .object({
      count_300: z.number().nullish(),
      count_100: z.number().nullish(),
      count_50: z.number().nullish(),
      count_miss: z.number().nullish(),
      great: z.number().nullish(),
      ok: z.number().nullish(),
      meh: z.number().nullish(),
      miss: z.number().nullish(),
    })
    .nullish(),
});

export const matchSchema = z.object({
  match: z.object({ id: z.number(), name: z.string(), start_time: z.string() }),
  events: z.array(
    z.object({
      id: z.number(),
      game: z
        .object({
          id: z.number(),
          beatmap_id: z.number(),
          start_time: z.string(),
          mode: z.string(),
          mods: z.array(modSchema).default([]),
          scoring_type: z.string().nullish(),
          scores: z.array(matchScoreSchema).default([]),
          beatmap: z
            .object({
              version: z.string(),
              beatmapset: z
                .object({ title: z.string(), artist: z.string() })
                .nullish(),
            })
            .nullish(),
        })
        .nullish(),
    }),
  ),
  users: z
    .array(z.object({ id: z.number(), username: z.string() }))
    .default([]),
  latest_event_id: z.number().nullish(),
});

export type MatchScore = {
  userId: number;
  username: string;
  score: number;
  /** Percent. */
  accuracy: number;
  maxCombo: number;
  n300: number;
  n100: number;
  misses: number;
  passed: boolean;
  /** Those of the game, and those the player picked in free mod. */
  mods: string;
};

export type MatchGame = {
  gameId: number;
  beatmapId: number;
  title: string;
  version: string;
  mode: string;
  playedAt: number;
  scoringType: string | null;
  /** Played before the match with another scoring, to warm up: it counts for nothing. */
  warmup: boolean;
  scores: MatchScore[];
};

export type OsuMatch = {
  matchId: number;
  name: string;
  startedAt: number;
  games: MatchGame[];
};

function modAcronyms(
  mods: z.infer<typeof modSchema>[] | null | undefined,
): string[] {
  return (mods ?? [])
    .map((mod) => (typeof mod === "string" ? mod : mod.acronym))
    .filter((mod) => !HIDDEN_MODS.includes(mod));
}

/**
 * Warm-up maps open a match with another scoring than its real maps: the leading games
 * whose scoring differs from the one most games use.
 */
function markWarmups(games: Omit<MatchGame, "warmup">[]): MatchGame[] {
  const counts = new Map<string | null, number>();
  for (const { scoringType } of games) {
    counts.set(scoringType, (counts.get(scoringType) ?? 0) + 1);
  }
  const main = [...counts].toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const firstReal = games.findIndex(({ scoringType }) => scoringType === main);
  return games.map((game, index) => ({ ...game, warmup: index < firstReal }));
}

/** Games of a match, in the order they were played. Events without a game are left out. */
export function toOsuMatch(pages: z.infer<typeof matchSchema>[]): OsuMatch {
  const first = pages[0]!;
  const users = new Map(
    pages.flatMap(({ users: list }) =>
      list.map(({ id, username }) => [id, username]),
    ),
  );

  const games = pages
    .flatMap(({ events }) => events)
    .flatMap(({ game }) => (game ? [game] : []))
    .filter(
      (game, index, all) => all.findIndex(({ id }) => id === game.id) === index,
    )
    .map((game) => {
      const gameMods = modAcronyms(game.mods);
      return {
        gameId: game.id,
        beatmapId: game.beatmap_id,
        title: game.beatmap?.beatmapset?.title ?? "",
        version: game.beatmap?.version ?? "",
        mode: game.mode,
        playedAt: Date.parse(game.start_time) || 0,
        scoringType: game.scoring_type ?? null,
        scores: game.scores.map((score) => {
          const stats = score.statistics ?? {};
          const mods = [...new Set([...gameMods, ...modAcronyms(score.mods)])];
          return {
            userId: score.user_id,
            username: users.get(score.user_id) ?? String(score.user_id),
            score:
              score.legacy_total_score || score.score || score.total_score || 0,
            accuracy: score.accuracy * 100,
            maxCombo: score.max_combo ?? 0,
            n300: stats.count_300 ?? stats.great ?? 0,
            n100: stats.count_100 ?? stats.ok ?? 0,
            misses: stats.count_miss ?? stats.miss ?? 0,
            passed: score.passed ?? true,
            mods: mods.join(""),
          };
        }),
      };
    });

  return {
    matchId: first.match.id,
    name: first.match.name,
    startedAt: Date.parse(first.match.start_time) || 0,
    games: markWarmups(games),
  };
}
