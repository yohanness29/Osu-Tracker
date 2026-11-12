import { describe, expect, it } from "vitest";
import { playerLevel, starsRangeForMods, type TopPlay } from "./level";
import {
  bestPerMap,
  ppAtAccuracy,
  rankSuggestions,
  rateMaps,
  type AnalyzedMap,
} from "./suggestions";

function topPlay(overrides: Partial<TopPlay> = {}): TopPlay {
  return {
    beatmapId: 1,
    pp: 300,
    stars: 4.5,
    mods: "HDDT",
    accuracy: 98,
    ...overrides,
  };
}

const ppByAccuracy = (pp100: number): AnalyzedMap["ppByAccuracy"] => [
  { accuracy: 95, pp: pp100 * 0.6 },
  { accuracy: 98, pp: pp100 * 0.8 },
  { accuracy: 100, pp: pp100 },
];

function map(beatmapId: number, mods: string, pp100: number): AnalyzedMap {
  return { beatmapId, mods, stars: 6, ppByAccuracy: ppByAccuracy(pp100) };
}

describe("playerLevel", () => {
  it("has no level without top plays", () => {
    expect(playerLevel([])).toBeNull();
  });

  it("finds the usual stars and ignores rare outliers", () => {
    const top = [
      ...Array.from({ length: 18 }, (_, index) =>
        topPlay({ stars: 4 + index * 0.05 }),
      ),
      topPlay({ stars: 1 }),
      topPlay({ stars: 9 }),
    ];
    const level = playerLevel(top)!;

    expect(level.minStars).toBeCloseTo(3.7);
    expect(level.maxStars).toBeCloseTo(5.1);
  });

  it("keeps the mods really used, and always the map without mods", () => {
    const top = [
      ...Array.from({ length: 9 }, () =>
        topPlay({ mods: "HDDT", accuracy: 98 }),
      ),
      topPlay({ mods: "FL", accuracy: 90 }),
      ...Array.from({ length: 30 }, () =>
        topPlay({ mods: "HR", accuracy: 96 }),
      ),
    ];
    const { mods } = playerLevel(top)!;

    expect(mods.map(({ mods: name }) => name).toSorted()).toEqual([
      "",
      "HDDT",
      "HR",
    ]);
    expect(mods.find(({ mods: name }) => name === "HDDT")?.accuracy).toBe(98);
  });
});

describe("starsRangeForMods", () => {
  const dtTop = Array.from({ length: 20 }, () =>
    topPlay({ stars: 4.5, mods: "HDDT" }),
  );

  it("searches harder maps when DT is not played", () => {
    const [min, max] = starsRangeForMods(dtTop, "");
    expect(min).toBeCloseTo(6);
    expect(max).toBeCloseTo(6.6);
  });

  it("keeps the same difficulty for players of the same speed", () => {
    const [min, max] = starsRangeForMods(dtTop, "DT");
    expect(min).toBeCloseTo(4.2);
    expect(max).toBeCloseTo(4.8);
  });

  it("searches easier maps for DT when the player does not use it", () => {
    const nomodTop = Array.from({ length: 20 }, () =>
      topPlay({ stars: 6, mods: "HD" }),
    );
    expect(starsRangeForMods(nomodTop, "HDDT")[0]).toBeCloseTo(6 / 1.4 - 0.3);
  });
});

describe("ppAtAccuracy", () => {
  const values = ppByAccuracy(100);

  it("interpolates between known accuracies", () => {
    expect(ppAtAccuracy(values, 99)).toBeCloseTo(90);
  });

  it("stays within known values", () => {
    expect(ppAtAccuracy(values, 90)).toBe(60);
    expect(ppAtAccuracy(values, 100)).toBe(100);
  });
});

describe("rankSuggestions", () => {
  const top = [
    topPlay({ beatmapId: 1, pp: 300 }),
    topPlay({ beatmapId: 2, pp: 280 }),
    topPlay({ beatmapId: 3, pp: 250 }),
  ];
  const level = playerLevel(top)!;

  it("sorts by real gain, at the usual accuracy of each mod", () => {
    const suggestions = rankSuggestions(
      [map(10, "HDDT", 300), map(11, "HDDT", 340)],
      top,
      level,
      null,
    );

    expect(suggestions.map(({ map: { beatmapId } }) => beatmapId)).toEqual([
      11, 10,
    ]);
    expect(suggestions[0]?.pp).toBeCloseTo(272);
    expect(suggestions[0]?.accuracy).toBe(98);
  });

  it("leaves out scores too far above the best one", () => {
    expect(rankSuggestions([map(10, "HDDT", 500)], top, level, null)).toEqual(
      [],
    );
  });

  it("leaves out maps already played better", () => {
    expect(rankSuggestions([map(1, "HDDT", 300)], top, level, null)).toEqual(
      [],
    );
  });

  it("uses a requested accuracy instead", () => {
    const [suggestion] = rankSuggestions(
      [map(10, "HDDT", 300)],
      top,
      level,
      100,
    );
    expect(suggestion).toMatchObject({ accuracy: 100, pp: 300 });
  });

  it("uses the overall accuracy for mods rarely used", () => {
    const [suggestion] = rankSuggestions(
      [map(10, "HR", 340)],
      top,
      level,
      null,
    );
    expect(suggestion?.accuracy).toBe(98);
  });

  it("gives the pp of an SS", () => {
    const [suggestion] = rankSuggestions(
      [map(10, "HDDT", 340)],
      top,
      level,
      null,
    );
    expect(suggestion?.ssPp).toBe(340);
  });
});

describe("rateMaps", () => {
  const top = [
    topPlay({ beatmapId: 1, pp: 300 }),
    topPlay({ beatmapId: 2, pp: 280 }),
  ];
  const level = playerLevel(top)!;

  it("keeps the maps giving nothing, with the reason", () => {
    const rated = rateMaps(
      [map(10, "HDDT", 340), map(11, "HDDT", 500), map(1, "HDDT", 300)],
      top,
      level,
      null,
    );
    expect(
      rated.map(({ map: { beatmapId }, excluded }) => [beatmapId, excluded]),
    ).toEqual([
      [10, null],
      [11, "unreachable"],
      [1, "no-gain"],
    ]);
  });
});

describe("bestPerMap", () => {
  it("keeps the first suggestion of each map", () => {
    const top = [topPlay()];
    const level = {
      ...playerLevel(top)!,
      mods: [
        { mods: "HDDT", accuracy: 98 },
        { mods: "", accuracy: 98 },
      ],
    };
    const ranked = rankSuggestions(
      [map(10, "HDDT", 340), map(10, "", 200)],
      top,
      level,
      null,
    );

    expect(bestPerMap(ranked).map(({ map: { mods } }) => mods)).toEqual([
      "HDDT",
    ]);
  });
});
