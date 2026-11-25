import { describe, expect, it } from "vitest";
import type {
  MatchScoreRow,
  PoolMap,
  RecentPlay,
  TournamentMatch,
  TournamentPool,
} from "@osu-tracker/storage";
import {
  categoryOfMods,
  compareOpponent,
  matchesSlot,
  headToHead,
  matchRounds,
  parseMatchId,
  parsePool,
  playersMet,
  reviewMatch,
  slotTraining,
  tournamentPlacement,
  tournamentStandings,
} from "./tournament";

let clock = 0;

function play(overrides: Partial<RecentPlay> = {}): RecentPlay {
  clock += 1000;
  return {
    id: `p${clock}`,
    sessionId: "s",
    beatmapChecksum: "c",
    beatmapId: 1,
    beatmapsetId: 1,
    title: "t",
    version: "v",
    artist: "a",
    mapper: "m",
    mode: "taiko",
    mods: "",
    result: "passed",
    partial: false,
    accuracy: 99,
    pp: 100,
    maxPp: null,
    noModMaxPp: null,
    netGain: null,
    rank: "S",
    score: 900000,
    stars: 2.4,
    ar: 0,
    bpm: 190,
    n300: 700,
    n100: 5,
    n50: 0,
    misses: 0,
    maxCombo: 400,
    sliderBreaks: 0,
    unstableRate: 130,
    hitError: 0,
    style: null,
    tags: [],
    mapTimeMs: 200000,
    lengthMs: 200000,
    startedAt: clock,
    endedAt: clock,
    ...overrides,
  };
}

/** Latest first, as the store gives them. */
function latestFirst(plays: RecentPlay[]): RecentPlay[] {
  return plays.toSorted((a, b) => b.endedAt - a.endedAt);
}

describe("parsePool", () => {
  it("reads slots with an id or a link, and lists the lines it cannot read", () => {
    const { entries, errors } = parsePool(
      [
        "NM1 4630139",
        "hd2: https://osu.ppy.sh/beatmapsets/1#taiko/1234",
        "DT1 - https://osu.ppy.sh/b/77",
        "TB 99",
        "",
        "NM1 5",
        "Rain & Petora",
      ].join("\n"),
    );
    expect(entries).toEqual([
      { slot: "NM1", beatmapId: 4630139, mods: "", freeMod: false },
      { slot: "HD2", beatmapId: 1234, mods: "HD", freeMod: false },
      { slot: "DT1", beatmapId: 77, mods: "DT", freeMod: false },
      { slot: "TB", beatmapId: 99, mods: "", freeMod: true },
    ]);
    expect(errors).toEqual(["NM1 5 (slot en double)", "Rain & Petora"]);
  });
});

describe("mods", () => {
  it("ignores the mods that do not change how a map plays", () => {
    expect(categoryOfMods("HDNFv2")).toBe("HD");
    expect(categoryOfMods("HDDT")).toBe("DT");
    expect(categoryOfMods("NC")).toBe("DT");
    expect(categoryOfMods("NFv2")).toBe("NM");
    expect(matchesSlot("HRNFv2", { mods: "HR", freeMod: false })).toBe(true);
    expect(matchesSlot("HDHR", { mods: "HR", freeMod: false })).toBe(false);
    expect(matchesSlot("HDHR", { mods: "", freeMod: true })).toBe(true);
  });
});

describe("slotTraining", () => {
  const slot = { beatmapId: 1, mods: "HD", freeMod: false };

  it("has nothing to judge before a play with the mods of the slot", () => {
    const training = slotTraining([play({ mods: "" })], slot);
    expect(training).toMatchObject({ attempts: 0, readiness: "untested" });
  });

  it("calls a steady slot ready", () => {
    const plays = latestFirst(
      [98.9, 99.1, 99.4].map((accuracy) => play({ mods: "HDv2", accuracy })),
    );
    const training = slotTraining(plays, slot);
    expect(training).toMatchObject({
      attempts: 3,
      finished: 3,
      readiness: "ready",
    });
    expect(training.best?.accuracy).toBe(99.4);
  });

  it("names what makes a slot weak, and counts finished multiplayer games", () => {
    const plays = latestFirst([
      play({
        mods: "HD",
        accuracy: 92.8,
        misses: 4,
        unstableRate: 237,
        hitError: -14,
      }),
      play({
        mods: "HDNF",
        result: "quit",
        accuracy: 95.4,
        misses: 2,
        unstableRate: 217,
      }),
      play({ mods: "HD", result: "retried", mapTimeMs: 30000, accuracy: 86 }),
    ]);
    const training = slotTraining(plays, slot);
    expect(training).toMatchObject({
      attempts: 3,
      finished: 2,
      readiness: "weak",
    });
    expect(training.reasons[0]).toContain("UR de 227");
  });
});

