import { z } from "zod";
import type { GameFrame } from "./frame";

const named = z.object({ name: z.string() });

// tosu sometimes reads a text from the game as a lone NUL character.
const gameText = z.string().transform((value) => value.replaceAll("\0", ""));

const hits = z.object({
  "0": z.number(),
  "50": z.number(),
  "100": z.number(),
  "300": z.number(),
  geki: z.number(),
  katu: z.number(),
});

const mods = z.object({ name: z.string(), rate: z.number() });

const converted = z.object({ converted: z.number() });

// Only the fields the app uses: tosu sends about 28 KB per message.
const tosuMessageSchema = z.object({
  client: z.string(),
  state: named,
  game: z.object({ paused: z.boolean() }),
  profile: z.object({
    id: z.number(),
    name: z.string(),
    pp: z.number(),
    globalRank: z.number(),
  }),
  performance: z
    .object({ accuracy: z.record(z.string(), z.number()) })
    .optional(),
  beatmap: z.object({
    id: z.number(),
    set: z.number(),
    checksum: z.string(),
    artist: gameText,
    title: gameText,
    version: gameText,
    mapper: gameText,
    status: named,
    time: z.object({ live: z.number(), lastObject: z.number() }),
    stats: z.object({
      stars: z.object({ total: z.number() }),
      ar: converted,
      cs: converted,
      od: converted,
      hp: converted,
      bpm: z.object({ common: z.number() }),
      maxCombo: z.number(),
    }),
  }),
  play: z.object({
    playerName: z.string(),
    failed: z.boolean(),
    mode: named,
    score: z.number(),
    accuracy: z.number(),
    healthBar: z.object({ normal: z.number() }),
    hits: hits.extend({ sliderBreaks: z.number() }),
    combo: z.object({ current: z.number(), max: z.number() }),
    mods,
    rank: z.object({ current: z.string() }),
    pp: z.object({ current: z.number(), fc: z.number() }),
    unstableRate: z.number(),
    hitErrorArray: z.array(z.number()).nullish(),
  }),
  resultsScreen: z.object({
    scoreId: z.number(),
    score: z.number(),
    accuracy: z.number(),
    hits,
    mods,
    maxCombo: z.number(),
    rank: z.string(),
    // Null on the first frame of the results screen.
    pp: z.object({ current: z.number().nullable(), fc: z.number() }),
  }),
});

const SHOWN_ACCURACIES = [100, 99, 98, 95];

function averageHitError(errors: number[] | null | undefined): number | null {
  if (!errors?.length) return null;
  return errors.reduce((sum, error) => sum + error, 0) / errors.length;
}

function toHitCounts(value: z.infer<typeof hits>): GameFrame["play"]["hits"] {
  return {
    n300: value["300"],
    n100: value["100"],
    n50: value["50"],
    misses: value["0"],
    geki: value.geki,
    katu: value.katu,
  };
}

/** Returns null when the message does not match what tosu is expected to send. */
export function parseTosuMessage(
  raw: string,
  receivedAt: number,
): GameFrame | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = tosuMessageSchema.safeParse(json);
  if (!parsed.success) return null;

  const {
    client,
    state,
    game,
    profile,
    performance,
    beatmap,
    play,
    resultsScreen: results,
  } = parsed.data;
  const ppByAccuracy = SHOWN_ACCURACIES.flatMap((accuracy) => {
    const pp = performance?.accuracy[accuracy];
    return pp ? [{ accuracy, pp }] : [];
  });
  const maxPp = performance?.accuracy["100"] ?? 0;

  return {
    receivedAt,
    client,
    state: state.name,
    paused: game.paused,
    profile,
    beatmap: {
      id: beatmap.id,
      setId: beatmap.set,
      checksum: beatmap.checksum,
      artist: beatmap.artist,
      title: beatmap.title,
      version: beatmap.version,
      mapper: beatmap.mapper,
      status: beatmap.status.name,
      liveTime: beatmap.time.live,
      lastObjectTime: beatmap.time.lastObject,
      stars: beatmap.stats.stars.total,
      ar: beatmap.stats.ar.converted,
      cs: beatmap.stats.cs.converted,
      od: beatmap.stats.od.converted,
      hp: beatmap.stats.hp.converted,
      bpm: beatmap.stats.bpm.common,
      maxCombo: beatmap.stats.maxCombo,
      // 0 means tosu has not calculated it.
      maxPp: maxPp > 0 ? maxPp : null,
      ppByAccuracy,
    },
    play: {
      playerName: play.playerName,
      failed: play.failed,
      mode: play.mode.name,
      score: play.score,
      accuracy: play.accuracy,
      health: play.healthBar.normal,
      hits: toHitCounts(play.hits),
      sliderBreaks: play.hits.sliderBreaks,
      combo: play.combo.current,
      maxCombo: play.combo.max,
      mods: play.mods.name,
      rate: play.mods.rate,
      rank: play.rank.current,
      pp: play.pp.current,
      ppFc: play.pp.fc,
      unstableRate: play.unstableRate,
      hitError: averageHitError(play.hitErrorArray),
    },
    results: {
      scoreId: results.scoreId,
      score: results.score,
      accuracy: results.accuracy,
      hits: toHitCounts(results.hits),
      maxCombo: results.maxCombo,
      mods: results.mods.name,
      rate: results.mods.rate,
      rank: results.rank,
      pp: results.pp.current ?? 0,
      ppFc: results.pp.fc,
    },
  };
}
