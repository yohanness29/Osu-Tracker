import { describe, expect, it } from "vitest";
import type { Goal, RecentPlay } from "@osu-tracker/storage";
import {
  detectFatigue,
  findWeakSpots,
  goalProgress,
  sessionProgress,
} from "./index";

let nextStart = 0;

function play(overrides: Partial<RecentPlay> = {}): RecentPlay {
  nextStart += 60000;
  return {
    id: "p",
    sessionId: "s",
    beatmapChecksum: "c",
    beatmapId: 1,
    beatmapsetId: 1,
    title: "t",
    version: "v",
    artist: "a",
    mapper: "m",
    mode: "osu",
    mods: "",
    result: "passed",
    partial: false,
    accuracy: 96,
    pp: 100,
    maxPp: null,
    noModMaxPp: null,
    netGain: null,
    rank: "A",
    score: 1000,
    stars: 5.5,
    ar: 9.5,
    bpm: 180,
    n300: 90,
    n100: 8,
    n50: 2,
    misses: 1,
    sliderBreaks: 0,
    unstableRate: 120,
    hitError: -2,
    style: "Aim",
    tags: [],
    mapTimeMs: 60000,
    lengthMs: 60000,
    startedAt: nextStart,
    endedAt: nextStart + 50000,
    ...overrides,
  };
}

function goal(overrides: Partial<Goal>): Goal {
  return {
    id: "g",
    sessionId: "s",
    type: "passes",
    target: 2,
    minStars: null,
    createdAt: 0,
    ...overrides,
  };
}

describe("detectFatigue", () => {
  it("needs enough long plays", () => {
    const plays = [
      play(),
      play(),
      play({ mapTimeMs: 1000 }),
      play({ score: 0 }),
    ];
    expect(detectFatigue(plays)).toEqual({
      status: "insufficient",
      playsNeeded: 4,
    });
  });

  it("detects a drop of accuracy at the end of a session", () => {
    const plays = [98, 98, 98, 96, 95, 95, 94].map((accuracy) =>
      play({ accuracy }),
    );
    const fatigue = detectFatigue(plays);

    expect(fatigue.status).toBe("declining");
    if (fatigue.status === "insufficient") return;
    expect(fatigue.accuracyChange).toBeCloseTo(-3.5);
    expect(fatigue.lateFromMs).toBe(300000);
  });

  it("reports maps getting harder at the end of a session", () => {
    const plays = [5, 5, 5, 6, 6, 6].map((stars) => play({ stars }));
    const fatigue = detectFatigue(plays);

    if (fatigue.status === "insufficient") throw new Error("not analyzed");
    expect(fatigue.starsChange).toBeCloseTo(1);
  });

  it("detects a worse unstable rate even with the same accuracy", () => {
    const plays = [100, 100, 105, 110, 130, 135].map((unstableRate) =>
      play({ unstableRate }),
    );
    expect(detectFatigue(plays).status).toBe("declining");
  });

  it("sees a session getting better, or stable", () => {
    const better = [93, 93, 95, 96, 97, 97].map((accuracy) =>
      play({ accuracy }),
    );
    const stable = [96, 96.2, 96, 96.1, 96, 96.3].map((accuracy) =>
      play({ accuracy }),
    );

    expect(detectFatigue(better).status).toBe("improving");
    expect(detectFatigue(stable).status).toBe("stable");
  });

  it("reads plays in order whatever the order received", () => {
    const plays = [98, 98, 98, 94, 94, 94].map((accuracy) =>
      play({ accuracy }),
    );
    expect(detectFatigue(plays.toReversed()).status).toBe("declining");
  });
});

describe("goalProgress", () => {
  it("counts passes", () => {
    const plays = [play(), play({ result: "failed" })];
    expect(goalProgress(goal({ target: 2 }), plays, null)).toEqual({
      current: 1,
      target: 2,
      done: false,
    });
  });

  it("counts full combos above a difficulty", () => {
    const plays = [
      play({ misses: 0, stars: 6.2 }),
      play({ misses: 0, stars: 5 }),
      play({ misses: 0, sliderBreaks: 1, stars: 7 }),
      play({ misses: 0, stars: 7, result: "quit" }),
    ];
    const fullCombos = goal({ type: "full_combos", target: 1, minStars: 6 });

    expect(goalProgress(fullCombos, plays, null)).toMatchObject({
      current: 1,
      done: true,
    });
  });

  it("uses the pp gain given by the caller", () => {
    const gain = goal({ type: "pp_gain", target: 20 });

    expect(goalProgress(gain, [], 25).done).toBe(true);
    expect(goalProgress(gain, [], null)).toMatchObject({
      current: null,
      done: false,
    });
  });

  it("averages accuracy on passes", () => {
    const plays = [
      play({ accuracy: 98 }),
      play({ accuracy: 96 }),
      play({ accuracy: 50, result: "failed" }),
    ];
    expect(
      goalProgress(goal({ type: "accuracy", target: 97 }), plays, null),
    ).toMatchObject({
      current: 97,
      done: true,
    });
  });
});

