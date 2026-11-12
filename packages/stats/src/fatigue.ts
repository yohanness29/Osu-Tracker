import type { RecentPlay } from "@osu-tracker/storage";
import { average, chronological, playedOnly } from "./plays";

const MIN_PLAYS = 6;
const MIN_MAP_TIME_MS = 30000;
const COMPARED_SHARE = 0.4;
const ACCURACY_POINTS = 1.5;
const UNSTABLE_RATE_RATIO = 0.1;

export type Fatigue =
  | { status: "insufficient"; playsNeeded: number }
  | {
      status: "stable" | "declining" | "improving";
      accuracyChange: number;
      unstableRateChange: number;
      /** Maps getting harder can explain a drop on their own. */
      starsChange: number;
      /** Time from the start of the session to the compared end of it. */
      lateFromMs: number;
    };

/** Compares the start and the end of a session, ignoring plays too short to mean anything. */
export function detectFatigue(sessionPlays: RecentPlay[]): Fatigue {
  const plays = chronological(playedOnly(sessionPlays)).filter(
    (play) => !play.partial && play.mapTimeMs >= MIN_MAP_TIME_MS,
  );
  if (plays.length < MIN_PLAYS) {
    return { status: "insufficient", playsNeeded: MIN_PLAYS - plays.length };
  }

  const compared = Math.floor(plays.length * COMPARED_SHARE);
  const early = plays.slice(0, compared);
  const late = plays.slice(-compared);

  const accuracyChange =
    average(late.map((play) => play.accuracy))! -
    average(early.map((play) => play.accuracy))!;
  const earlyUr = average(early.map((play) => play.unstableRate))!;
  const lateUr = average(late.map((play) => play.unstableRate))!;
  const urRatio = earlyUr > 0 ? (lateUr - earlyUr) / earlyUr : 0;

  let status: "stable" | "declining" | "improving" = "stable";
  if (accuracyChange <= -ACCURACY_POINTS || urRatio >= UNSTABLE_RATE_RATIO)
    status = "declining";
  else if (accuracyChange >= ACCURACY_POINTS) status = "improving";

  return {
    status,
    accuracyChange,
    unstableRateChange: lateUr - earlyUr,
    starsChange:
      average(late.map((play) => play.stars))! -
      average(early.map((play) => play.stars))!,
    lateFromMs: late[0]!.startedAt - plays[0]!.startedAt,
  };
}