function score(overrides: Partial<MatchScoreRow>): MatchScoreRow {
  return {
    gameId: 1,
    position: 0,
    beatmapId: 1,
    title: "Map",
    version: "Futsuu",
    playedAt: 1,
    userId: 1,
    username: "me",
    mods: "NF",
    score: 900000,
    accuracy: 98,
    maxCombo: 400,
    n300: 390,
    n100: 10,
    misses: 0,
    passed: true,
    ...overrides,
  };
}

function match(scores: MatchScoreRow[]): TournamentMatch {
  return {
    id: "m",
    osuMatchId: 1,
    name: "x",
    startedAt: 0,
    importedAt: 0,
    scores,
  };
}

describe("compareOpponent", () => {
  it("compares qualifiers played in separate lobbies, map by map and per mods", () => {
    const mine = match([
      score({ beatmapId: 1, accuracy: 98.86, score: 943758 }),
      score({
        beatmapId: 2,
        mods: "HD",
        accuracy: 88.72,
        misses: 12,
        score: 695030,
      }),
    ]);
    const theirs = match([
      score({
        beatmapId: 1,
        userId: 2,
        username: "Tomadou",
        accuracy: 99,
        score: 970306,
      }),
      score({
        beatmapId: 2,
        userId: 2,
        mods: "HD",
        accuracy: 94.49,
        misses: 2,
        score: 878250,
      }),
      score({
        beatmapId: 3,
        userId: 2,
        mods: "DT",
        accuracy: 99.42,
        score: 1102511,
      }),
    ]);

    const { categories, maps } = compareOpponent([mine, theirs], 1, 2);
    expect(maps).toHaveLength(3);
    expect(
      categories.map(({ category, common }) => [category, common]),
    ).toEqual([
      ["NM", 1],
      ["HD", 1],
      ["DT", 0],
    ]);
    expect(categories[1]!.scoreRatio).toBeCloseTo(0.79, 2);
    expect(categories[2]!.mine).toBeNull();
  });

  it("lists the players met, the player apart", () => {
    const met = playersMet(
      [
        match([
          score({}),
          score({ userId: 2, username: "Tomadou" }),
          score({ gameId: 2, userId: 2 }),
        ]),
      ],
      1,
    );
    expect(met).toEqual([{ userId: 2, username: "Tomadou", games: 2 }]);
  });
});

describe("reviewMatch", () => {
  it("tells what lost each map", () => {
    const review = reviewMatch(
      match([
        // Better accuracy and fewer misses, lost all the same: the combo decided.
        score({ gameId: 1, accuracy: 98.77, misses: 3, score: 924875 }),
        score({
          gameId: 1,
          userId: 2,
          username: "Tomadou",
          accuracy: 98.7,
          misses: 8,
          score: 936538,
        }),
        score({ gameId: 2, accuracy: 98.42, misses: 1, score: 1000200 }),
        score({
          gameId: 2,
          userId: 2,
          username: "Tomadou",
          accuracy: 99.74,
          misses: 0,
          score: 1064121,
        }),
        score({ gameId: 3, accuracy: 99.5, misses: 0, score: 1050000 }),
        score({
          gameId: 3,
          userId: 2,
          username: "Tomadou",
          accuracy: 99,
          misses: 1,
          score: 1000000,
        }),
      ]),
      1,
    );
    expect(review).toMatchObject({
      wins: 1,
      losses: 2,
      opponent: { username: "Tomadou" },
    });
    expect(review!.games.map(({ lossReason }) => lossReason)).toEqual([
      "combo",
      "misses",
      null,
    ]);
    expect(review!.games[0]!.gap).toBe(-11663);
  });

  it("has nothing to review without an opponent", () => {
    expect(reviewMatch(match([score({})]), 1)).toBeNull();
  });
});

describe("parseMatchId", () => {
  it("reads the id of a match from its link", () => {
    expect(parseMatchId("https://osu.ppy.sh/community/matches/122114531")).toBe(
      122114531,
    );
    expect(parseMatchId("https://osu.ppy.sh/mp/122135052")).toBe(122135052);
    expect(parseMatchId(" 122135052 ")).toBe(122135052);
    expect(parseMatchId("https://osu.ppy.sh/beatmaps/1")).toBeNull();
  });
});

