import type { RecentPlay } from "@osu-tracker/storage";

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Plays where notes were actually played. */
export function playedOnly(plays: RecentPlay[]): RecentPlay[] {
  return plays.filter((play) => play.score > 0);
}

export function chronological(plays: RecentPlay[]): RecentPlay[] {
  return plays.toSorted((a, b) => a.startedAt - b.startedAt);
}
