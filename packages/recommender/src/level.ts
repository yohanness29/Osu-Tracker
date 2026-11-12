const MODS_MIN_SHARE = 0.1;
const STARS_MARGIN = 0.3;
const LOW_PERCENTILE = 0.1;
const HIGH_PERCENTILE = 0.9;
// Rough effect of DT on the difficulty of a map: top plays only give it without mods.
const DOUBLE_TIME_STARS = 1.4;

export type TopPlay = {
  beatmapId: number;
  pp: number;
  /** Without mods, as the API gives it. */
  stars: number;
  mods: string;
  accuracy: number;
};

export type PlayerLevel = {
  bestPp: number;
  /** Usual accuracy, for mods the player rarely uses. */
  accuracy: number;
  minStars: number;
  maxStars: number;
  /** Combinations of mods the player really uses, with their usual accuracy. */
  mods: { mods: string; accuracy: number }[];
};

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sorted: number[], share: number): number {
  return sorted[Math.floor((sorted.length - 1) * share)]!;
}

function isDoubleTime(mods: string): boolean {
  const list: string[] = mods.match(/.{2}/g) ?? [];
  return list.includes("DT") || list.includes("NC");
}

/**
 * Difficulty without mods worth searching to play with given mods. A player of HDDT maps at
 * 4.5★ really plays around 6.3★, so maps played without DT must be that hard to give pp.
 */
export function starsRangeForMods(
  top: TopPlay[],
  mods: string,
): [number, number] {
  const played = top
    .map(
      (play) => play.stars * (isDoubleTime(play.mods) ? DOUBLE_TIME_STARS : 1),
    )
    .toSorted((a, b) => a - b);
  const factor = isDoubleTime(mods) ? DOUBLE_TIME_STARS : 1;

  return [
    Math.max(0, percentile(played, LOW_PERCENTILE) / factor - STARS_MARGIN),
    percentile(played, HIGH_PERCENTILE) / factor + STARS_MARGIN,
  ];
}

/** Null without top plays: there is nothing to base a level on. */
export function playerLevel(top: TopPlay[]): PlayerLevel | null {
  if (top.length === 0) return null;

  const stars = top.map((play) => play.stars).toSorted((a, b) => a - b);
  const groups = Map.groupBy(top, (play) => play.mods);
  const overallAccuracy = average(top.map((play) => play.accuracy));

  const mods = [...groups]
    .filter(([, plays]) => plays.length / top.length >= MODS_MIN_SHARE)
    .map(([name, plays]) => ({
      mods: name,
      accuracy: average(plays.map((play) => play.accuracy)),
    }));
  if (!mods.some(({ mods: name }) => name === "")) {
    mods.push({ mods: "", accuracy: overallAccuracy });
  }

  return {
    bestPp: Math.max(...top.map((play) => play.pp)),
    accuracy: overallAccuracy,
    minStars: Math.max(0, percentile(stars, LOW_PERCENTILE) - STARS_MARGIN),
    maxStars: percentile(stars, HIGH_PERCENTILE) + STARS_MARGIN,
    mods,
  };
}
