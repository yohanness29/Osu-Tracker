const WEIGHT_BASE = 0.95;
const COUNTED_SCORES = 100;

export type RankedPlay = { beatmapId: number; pp: number };

function weightedTotal(pps: number[]): number {
  return pps
    .toSorted((a, b) => b - a)
    .slice(0, COUNTED_SCORES)
    .reduce((total, pp, index) => total + pp * WEIGHT_BASE ** index, 0);
}

/** pp a score adds to a profile. Only the best score on a map counts. */
export function netPpGain(top: RankedPlay[], play: RankedPlay): number {
  const previous = top.find(({ beatmapId }) => beatmapId === play.beatmapId);
  if (previous && previous.pp >= play.pp) return 0;

  const others = top.filter((score) => score !== previous).map(({ pp }) => pp);
  return Math.max(
    0,
    weightedTotal([...others, play.pp]) -
      weightedTotal(top.map(({ pp }) => pp)),
  );
}
