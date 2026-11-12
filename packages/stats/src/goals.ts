import type { Goal, RecentPlay } from "@osu-tracker/storage";
import { average, playedOnly } from "./plays";

export type GoalProgress = {
  current: number | null;
  target: number;
  done: boolean;
};

function isFullCombo(play: RecentPlay): boolean {
  return (
    play.result === "passed" && play.misses === 0 && play.sliderBreaks === 0
  );
}

function currentValue(
  goal: Goal,
  plays: RecentPlay[],
  ppGain: number | null,
): number | null {
  const passes = playedOnly(plays).filter((play) => play.result === "passed");

  switch (goal.type) {
    case "pp_gain":
      return ppGain;
    case "passes":
      return passes.length;
    case "full_combos":
      return passes.filter(
        (play) => isFullCombo(play) && play.stars >= (goal.minStars ?? 0),
      ).length;
    case "accuracy":
      return average(passes.map((play) => play.accuracy));
  }
}

export function goalProgress(
  goal: Goal,
  plays: RecentPlay[],
  ppGain: number | null,
): GoalProgress {
  const current = currentValue(goal, plays, ppGain);
  return {
    current,
    target: goal.target,
    done: current !== null && current >= goal.target,
  };
}