describe("matchRounds", () => {
  const pool = (id: string, beatmapIds: number[]): TournamentPool => ({
    id,
    name: id,
    createdAt: 0,
    bestOf: null,
    bans: null,
    maps: beatmapIds.map((beatmapId) => ({ beatmapId }) as PoolMap),
  });
  const at = (
    id: string,
    startedAt: number,
    beatmapIds: number[],
  ): TournamentMatch => ({
    ...match(
      beatmapIds.map((beatmapId, gameId) => score({ gameId, beatmapId })),
    ),
    id,
    startedAt,
  });
  const quals = pool("Quals", [1, 2, 3]);
  const ro32 = pool("RO32", [3, 4, 5, 6]);

  it("groups the matches by the pool they share the most maps with, latest round first", () => {
    const rounds = matchRounds(
      [
        at("bracket", 20, [4, 5, 3]),
        at("lobby", 10, [1, 2, 3]),
        at("other", 5, [99]),
      ],
      [quals, ro32],
    );
    expect(
      rounds.map((round) => [
        round.pool?.id ?? null,
        round.matches.map(({ id }) => id),
      ]),
    ).toEqual([
      ["RO32", ["bracket"]],
      ["Quals", ["lobby"]],
      [null, ["other"]],
    ]);
  });

  it("leaves out the warm-ups played out of the pool", () => {
    const [round] = matchRounds([at("bracket", 0, [98, 4, 5])], [ro32]);
    expect(round!.matches[0]!.scores.map(({ beatmapId }) => beatmapId)).toEqual(
      [4, 5],
    );
  });
});

describe("headToHead", () => {
  const between = (name: string, scores: MatchScoreRow[]): TournamentMatch => ({
    ...match(scores),
    name,
  });

  it("reads a match between two other players from the side named first", () => {
    const result = headToHead(
      between("BTT10: (melkkoe) vs. (Pilot_BFFRI)", [
        score({ gameId: 1, userId: 2, username: "Pilot_BFFRI", score: 800000 }),
        score({ gameId: 1, userId: 3, username: "melkkoe", score: 990000 }),
        score({ gameId: 2, userId: 2, username: "Pilot_BFFRI", score: 950000 }),
        score({ gameId: 2, userId: 3, username: "melkkoe", score: 900000 }),
      ]),
    );
    expect(result?.player.username).toBe("melkkoe");
    expect(result?.review.opponent.username).toBe("Pilot_BFFRI");
    expect([result?.review.wins, result?.review.losses]).toEqual([1, 1]);
  });

  it("leaves out a lobby of several players", () => {
    expect(
      headToHead(
        between("Qualifiers Lobby 1", [
          score({ userId: 1 }),
          score({ userId: 2 }),
          score({ userId: 3 }),
        ]),
      ),
    ).toBeNull();
  });
});

describe("tournamentStandings", () => {
  const lobby = (
    id: string,
    results: [userId: number, beatmapId: number, points: number][],
  ): TournamentMatch => ({
    ...match(
      results.map(([userId, beatmapId, points], gameId) =>
        score({
          gameId,
          userId,
          beatmapId,
          score: points,
          username: `p${userId}`,
        }),
      ),
    ),
    id,
    name: `Qualifiers ${id}`,
  });
  const versus = (
    a: number,
    b: number,
    winsOfA: number,
    winsOfB: number,
  ): TournamentMatch => ({
    ...match(
      Array.from({ length: winsOfA + winsOfB }, (_, gameId) => [
        score({
          gameId,
          userId: a,
          username: `p${a}`,
          score: gameId < winsOfA ? 2 : 1,
        }),
        score({
          gameId,
          userId: b,
          username: `p${b}`,
          score: gameId < winsOfA ? 1 : 2,
        }),
      ]).flat(),
    ),
    name: `(p${a}) vs. (p${b})`,
  });
  // On two maps: p1 first twice, p2 second twice, p3 and p4 share the rest, p4 missed a map.
  const quals = [
    lobby("1", [
      [1, 10, 900],
      [2, 10, 800],
      [3, 10, 700],
      [4, 10, 750],
      [1, 11, 900],
      [2, 11, 800],
      [3, 11, 700],
    ]),
  ];

  it("seeds by the sum of the ranks on each map, a missed map ranked last", () => {
    const standings = tournamentStandings(quals, {
      qualifiedCount: null,
      loserBracket: false,
    });
    expect(standings.map(({ userId, seed }) => [userId, seed])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ]);
  });

  it("gives equal scores the same rank, whatever the order they come in", () => {
    const seeds = (order: number[]): (number | null)[] => {
      const results: Record<number, [number, number][]> = {
        1: [
          [10, 1000000],
          [11, 800000],
        ],
        2: [
          [10, 1000000],
          [11, 900000],
        ],
        3: [
          [10, 700000],
          [11, 950000],
        ],
      };
      return tournamentStandings(
        [
          lobby(
            "1",
            order.flatMap((userId) =>
              results[userId]!.map(
                ([beatmapId, points]) => [userId, beatmapId, points] as const,
              ),
            ) as [number, number, number][],
          ),
        ],
        { qualifiedCount: null, loserBracket: false },
      )
        .toSorted((a, b) => a.userId - b.userId)
        .map(({ seed }) => seed);
    };
    // p2: ranks 1 and 2; p1 and p3: 1 + 3 and 3 + 1, p1 ahead on total score.
    expect(seeds([1, 2, 3])).toEqual([2, 1, 3]);
    expect(seeds([3, 2, 1])).toEqual([2, 1, 3]);
  });

  it("puts out the players not qualified, then those who lost too many matches", () => {
    const matches = [...quals, versus(1, 2, 1, 4)];
    const out = (loserBracket: boolean): number[] =>
      tournamentStandings(matches, { qualifiedCount: 3, loserBracket })
        .filter(({ eliminated }) => eliminated)
        .map(({ userId }) => userId);
    expect(out(false)).toEqual([1, 4]);
    expect(out(true)).toEqual([4]);
  });
});

