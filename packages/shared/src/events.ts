import type { GameFrame, HitCounts } from "./frame";

export type PlayResult = "passed" | "failed" | "retried" | "quit";

export type PlaySample = {
  mapTimeMs: number;
  pp: number;
  accuracy: number;
  combo: number;
};

export type TrackedPlay = {
  id: string;
  sessionId: string;
  beatmap: GameFrame["beatmap"];
  mode: string;
  mods: string;
  rate: number;
  startedAt: number;
  endedAt: number;
  /** Furthest point reached in the map. */
  mapTimeMs: number;
  result: PlayResult;
  /** The start or the end of the play was not observed. */
  partial: boolean;
  score: number;
  accuracy: number;
  maxCombo: number;
  hits: HitCounts;
  sliderBreaks: number;
  unstableRate: number;
  hitError: number | null;
  rank: string;
  pp: number;
  ppFc: number;
  onlineScoreId: number | null;
};

export type TrackerEvent =
  | {
      type: "session-started";
      sessionId: string;
      startedAt: number;
      startPp: number;
    }
  | {
      type: "play-started";
      sessionId: string;
      playId: string;
      startedAt: number;
      beatmapChecksum: string;
      mode: string;
      client: string;
    }
  | { type: "play-finished"; play: TrackedPlay; samples: PlaySample[] }
  /** Left before any note: nothing to keep, such as leaving a map at its start. */
  | { type: "play-discarded"; sessionId: string; playId: string }
  | {
      type: "session-ended";
      sessionId: string;
      endedAt: number;
      endPp: number;
    };
