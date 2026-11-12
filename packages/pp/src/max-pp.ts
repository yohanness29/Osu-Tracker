import {
  classifyMapStyle,
  type MapStyle,
  type StyleAttributes,
} from "./map-style";

// The calculator tosu uses for its pp counter: other pp libraries give different values.
type Attributes = {
  getData(): StyleAttributes & { maxCombo: number; stars: number };
};

type Beatmap = {
  mode: number;
  convert(mode: number): Beatmap | undefined;
  applyMods(mods: { acronym: string; settings: Map<string, object> }[]): void;
  getBeatmapDifficulty(): {
    approachRate: number;
    circleSize: number;
    overallDifficulty: number;
    drainRate: number;
  };
  createGradualDifficulty(): {
    skipToEnd(): void;
    createDifficultyAttrs(): Attributes;
  };
  createScore(accuracy: number): object;
  calculatePerformance(attributes: Attributes, score: object): { pp: number };
};

type Calculator = { PlayBeatmap: { parse(content: string): Beatmap } };

const GAME_MODES: Record<string, number> = {
  osu: 0,
  taiko: 1,
  fruits: 2,
  catch: 2,
  mania: 3,
};

export type MapAnalysisOptions = {
  content: string;
  mode: string;
  lazer: boolean;
};

export type MapAnalysis = MapStyle & { maxPp: number };

/** Works without mods. Loaded on demand: the binary must not be able to stop the tracking. */
export async function analyzeMap(
  options: MapAnalysisOptions,
): Promise<MapAnalysis> {
  const module = await import("@tosuapp/lazer-calculator-prebuilt");
  const { PlayBeatmap } = (module.default ?? module) as unknown as Calculator;

  let beatmap = PlayBeatmap.parse(options.content);
  const mode = GAME_MODES[options.mode] ?? beatmap.mode;
  if (beatmap.mode === 0 && mode !== 0) {
    beatmap = beatmap.convert(mode) ?? beatmap;
  }

  beatmap.applyMods(
    options.lazer ? [] : [{ acronym: "CL", settings: new Map() }],
  );

  const gradual = beatmap.createGradualDifficulty();
  gradual.skipToEnd();
  const attributes = gradual.createDifficultyAttrs();
  const data = attributes.getData();
  const score = { ...beatmap.createScore(1), maxCombo: data.maxCombo };

  return {
    maxPp: beatmap.calculatePerformance(attributes, score).pp,
    ...classifyMapStyle(options.content, options.mode, data),
  };
}

const ANALYZED_ACCURACIES = [93, 95, 96, 97, 98, 99, 100];

export type ModsAnalysis = {
  mods: string;
  stars: number;
  ar: number;
  od: number;
  cs: number;
  hp: number;
  ppByAccuracy: { accuracy: number; pp: number }[];
};

/** pp of a map for several combinations of mods, at the accuracies players usually reach. */
export async function analyzeMods(
  options: MapAnalysisOptions & { mods: string[] },
): Promise<ModsAnalysis[]> {
  const module = await import("@tosuapp/lazer-calculator-prebuilt");
  const { PlayBeatmap } = (module.default ?? module) as unknown as Calculator;
  const beatmap = PlayBeatmap.parse(options.content);

  return options.mods.map((mods) => {
    const acronyms = [
      ...(mods.match(/.{2}/g) ?? []),
      ...(options.lazer ? [] : ["CL"]),
    ];
    beatmap.applyMods(
      acronyms.map((acronym) => ({ acronym, settings: new Map() })),
    );

    const gradual = beatmap.createGradualDifficulty();
    gradual.skipToEnd();
    const attributes = gradual.createDifficultyAttrs();
    const { stars, maxCombo } = attributes.getData();
    // Already includes the speed of DT and HT.
    const difficulty = beatmap.getBeatmapDifficulty();

    return {
      mods,
      stars,
      ar: difficulty.approachRate,
      od: difficulty.overallDifficulty,
      cs: difficulty.circleSize,
      hp: difficulty.drainRate,
      ppByAccuracy: ANALYZED_ACCURACIES.map((accuracy) => ({
        accuracy,
        pp: beatmap.calculatePerformance(attributes, {
          ...beatmap.createScore(accuracy / 100),
          maxCombo,
        }).pp,
      })),
    };
  });
}
