import type { RecentPlay } from "@osu-tracker/storage";
import { average, playedOnly } from "./plays";

export const MIN_PLAYS = 5;
const WEAK_GAP_POINTS = 15;

export type Bucket = {
  label: string;
  plays: number;
  passRate: number;
  averageAccuracy: number | null;
  averageStars: number;
  /** Pass rate expected at the difficulty of these maps. */
  expectedPassRate: number;
};

export type Dimension = { title: string; buckets: Bucket[] };

export type WeakSpot = Bucket & { dimension: string; gap: number };

export type WeakSpots = {
  overallPassRate: number | null;
  /** On passes. */
  overallAccuracy: number | null;
  finishedPlays: number;
  dimensions: Dimension[];
  weakest: WeakSpot[];
};

type Rule = {
  title: string;
  /** A play may fall in several buckets, or in none. */
  bucketOf: (play: RecentPlay) => string | string[] | null;
  order?: string[];
};

const MINUTE_MS = 60000;

function playedLengthMs({ lengthMs, mods }: RecentPlay): number {
  const list: string[] = mods.match(/.{2}/g) ?? [];
  if (list.includes("DT") || list.includes("NC")) return lengthMs / 1.5;
  return list.includes("HT") ? lengthMs / 0.75 : lengthMs;
}

const BPM_MIN = 150;
const BPM_MAX = 270;
const BPM_STEP = 10;

const BPM_BUCKETS = [
  `<${BPM_MIN}`,
  ...Array.from({ length: (BPM_MAX - BPM_MIN) / BPM_STEP }, (_, index) => {
    const start = BPM_MIN + index * BPM_STEP;
    return `${start}–${start + BPM_STEP}`;
  }),
  `${BPM_MAX}+`,
];

function bpmBucket(bpm: number): string {
  if (bpm < BPM_MIN) return BPM_BUCKETS[0]!;
  if (bpm >= BPM_MAX) return BPM_BUCKETS.at(-1)!;
  return BPM_BUCKETS[Math.floor((bpm - BPM_MIN) / BPM_STEP) + 1]!;
}

const STARS_RULE = "Étoiles";

const RULES: Rule[] = [
  { title: "Style", bucketOf: ({ style }) => style },
  { title: "Particularités", bucketOf: ({ tags }) => tags },
  {
    title: STARS_RULE,
    bucketOf: ({ stars }) => `${Math.floor(stars)}–${Math.floor(stars) + 1}★`,
  },
  {
    title: "Approach rate",
    bucketOf: ({ ar }) => (ar < 9 ? "AR 0–9" : ar < 10 ? "AR 9–10" : "AR 10+"),
    order: ["AR 0–9", "AR 9–10", "AR 10+"],
  },
  {
    title: "Longueur",
    bucketOf: (play) => {
      const lengthMs = playedLengthMs(play);
      if (lengthMs < 2 * MINUTE_MS) return "Moins de 2 min";
      return lengthMs < 4 * MINUTE_MS ? "2 à 4 min" : "4 min et plus";
    },
    order: ["Moins de 2 min", "2 à 4 min", "4 min et plus"],
  },
  { title: "Mods", bucketOf: ({ mods }) => mods || "NM" },
  { title: "BPM", bucketOf: ({ bpm }) => bpmBucket(bpm), order: BPM_BUCKETS },
];

function groupByBuckets(
  plays: RecentPlay[],
  bucketOf: Rule["bucketOf"],
): Map<string, RecentPlay[]> {
  const groups = new Map<string, RecentPlay[]>();
  for (const play of plays) {
    for (const label of [bucketOf(play) ?? []].flat()) {
      groups.set(label, [...(groups.get(label) ?? []), play]);
    }
  }
  return groups;
}

function passRate(plays: RecentPlay[]): number {
  return (
    (plays.filter((play) => play.result === "passed").length / plays.length) *
    100
  );
}

function starsTranche({ stars }: RecentPlay): number {
  return Math.floor(stars);
}

function buildBucket(
  label: string,
  plays: RecentPlay[],
  passRateByStars: Map<number, number>,
): Bucket {
  const passes = plays.filter((play) => play.result === "passed");
  return {
    label,
    plays: plays.length,
    passRate: passRate(plays),
    averageAccuracy: average(passes.map((play) => play.accuracy)),
    averageStars: average(plays.map((play) => play.stars))!,
    expectedPassRate: average(
      plays.map((play) => passRateByStars.get(starsTranche(play))!),
    )!,
  };
}

function sortBuckets(buckets: Bucket[], order?: string[]): Bucket[] {
  return buckets.toSorted((a, b) =>
    order
      ? order.indexOf(a.label) - order.indexOf(b.label)
      : a.label.localeCompare(b.label, "fr", { numeric: true }),
  );
}

/**
 * Where the player fails more than the difficulty of the maps explains.
 * Retried and quit plays have no result to compare.
 */
export function findWeakSpots(plays: RecentPlay[]): WeakSpots {
  const finished = playedOnly(plays).filter(
    (play) => play.result === "passed" || play.result === "failed",
  );
  const overallPassRate = finished.length > 0 ? passRate(finished) : null;
  const overallAccuracy = average(
    finished
      .filter((play) => play.result === "passed")
      .map((play) => play.accuracy),
  );

  const passRateByStars = new Map(
    [...Map.groupBy(finished, starsTranche)].map(([stars, group]) => [
      stars,
      passRate(group),
    ]),
  );

  const dimensions = RULES.map(({ title, bucketOf, order }) => ({
    title,
    buckets: sortBuckets(
      [...groupByBuckets(finished, bucketOf)].map(([label, group]) =>
        buildBucket(label, group, passRateByStars),
      ),
      order,
    ),
  }));

  const weakest =
    overallPassRate === null
      ? []
      : dimensions
          // A difficulty tranche is compared to itself, so it can never stand out.
          .filter(({ title }) => title !== STARS_RULE)
          .flatMap(({ title, buckets }) =>
            buckets.map((bucket) => ({
              ...bucket,
              dimension: title,
              gap: bucket.expectedPassRate - bucket.passRate,
            })),
          )
          .filter(
            ({ plays: count, gap }) =>
              count >= MIN_PLAYS && gap >= WEAK_GAP_POINTS,
          )
          .toSorted((a, b) => b.gap - a.gap);

  return {
    overallPassRate,
    overallAccuracy,
    finishedPlays: finished.length,
    dimensions,
    weakest,
  };
}
