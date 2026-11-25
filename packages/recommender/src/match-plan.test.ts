import { describe, expect, it } from "vitest";
import type { SlotTraining } from "@osu-tracker/stats";
import { planMatch, type PlannedSlot } from "./match-plan";

function training(overrides: Partial<SlotTraining> = {}): SlotTraining {
  return {
    attempts: 3,
    finished: 3,
    best: null,
    recentAccuracy: 98,
    recentMisses: 1,
    unstableRate: 140,
    hitError: 0,
    accuracySpread: 1,
    readiness: "ready",
    reasons: [],
    ...overrides,
  };
}

function slot(
  name: string,
  category: PlannedSlot["category"],
  overrides: Partial<SlotTraining> = {},
): PlannedSlot {
  return {
    slot: name,
    title: `Map ${name}`,
    category,
    training: training(overrides),
  };
}

// The RO32 pool of the 14/11 match, roughly as trained.
const pool = [
  slot("NM1", "NM", { recentAccuracy: 99.8, recentMisses: 0 }),
  slot("NM3", "NM", { recentAccuracy: 99.3, recentMisses: 1 }),
  slot("HD1", "HD", {
    recentAccuracy: 95.4,
    recentMisses: 0,
    unstableRate: 170,
  }),
  slot("HD3", "HD", {
    recentAccuracy: 94,
    recentMisses: 3,
    unstableRate: 230,
    accuracySpread: 8,
    readiness: "weak",
  }),
  slot("HR1", "HR", {
    recentAccuracy: 97,
    recentMisses: 3,
    readiness: "fragile",
  }),
  slot("DT1", "DT", { recentAccuracy: 94.3, recentMisses: 0 }),
  slot("DT2", "DT", { recentAccuracy: 97.4, recentMisses: 0 }),
  slot("TB", "TB", { recentAccuracy: 98.9, recentMisses: 0 }),
];

describe("planMatch", () => {
  it("bans the slot where the player risks losing the most, never the tiebreaker", () => {
    const plan = planMatch(
      pool,
      { HD: { accuracy: 99.5, misses: 0 }, DT: { accuracy: 99.4, misses: 0 } },
      1,
    );
    expect(plan.bans.map(({ slot: name }) => name)).toEqual(["HD3"]);
    expect(plan.bans[0]!.reason).toContain("résultats instables");
    expect(plan.picks.map(({ slot: name }) => name)).not.toContain("TB");
  });

  it("picks the strongest slots first, with a backup of the same mods", () => {
    const plan = planMatch(pool, null, 1);
    expect(plan.picks[0]).toMatchObject({ slot: "NM1", backup: "NM3" });
  });

  it("expects the opponent to pick where they lead the most", () => {
    const plan = planMatch(
      pool,
      { DT: { accuracy: 99.4, misses: 0 }, NM: { accuracy: 98, misses: 0 } },
      1,
    );
    expect(plan.theirPicks[0]!.slot).toBe("DT1");
    expect(plan.theirPicks[0]!.reason).toContain("lui ≈ 99,4 % en DT");
  });

  it("gives every slot but the tiebreaker a verdict against the opponent", () => {
    const plan = planMatch(
      [...pool, slot("HR2", "HR", { recentAccuracy: null, finished: 0 })],
      { HD: { accuracy: 99.5, misses: 0 }, NM: { accuracy: 98, misses: 1 } },
      1,
    );
    const verdicts = Object.fromEntries(
      plan.overview.map(({ slot: name, verdict }) => [name, verdict]),
    );
    expect(verdicts).toMatchObject({
      NM1: "ahead",
      HD3: "behind",
      HR2: "unknown",
    });
    expect(verdicts.TB).toBeUndefined();
    expect(plan.overview.find(({ slot: name }) => name === "HD3")!.role).toBe("ban");
    expect(plan.bans[0]!.theirs).toEqual({ accuracy: 99.5, misses: 0 });
  });
});
