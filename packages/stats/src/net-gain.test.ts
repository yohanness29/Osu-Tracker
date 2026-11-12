import { describe, expect, it } from "vitest";
import { netPpGain } from "./net-gain";

const top = [
  { beatmapId: 1, pp: 300 },
  { beatmapId: 2, pp: 200 },
  { beatmapId: 3, pp: 100 },
];

describe("netPpGain", () => {
  it("weights a new score by its place", () => {
    // 300 + 200×0.95 + 150×0.9025 + 100×0.857375, against 300 + 200×0.95 + 100×0.9025.
    expect(netPpGain(top, { beatmapId: 4, pp: 150 })).toBeCloseTo(
      150 * 0.9025 + 100 * 0.857375 - 100 * 0.9025,
    );
  });

  it("gives little for a score at the bottom", () => {
    expect(netPpGain(top, { beatmapId: 4, pp: 50 })).toBeCloseTo(50 * 0.857375);
  });

  it("gives nothing when the map already has a better score", () => {
    expect(netPpGain(top, { beatmapId: 2, pp: 150 })).toBe(0);
  });

  it("only counts the improvement on a map already in the top", () => {
    expect(netPpGain(top, { beatmapId: 2, pp: 250 })).toBeCloseTo(50 * 0.95);
  });

  it("ignores scores below a full top 100", () => {
    const full = Array.from({ length: 100 }, (_, index) => ({
      beatmapId: index,
      pp: 500 - index,
    }));
    expect(netPpGain(full, { beatmapId: 1000, pp: 100 })).toBe(0);
  });

  it("pushes the last score out of a full top 100", () => {
    const full = Array.from({ length: 100 }, (_, index) => ({
      beatmapId: index,
      pp: 500 - index,
    }));
    const gain = netPpGain(full, { beatmapId: 1000, pp: 402 });
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThan(402 * 0.95 ** 99);
  });
});
