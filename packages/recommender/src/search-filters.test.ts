import { describe, expect, it } from "vitest";
import {
  matchesSearchFilters,
  searchQuery,
  starsRangeWithFilters,
} from "./search-filters";

describe("searchQuery", () => {
  it("sends the filters without mods as they are", () => {
    const query = searchQuery(
      {
        bpm: { min: 170, max: 180 },
        ar: { min: 9, max: null },
        length: { min: 120, max: 180 },
      },
      [""],
    );
    expect(query).toBe("bpm>=170 bpm<=180 ar>=9 length>=120 length<=180");
  });

  it("takes the speed of DT out of the BPM and the length", () => {
    expect(
      searchQuery(
        { bpm: { min: 240, max: 270 }, length: { min: 60, max: null } },
        ["HDDT"],
      ),
    ).toBe("bpm>=160 bpm<=180 length>=90");
  });

  it("leaves out values changed in a way that cannot be undone", () => {
    expect(searchQuery({ ar: { min: 10, max: null } }, ["HR"])).toBe("");
    expect(searchQuery({ ar: { min: 10, max: null } }, ["HD"])).toBe("ar>=10");
  });

  it("leaves out the speed when the mods searched do not share it", () => {
    expect(searchQuery({ bpm: { min: 200, max: null } }, ["", "DT"])).toBe("");
  });

  it("leaves the stars to the range of the search", () => {
    expect(searchQuery({ stars: { min: 5, max: 6 } }, [""])).toBe("");
  });
});

describe("starsRangeWithFilters", () => {
  it("uses the stars asked for when they mean the same with the mods", () => {
    expect(
      starsRangeWithFilters({ stars: { min: 6, max: null } }, ["HD"], [4, 5.5]),
    ).toEqual([6, 7]);
    expect(
      starsRangeWithFilters({ stars: { min: 6, max: 7 } }, ["DT"], [4, 5.5]),
    ).toEqual([4, 5.5]);
    expect(starsRangeWithFilters({}, [""], [4, 5.5])).toEqual([4, 5.5]);
  });
});

describe("matchesSearchFilters", () => {
  const map = { ar: 9.3, bpm: 175, lengthSeconds: 165 };

  it("checks each difficulty of a map set", () => {
    expect(
      matchesSearchFilters(map, { bpm: { min: 170, max: 180 } }, [""]),
    ).toBe(true);
    expect(
      matchesSearchFilters(map, { ar: { min: 9.5, max: null } }, [""]),
    ).toBe(false);
    expect(
      matchesSearchFilters(map, { bpm: { min: 250, max: 270 } }, ["DT"]),
    ).toBe(true);
    expect(
      matchesSearchFilters(map, { length: { min: 120, max: 180 } }, ["DT"]),
    ).toBe(false);
  });
});
