import type { RecentPlay } from "@osu-tracker/storage";
import { average, chronological, playedOnly } from "./plays";

export type SessionPoint = {
  sessionId: string;
  startedAt: number;
  accuracy: number;
  passes: number;
  hitError: number | null;
  /** Share of hits that were 100s or 50s. */
  imperfectShare: number | null;
};

/** Average accuracy on passes for each session, oldest first. Sessions without pass are left out. */
export function sessionProgress(plays: RecentPlay[]): SessionPoint[] {
  const sessions = Map.groupBy(
    chronological(playedOnly(plays)),
    (play) => play.sessionId,
  );

  return [...sessions].flatMap(([sessionId, sessionPlays]) => {
    const passes = sessionPlays.filter((play) => play.result === "passed");
    const accuracy = average(passes.map((play) => play.accuracy));
    if (accuracy === null) return [];

    const greats = sessionPlays.reduce((sum, play) => sum + play.n300, 0);
    const imperfect = sessionPlays.reduce(
      (sum, play) => sum + play.n100 + play.n50,
      0,
    );
    const hits = greats + imperfect;

    return [
      {
        sessionId,
        startedAt: sessionPlays[0]!.startedAt,
        accuracy,
        passes: passes.length,
        hitError: average(
          sessionPlays.flatMap(({ hitError }) => hitError ?? []),
        ),
        imperfectShare: hits > 0 ? (imperfect / hits) * 100 : null,
      },
    ];
  });
}