describe("findWeakSpots", () => {
  const easy = Array.from({ length: 10 }, () => play({ ar: 9.5 }));
  const hard = Array.from({ length: 6 }, (_, index) =>
    play({ ar: 10.3, result: index < 5 ? "failed" : "passed" }),
  );

  it("finds where the player fails more than usual", () => {
    const { weakest, overallPassRate } = findWeakSpots([...easy, ...hard]);

    expect(overallPassRate).toBeCloseTo(68.75);
    expect(weakest[0]).toMatchObject({
      dimension: "Approach rate",
      label: "AR 10+",
      plays: 6,
    });
    expect(weakest[0]?.gap).toBeCloseTo(52.08, 1);
  });

  it("compares a style to what the same difficulty gives", () => {
    const hardMaps = Array.from({ length: 8 }, (_, index) =>
      play({
        stars: 7.2,
        style: index % 2 ? "Stream" : "Aim",
        result: index % 4 ? "failed" : "passed",
      }),
    );
    const { weakest, dimensions } = findWeakSpots([...easy, ...hardMaps]);

    expect(weakest.filter(({ dimension }) => dimension === "Style")).toEqual(
      [],
    );
    expect(
      dimensions.find(({ title }) => title === "Style")?.buckets[1]
        ?.averageStars,
    ).toBeCloseTo(7.2);
  });

  it("finds a style failing more than its difficulty explains", () => {
    const maps = Array.from({ length: 16 }, (_, index) => {
      const stream = index % 2 === 0;
      return play({
        style: stream ? "Stream" : "Aim",
        result: stream ? "failed" : "passed",
      });
    });
    expect(findWeakSpots(maps).weakest[0]).toMatchObject({
      dimension: "Style",
      label: "Stream",
    });
  });

  it("counts a play in each of its tags", () => {
    const plays = [
      play({ tags: ["Deathstream", "Bursts"] }),
      play({ tags: ["Bursts"], result: "failed" }),
    ];
    const buckets = findWeakSpots(plays).dimensions.find(
      ({ title }) => title === "Particularités",
    )?.buckets;
    expect(
      buckets?.map(({ label, plays: count, passRate }) => [
        label,
        count,
        passRate,
      ]),
    ).toEqual([
      ["Bursts", 2, 50],
      ["Deathstream", 1, 100],
    ]);
  });

  it("leaves out maps without a style", () => {
    const { dimensions } = findWeakSpots([play({ style: null })]);
    expect(dimensions.find(({ title }) => title === "Style")?.buckets).toEqual(
      [],
    );
  });

  it("needs enough plays before calling something weak", () => {
    const few = [
      play({ ar: 10.3, result: "failed" }),
      play({ ar: 10.4, result: "failed" }),
    ];
    expect(findWeakSpots([...easy, ...few]).weakest).toEqual([]);
  });

  it("ignores retries, quits and empty plays", () => {
    const plays = [
      play(),
      play({ result: "quit" }),
      play({ result: "retried" }),
      play({ score: 0 }),
    ];
    expect(findWeakSpots(plays).finishedPlays).toBe(1);
  });

  it("keeps buckets in a natural order", () => {
    const plays = [play({ ar: 10.5 }), play({ ar: 8 }), play({ ar: 9.5 })];
    const ar = findWeakSpots(plays).dimensions.find(
      ({ title }) => title === "Approach rate",
    );
    expect(ar?.buckets.map(({ label }) => label)).toEqual([
      "AR 0–9",
      "AR 9–10",
      "AR 10+",
    ]);
  });

  it("uses the length really played with DT", () => {
    const plays = [
      play({ lengthMs: 150000, mods: "HDDT" }),
      play({ lengthMs: 150000, mods: "" }),
    ];
    const length = findWeakSpots(plays).dimensions.find(
      ({ title }) => title === "Longueur",
    );

    expect(length?.buckets.map(({ label }) => label)).toEqual([
      "Moins de 2 min",
      "2 à 4 min",
    ]);
  });

  it("sorts difficulty tranches by value", () => {
    const plays = [play({ stars: 10.2 }), play({ stars: 5.1 })];
    const stars = findWeakSpots(plays).dimensions.find(
      ({ title }) => title === "Étoiles",
    );
    expect(stars?.buckets.map(({ label }) => label)).toEqual([
      "5–6★",
      "10–11★",
    ]);
  });

  it("splits BPM by steps of 10, in order", () => {
    const plays = [149, 150, 159.9, 160, 269, 270, 320].map((bpm) =>
      play({ bpm }),
    );
    const bpm = findWeakSpots(plays).dimensions.find(
      ({ title }) => title === "BPM",
    );

    expect(
      bpm?.buckets.map(({ label, plays: count }) => [label, count]),
    ).toEqual([
      ["<150", 1],
      ["150–160", 2],
      ["160–170", 1],
      ["260–270", 1],
      ["270+", 2],
    ]);
  });

  it("averages accuracy on passes only", () => {
    const plays = [
      play({ accuracy: 98 }),
      play({ accuracy: 96 }),
      play({ accuracy: 50, result: "failed" }),
    ];
    expect(findWeakSpots(plays).overallAccuracy).toBe(97);
  });

  it("has no pass rate without finished plays", () => {
    expect(findWeakSpots([]).overallPassRate).toBeNull();
  });
});

describe("sessionProgress", () => {
  it("gives one point per session with a pass, oldest first", () => {
    const points = sessionProgress([
      play({ sessionId: "b", accuracy: 97 }),
      play({ sessionId: "b", accuracy: 95 }),
      play({ sessionId: "c", result: "failed" }),
      play({ sessionId: "a", accuracy: 90, startedAt: 1 }),
    ]);

    expect(
      points.map(({ sessionId, accuracy }) => [sessionId, accuracy]),
    ).toEqual([
      ["a", 90],
      ["b", 96],
    ]);
  });

  it("averages timing and counts imperfect hits", () => {
    const [point] = sessionProgress([
      play({ hitError: -4, n300: 90, n100: 8, n50: 2 }),
      play({ hitError: 2, n300: 100, n100: 0, n50: 0 }),
      play({ hitError: null }),
    ]);

    expect(point?.hitError).toBe(-1);
    expect(point?.imperfectShare).toBeCloseTo(((10 + 10) / 300) * 100);
  });
});
