export type HitCounts = {
  n300: number;
  n100: number;
  n50: number;
  misses: number;
  geki: number;
  katu: number;
};

/** One tosu message, reduced to the fields the app uses. */
export type GameFrame = {
  receivedAt: number;
  client: string;
  state: string;
  paused: boolean;
  profile: {
    id: number;
    name: string;
    pp: number;
    globalRank: number;
  };
  beatmap: {
    id: number;
    setId: number;
    checksum: string;
    artist: string;
    title: string;
    version: string;
    mapper: string;
    status: string;
    liveTime: number;
    lastObjectTime: number;
    stars: number;
    ar: number;
    cs: number;
    od: number;
    hp: number;
    bpm: number;
    maxCombo: number;
    /** pp of an SS with the current mods, null when tosu does not provide it. */
    maxPp: number | null;
    /** pp at common accuracies with the current mods, best first. Empty when unknown. */
    ppByAccuracy: { accuracy: number; pp: number }[];
  };
  play: {
    playerName: string;
    failed: boolean;
    mode: string;
    score: number;
    accuracy: number;
    health: number;
    hits: HitCounts;
    sliderBreaks: number;
    combo: number;
    maxCombo: number;
    mods: string;
    rate: number;
    rank: string;
    pp: number;
    ppFc: number;
    unstableRate: number;
    /** Mean hit error in ms, negative when early. Null before the first hit. */
    hitError: number | null;
  };
  results: {
    scoreId: number;
    score: number;
    accuracy: number;
    hits: HitCounts;
    maxCombo: number;
    mods: string;
    rate: number;
    rank: string;
    pp: number;
    ppFc: number;
  };
};
