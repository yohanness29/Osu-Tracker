import { describe, expect, it } from "vitest";
import { classifyMapStyle, type StyleAttributes } from "./map-style";

const attributes: StyleAttributes = {
  aim: 3,
  speed: 2.4,
  stamina: 0,
  rhythm: 0,
  color: 0,
};

function mapWith(gaps: number[], type = 1): string {
  let time = 0;
  const objects = gaps.map((gap) => {
    time += gap;
    return `100,100,${time},${type},0`;
  });
  return ["[General]", "[HitObjects]", ...objects].join("\r\n");
}

const spaced = Array.from({ length: 40 }, () => 300);
const fast = Array.from({ length: 20 }, () => 100);

describe("classifyMapStyle", () => {
  it("finds streams from fast runs of notes", () => {
    expect(
      classifyMapStyle(mapWith([...spaced, ...fast]), "osu", attributes).style,
    ).toBe("Stream");
  });

  it("ignores short bursts", () => {
    const bursts = Array.from({ length: 40 }, (_, index) =>
      index % 4 === 3 ? 300 : 100,
    );
    expect(classifyMapStyle(mapWith(bursts), "osu", attributes).style).toBe(
      "Équilibré",
    );
  });

  it("separates aim and speed maps", () => {
    const map = mapWith(spaced);
    expect(
      classifyMapStyle(map, "osu", { ...attributes, aim: 3.4, speed: 1.8 })
        .style,
    ).toBe("Aim");
    expect(
      classifyMapStyle(map, "osu", { ...attributes, aim: 3, speed: 3 }).style,
    ).toBe("Speed");
  });

  it("uses the strongest skill in taiko", () => {
    const skills = { ...attributes, stamina: 1.9, rhythm: 0.5, color: 0.9 };
    expect(classifyMapStyle("", "taiko", skills).style).toBe("Stamina");
    expect(classifyMapStyle("", "taiko", { ...skills, rhythm: 3 }).style).toBe(
      "Rythme",
    );
    expect(classifyMapStyle("", "taiko", { ...skills, color: 3 }).style).toBe(
      "Couleur",
    );
  });

  it("separates rice and long notes in mania", () => {
    expect(
      classifyMapStyle(mapWith(spaced, 128), "mania", attributes).style,
    ).toBe("Long notes");
    expect(classifyMapStyle(mapWith(spaced), "mania", attributes).style).toBe(
      "Rice",
    );
  });

  it("has no style for catch", () => {
    expect(classifyMapStyle("", "fruits", attributes).style).toBeNull();
  });
});

type Note = { x: number; y: number; gap: number; type?: number; end?: number };

function mapOf(notes: Note[], timingPoints = ["0,300,4,1,0,100,1,0"]): string {
  let time = 0;
  const objects = notes.map(({ x, y, gap, type = 1, end }) => {
    time += gap;
    return type === 8
      ? `256,192,${time},8,0,${time + (end ?? 0)}`
      : `${x},${y},${time},${type},0`;
  });
  return [
    "[Difficulty]",
    "CircleSize:4",
    "[TimingPoints]",
    ...timingPoints,
    "[HitObjects]",
    ...objects,
  ].join("\r\n");
}

function tagsOf(content: string): string[] {
  return classifyMapStyle(content, "osu", attributes).tags;
}

/** Notes moving right by `step` pixels, wrapping inside the playfield. */
function line(count: number, gap: number, step: number): Note[] {
  return Array.from({ length: count }, (_, index) => ({
    x: (index * step) % 500,
    y: 100 + Math.floor((index * step) / 500) * 10,
    gap,
  }));
}

describe("map tags", () => {
  it("has none for a plain map", () => {
    expect(tagsOf(mapOf(line(100, 300, 120)))).toEqual([]);
  });

  it("finds deathstreams and spaced streams", () => {
    expect(tagsOf(mapOf(line(80, 75, 30)))).toEqual(["Deathstream"]);
    expect(tagsOf(mapOf([...line(60, 300, 120), ...line(20, 75, 80)]))).toEqual(
      ["Streams espacés"],
    );
  });

  it("finds bursts", () => {
    const bursts = Array.from({ length: 40 }, (_, index) => ({
      x: (index * 47) % 500,
      y: 100,
      gap: index % 4 === 0 ? 300 : 75,
    }));
    expect(tagsOf(mapOf(bursts))).toContain("Bursts");
  });

  it("finds jumps across the screen", () => {
    const jumps = Array.from({ length: 40 }, (_, index) => ({
      x: index % 2 ? 450 : 50,
      y: 192,
      gap: 300,
    }));
    expect(tagsOf(mapOf(jumps))).toEqual(["Gros jumps"]);
  });

  it("finds rhythms on a 1/3 grid", () => {
    expect(tagsOf(mapOf(line(60, 200, 120)))).toEqual(["Rythme 1/3 – 1/6"]);
  });

  it("counts real changes of slider speed only", () => {
    const changing = Array.from(
      { length: 20 },
      (_, index) => `${index * 1000},${index % 2 ? -50 : -100},4,1,0,100,0,0`,
    );
    const volumeOnly = Array.from(
      { length: 20 },
      (_, index) => `${index * 1000},-100,4,1,0,${50 + index},0,0`,
    );
    const notes = line(100, 300, 120);
    expect(tagsOf(mapOf(notes, ["0,300,4,1,0,100,1,0", ...changing]))).toEqual([
      "Changements de SV",
    ]);
    expect(
      tagsOf(mapOf(notes, ["0,300,4,1,0,100,1,0", ...volumeOnly])),
    ).toEqual([]);
  });

  it("finds stacks and overlaps", () => {
    const stacked = Array.from({ length: 40 }, (_, index) => ({
      x: (Math.floor(index / 2) * 120) % 500,
      y: 100,
      gap: 300,
    }));
    expect(tagsOf(mapOf(stacked))).toEqual(["Stacks"]);
    expect(tagsOf(mapOf(line(60, 300, 30)))).toEqual(["Overlaps"]);
  });

  it("finds long spinners", () => {
    const notes = [
      ...line(40, 300, 120),
      { x: 0, y: 0, gap: 300, type: 8, end: 4000 },
    ];
    expect(tagsOf(mapOf(notes))).toEqual(["Spinners"]);
  });

  it("has no tags outside osu!", () => {
    expect(
      classifyMapStyle(mapOf(line(80, 75, 30)), "taiko", attributes).tags,
    ).toEqual([]);
  });
});