describe("tournamentStandings with a bracket", () => {
  const quals: TournamentMatch = {
    ...match(
      [1, 2, 3].map((userId) =>
        score({ userId, username: `p${userId}`, beatmapId: 10, score: 1000 - userId }),
      ),
    ),
    name: "Qualifiers",
  };

  it("trusts the bracket for its players, forfeits included", () => {
    const standings = tournamentStandings(
      [quals],
      { qualifiedCount: null, loserBracket: true },
      // p2 lost by forfeit twice: no match to import, the bracket knows.
      { players: ["P1", "p2"], out: ["p2"] },
    );
    expect(standings.map(({ userId, eliminated }) => [userId, eliminated])).toEqual([
      [1, false],
      [2, true],
      [3, false],
    ]);
  });
});

describe("tournamentStandings by hand", () => {
  it("puts a choice by hand above the bracket and the matches", () => {
    const quals: TournamentMatch = {
      ...match(
        [1, 2].map((userId) =>
          score({ userId, username: `p${userId}`, beatmapId: 10, score: 1000 - userId }),
        ),
      ),
      name: "Qualifiers",
    };
    const standings = tournamentStandings(
      [quals],
      { qualifiedCount: null, loserBracket: false },
      { players: ["p1", "p2"], out: ["p1"] },
      [
        { userId: 1, eliminated: false },
        { userId: 2, eliminated: true },
      ],
    );
    expect(
      standings.map(({ userId, eliminated, decidedBy }) => [userId, eliminated, decidedBy]),
    ).toEqual([
      [1, false, "hand"],
      [2, true, "hand"],
    ]);
  });
});

describe("tournamentPlacement", () => {
  const pool = (name: string, beatmapId: number): TournamentPool => ({
    id: name,
    name,
    createdAt: 0,
    bestOf: null,
    bans: null,
    maps: [{ beatmapId } as PoolMap],
  });
  const pools = [pool("Quals", 10), pool("SF", 20), pool("F", 30)];
  // One map each: p1 to p4 seeded in this order.
  const quals: TournamentMatch = {
    ...match(
      [1, 2, 3, 4].map((userId) =>
        score({ userId, username: `p${userId}`, beatmapId: 10, score: 1000 - userId }),
      ),
    ),
    name: "Qualifiers",
  };
  const versus = (
    winner: number,
    loser: number,
    beatmapId: number,
    startedAt: number,
  ): TournamentMatch => ({
    ...match([
      score({ userId: winner, username: `p${winner}`, beatmapId, score: 2 }),
      score({ userId: loser, username: `p${loser}`, beatmapId, score: 1 }),
    ]),
    id: `${winner}-${loser}`,
    name: `(p${winner}) vs. (p${loser})`,
    startedAt,
  });
  const semis = [versus(1, 4, 20, 1), versus(2, 3, 20, 2)];
  const single = { qualifiedCount: 4, loserBracket: false };
  const placementOf = (
    matches: TournamentMatch[],
    userId: number,
    format = single,
  ): ReturnType<typeof tournamentPlacement> =>
    tournamentPlacement([quals, ...matches], pools, format, userId);

  it("places a player lost in a round between its size and the next one", () => {
    expect(placementOf(semis, 4)).toEqual({ kind: "placed", high: 4, low: 3 });
  });

  it("gives 2 to the finalist and 1 to the winner", () => {
    const final = [...semis, versus(1, 2, 30, 3)];
    expect(placementOf(final, 2)).toEqual({ kind: "placed", high: 2, low: 2 });
    expect(placementOf(final, 1)).toEqual({ kind: "placed", high: 1, low: 1 });
  });

  it("keeps a player in the tournament until their last allowed loss", () => {
    expect(placementOf(semis, 1)).toEqual({ kind: "alive" });
    expect(placementOf(semis, 4, { qualifiedCount: 4, loserBracket: true })).toEqual({
      kind: "alive",
    });
  });

  it("tells a player the qualifiers left out", () => {
    expect(placementOf([], 3, { qualifiedCount: 2, loserBracket: false })).toEqual({
      kind: "dnq",
    });
    expect(placementOf([], 9)).toEqual({ kind: "unknown" });
  });
});
