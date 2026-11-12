export type Range = { min: number | null; max: number | null };

export type SearchFilterKey =
  "stars" | "ar" | "od" | "cs" | "hp" | "bpm" | "length";

/** Values as shown with the mods applied: BPM and length in seconds include the speed. */
export type SearchFilters = Partial<Record<SearchFilterKey, Range>>;

// These mods leave the difficulty values of a map as they are.
const NEUTRAL_MODS = ["HD", "NF", "SD", "PF", "SO", "TD"];

export function clockRate(mods: string): number {
  const list: string[] = mods.match(/.{2}/g) ?? [];
  if (list.some((mod) => mod === "DT" || mod === "NC")) return 1.5;
  return list.includes("HT") ? 0.75 : 1;
}

function keepsSettings(mods: string): boolean {
  return (mods.match(/.{2}/g) ?? []).every((mod) => NEUTRAL_MODS.includes(mod));
}

/** The speed shared by all the mods searched, or null when they differ. */
function sharedRate(mods: string[]): number | null {
  const rates = new Set(mods.map(clockRate));
  return rates.size === 1 ? [...rates][0]! : null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Range of a filter on the map itself, without mods. Null when it cannot be known from the
 * filter: the change made by HR or DT to the AR, for example, is not a plain factor.
 */
function rangeWithoutMods(
  key: SearchFilterKey,
  range: Range,
  mods: string[],
): Range | null {
  const rate = sharedRate(mods);

  switch (key) {
    case "bpm":
      if (rate === null) return null;
      return {
        min: range.min === null ? null : round(range.min / rate),
        max: range.max === null ? null : round(range.max / rate),
      };
    case "length":
      if (rate === null) return null;
      return {
        min: range.min === null ? null : round(range.min * rate),
        max: range.max === null ? null : round(range.max * rate),
      };
    default:
      return mods.every(keepsSettings) ? range : null;
  }
}

/** osu! search keywords for the filters, stars apart since the search gives them their range. */
export function searchQuery(filters: SearchFilters, mods: string[]): string {
  return Object.entries(filters)
    .flatMap(([key, range]) => {
      if (key === "stars" || !range) return [];
      const values = rangeWithoutMods(key as SearchFilterKey, range, mods);
      if (!values) return [];
      return [
        values.min === null ? null : `${key}>=${values.min}`,
        values.max === null ? null : `${key}<=${values.max}`,
      ].filter((part) => part !== null);
    })
    .join(" ");
}

/** The stars asked for replace those of the level of the player, when they can be compared. */
export function starsRangeWithFilters(
  filters: SearchFilters,
  mods: string[],
  [levelMin, levelMax]: [number, number],
): [number, number] {
  const stars = filters.stars;
  if (!stars || !mods.every(keepsSettings)) return [levelMin, levelMax];
  // A single bound outside the level still leaves a star of maps to search.
  const min = stars.min ?? Math.min(levelMin, (stars.max ?? levelMin) - 1);
  const max = stars.max ?? Math.max(levelMax, min + 1);
  return [Math.max(0, min), max];
}

export type CatalogValues = { ar: number; bpm: number; lengthSeconds: number };

/** The search works on whole map sets: each difficulty is checked again. */
export function matchesSearchFilters(
  map: CatalogValues,
  filters: SearchFilters,
  mods: string[],
): boolean {
  const values: Partial<Record<SearchFilterKey, number>> = {
    ar: map.ar,
    bpm: map.bpm,
    length: map.lengthSeconds,
  };

  return Object.entries(filters).every(([key, range]) => {
    const value = values[key as SearchFilterKey];
    if (value === undefined || !range) return true;
    const bounds = rangeWithoutMods(key as SearchFilterKey, range, mods);
    if (!bounds) return true;
    // A little room for the rounding of the values given by the API.
    return (
      (bounds.min === null || value >= bounds.min - 0.01) &&
      (bounds.max === null || value <= bounds.max + 0.01)
    );
  });
}
