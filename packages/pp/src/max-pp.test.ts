import { describe, expect, it } from "vitest";
import { analyzeMap, analyzeMods } from "./max-pp";

const hitObjects = Array.from({ length: 200 }, (_, index) => {
  const x = 100 + (index % 2) * 300;
  const y = 100 + (index % 3) * 80;
  return `${x},${y},${1000 + index * 150},1,0,0:0:0:0:`;
});

const content = [
  "osu file format v14",
  "[General]",
  "Mode: 0",
  "[Difficulty]",
  "HPDrainRate:5",
  "CircleSize:4",
  "OverallDifficulty:8",
  "ApproachRate:9",
  "SliderMultiplier:1.4",
  "SliderTickRate:1",
  "[TimingPoints]",
  "0,300,4,2,1,60,1,0",
  "[HitObjects]",
  ...hitObjects,
].join("\n");

describe("analyzeMods", () => {
  it("applies the mods to the difficulty values", async () => {
    const [nm, hr, dt] = await analyzeMods({
      content,
      mode: "osu",
      lazer: false,
      mods: ["", "HR", "HDDT"],
    });

    expect(nm).toMatchObject({ ar: 9, od: 8, cs: 4, hp: 5 });
    expect(hr?.ar).toBe(10);
    expect(hr?.cs).toBeCloseTo(5.2);
    expect(dt?.ar).toBeCloseTo(10.33, 2);
    expect(dt?.od).toBeCloseTo(9.78, 2);
    expect(dt?.stars).toBeGreaterThan(nm!.stars);
  });
});

describe("analyzeMap", () => {
  it("returns a positive value for a map", async () => {
    const { maxPp, style, tags } = await analyzeMap({
      content,
      mode: "osu",
      lazer: false,
    });
    expect(maxPp).toBeGreaterThan(0);
    expect(style).not.toBeNull();
    expect(Array.isArray(tags)).toBe(true);
  });

  it("handles maps converted to another mode", async () => {
    const { maxPp, style } = await analyzeMap({
      content,
      mode: "taiko",
      lazer: false,
    });
    expect(maxPp).toBeGreaterThan(0);
    expect(["Stamina", "Rythme", "Couleur"]).toContain(style);
  });
});
