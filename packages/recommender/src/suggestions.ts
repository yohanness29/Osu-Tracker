import { netPpGain } from "@osu-tracker/stats";
import type { PlayerLevel, TopPlay } from "./level";

// A score far above the best one of the player is not a realistic target.
const REACHABLE_RATIO = 1.05;
const MIN_GAIN_PP = 0.1;

export type AccuracyPp = { accuracy: number; pp: number };

export type AnalyzedMap = {
  beatmapId: number;
  mods: string;
  stars: number;
  ppByAccuracy: AccuracyPp[];
};

export type Suggestion<Map extends AnalyzedMap> = {
  map: Map;
  accuracy: number;
  pp: number;
  ssPp: number;
  gain: number;
};

/** Values must be sorted by accuracy. */
export function ppAtAccuracy(values: AccuracyPp[], accuracy: number): number {
  const upper = values.findIndex((value) => value.accuracy >= accuracy);
  if (upper === -1) return values.at(-1)?.pp ?? 0;
  if (upper === 0) return values[0]!.pp;

  const low = values[upper - 1]!;
  const high = values[upper]!;
  const share = (accuracy - low.accuracy) / (high.accuracy - low.accuracy);
  return low.pp + (high.pp - low.pp) * share;
}

/**
 * - `unreachable`: the score would be far above the best one of the player.
 * - `no-gain`: it would not improve the profile, being below the top plays or the score
 *   already set on the map.
 */
export type Exclusion = "unreachable" | "no-gain";

export type RatedMap<Map extends AnalyzedMap> = Suggestion<Map> & {
  excluded: Exclusion | null;
};

/**
 * What each map would really add to the profile, those giving nothing included with the
 * reason. Without a target accuracy, each combination of mods uses the accuracy the player
 * usually reaches with it, or the overall one for mods rarely used.
 */
export function rateMaps<Map extends AnalyzedMap>(
  maps: Map[],
  top: TopPlay[],
  level: PlayerLevel,
  targetAccuracy: number | null,
): RatedMap<Map>[] {
  const accuracies = new globalThis.Map(
    level.mods.map(({ mods, accuracy }) => [mods, accuracy]),
  );

  return maps
    .map((map) => {
      const accuracy =
        targetAccuracy ?? accuracies.get(map.mods) ?? level.accuracy;
      const pp = ppAtAccuracy(map.ppByAccuracy, accuracy);
      const ssPp = map.ppByAccuracy.at(-1)?.pp ?? pp;

      if (pp > level.bestPp * REACHABLE_RATIO) {
        return {
          map,
          accuracy,
          pp,
          ssPp,
          gain: 0,
          excluded: "unreachable" as const,
        };
      }
      const gain = netPpGain(top, { beatmapId: map.beatmapId, pp });
      const excluded = gain >= MIN_GAIN_PP ? null : ("no-gain" as const);
      return { map, accuracy, pp, ssPp, gain, excluded };
    })
    .toSorted((a, b) => b.gain - a.gain);
}

/** Only the maps that would improve the profile, sorted by what they would add. */
export function rankSuggestions<Map extends AnalyzedMap>(
  maps: Map[],
  top: TopPlay[],
  level: PlayerLevel,
  targetAccuracy: number | null,
): Suggestion<Map>[] {
  return rateMaps(maps, top, level, targetAccuracy)
    .filter(({ excluded }) => excluded === null)
    .map(({ excluded: _excluded, ...suggestion }) => suggestion);
}

/** Keeps the best way to play each map. Suggestions must be sorted. */
export function bestPerMap<Map extends AnalyzedMap>(
  suggestions: Suggestion<Map>[],
): Suggestion<Map>[] {
  const seen = new Set<number>();
  return suggestions.filter(({ map }) => {
    if (seen.has(map.beatmapId)) return false;
    seen.add(map.beatmapId);
    return true;
  });
}
