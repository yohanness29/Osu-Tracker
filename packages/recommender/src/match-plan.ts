import type { ModCategory, SlotTraining } from "@osu-tracker/stats";

export type PlannedSlot = {
  slot: string;
  title: string;
  category: ModCategory;
  training: SlotTraining;
};

/** What the opponent showed in a mods category, from the matches imported. */
export type OpponentLevel = Partial<
  Record<ModCategory, { accuracy: number; misses: number }>
>;

/**
 * How a slot compares: to the opponent when they are known, else to the player's usual level.
 * Unknown when the player has not finished it with its mods yet.
 */
export type Verdict = "ahead" | "even" | "behind" | "unknown";

type Result = { accuracy: number; misses: number };

export type SlotAdvice = {
  slot: string;
  title: string;
  category: ModCategory;
  verdict: Verdict;
  /** The player's recent result on the slot, null before a finished try. */
  mine: Result | null;
  /** What the opponent showed in the mods of the slot, null without matches of theirs. */
  theirs: Result | null;
  /** Why, in a few words the player can check. */
  reason: string;
  /** For a pick: what to play instead if the opponent bans it. */
  backup?: string;
};

/** Each slot of the pool, in its order, with its verdict and its part in the plan. */
export type SlotOverview = {
  slot: string;
  title: string;
  category: ModCategory;
  verdict: Verdict;
  role: "ban" | "pick" | "their-pick" | null;
};

export type MatchPlan = {
  bans: SlotAdvice[];
  picks: SlotAdvice[];
  /** What the opponent will likely pick: the slots where they lead the most. */
  theirPicks: SlotAdvice[];
  overview: SlotOverview[];
};

// A miss costs a lot in ScoreV2: it weighs as much as some accuracy points.
const MISS_WEIGHT = 0.4;
// An untested slot is a risk: it counts as below the player's usual level.
const UNTESTED_PENALTY = 2;
const UNSTEADY_UR = 165;
const PICKS_SHOWN = 5;
// Below this gap, in accuracy points with misses counted, a slot is even.
const EVEN_GAP = 0.5;
const THEIR_PICKS_SHOWN = 3;

function percent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")} %`;
}

type Rated = PlannedSlot & {
  mine: number;
  theirs: number | null;
  /** What the opponent showed in its mods, as shown to the player. */
  theirResult: Result | null;
  edge: number;
  /** How much the result may vary from one try to the next. */
  risk: number;
};

function rate(slots: PlannedSlot[], opponent: OpponentLevel | null): Rated[] {
  const tested = slots.flatMap(({ training }) =>
    training.recentAccuracy === null ? [] : [training.recentAccuracy],
  );
  const usual =
    tested.length > 0 ? tested.reduce((a, b) => a + b, 0) / tested.length : 95;

  return slots.map((slot) => {
    const { training } = slot;
    const mine =
      training.recentAccuracy === null
        ? usual - UNTESTED_PENALTY
        : training.recentAccuracy - MISS_WEIGHT * (training.recentMisses ?? 0);
    const level = opponent?.[slot.category];
    const theirs = level ? level.accuracy - MISS_WEIGHT * level.misses : null;
    const risk =
      (training.accuracySpread ?? (training.finished === 0 ? 3 : 0)) / 2 +
      Math.max(0, ((training.unstableRate ?? UNSTEADY_UR) - UNSTEADY_UR) / 25);
    // Without anything on the opponent, slots are compared to the player's own level.
    const edge = mine - (theirs ?? usual);
    return { ...slot, mine, theirs, theirResult: level ?? null, edge, risk };
  });
}

function describe(slot: Rated): string {
  const { training } = slot;
  const parts =
    training.recentAccuracy === null
      ? ["pas encore terminée avec ses mods"]
      : [
          `${percent(training.recentAccuracy)} en moyenne`,
          `${(training.recentMisses ?? 0).toFixed(1).replace(".", ",").replace(",0", "")} miss`,
          ...(training.unstableRate
            ? [`UR ${Math.round(training.unstableRate)}`]
            : []),
        ];
  if (slot.theirs !== null)
    parts.push(`lui ≈ ${percent(slot.theirs)} en ${slot.category}`);
  return parts.join(" · ");
}

function verdictOf(slot: Rated): Verdict {
  if (slot.training.recentAccuracy === null) return "unknown";
  if (slot.edge > EVEN_GAP) return "ahead";
  if (slot.edge < -EVEN_GAP) return "behind";
  return "even";
}

function advice(slot: Rated, reason: string): SlotAdvice {
  const { training } = slot;
  return {
    slot: slot.slot,
    title: slot.title,
    category: slot.category,
    verdict: verdictOf(slot),
    mine:
      training.recentAccuracy === null
        ? null
        : { accuracy: training.recentAccuracy, misses: training.recentMisses ?? 0 },
    theirs: slot.theirResult,
    reason,
  };
}

/** A slot of the same mods if one is left, else the next best one. */
function backupFor(
  slot: Rated,
  index: number,
  picks: Rated[],
  spare: Rated[],
): Rated | undefined {
  return (
    spare.find(({ category }) => category === slot.category) ??
    picks.slice(index + 1).find(({ category }) => category === slot.category) ??
    spare[index] ??
    picks[index + 1]
  );
}

/**
 * Bans take out the slots where the player risks losing the most: a low result or an unsteady
 * one. Picks are the slots where they lead the most, each with a backup if it gets banned.
 * The tiebreaker is neither picked nor banned.
 */
export function planMatch(
  slots: PlannedSlot[],
  opponent: OpponentLevel | null,
  bans: number,
): MatchPlan {
  const rated = rate(
    slots.filter(({ category }) => category !== "TB"),
    opponent,
  );

  const banned = rated
    .toSorted((a, b) => a.edge - a.risk - (b.edge - b.risk))
    .slice(0, Math.max(0, bans));
  const open = rated.filter((slot) => !banned.includes(slot));

  const ranked = open.toSorted(
    (a, b) => b.edge - b.risk / 2 - (a.edge - a.risk / 2),
  );
  const picks = ranked.slice(0, PICKS_SHOWN);
  const spare = ranked.slice(PICKS_SHOWN);

  const theirPicks = open
    .toSorted((a, b) => a.edge - b.edge)
    .slice(0, THEIR_PICKS_SHOWN);
  const roleOf = (slot: Rated): SlotOverview["role"] =>
    banned.includes(slot)
      ? "ban"
      : picks.includes(slot)
        ? "pick"
        : theirPicks.includes(slot)
          ? "their-pick"
          : null;

  return {
    bans: banned.map((slot) =>
      advice(slot, describe(slot) + (slot.risk >= 2 ? " · résultats instables" : "")),
    ),
    picks: picks.map((slot, index) => ({
      ...advice(slot, describe(slot)),
      backup: backupFor(slot, index, picks, spare)?.slot,
    })),
    theirPicks: theirPicks.map((slot) => advice(slot, describe(slot))),
    overview: rated.map((slot) => ({
      slot: slot.slot,
      title: slot.title,
      category: slot.category,
      verdict: verdictOf(slot),
      role: roleOf(slot),
    })),
  };
}
