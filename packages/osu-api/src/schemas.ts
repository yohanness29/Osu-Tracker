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
