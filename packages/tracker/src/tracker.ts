import type {
  GameFrame,
  PlayResult,
  PlaySample,
  TrackedPlay,
  TrackerEvent,
} from "@osu-tracker/shared";

export const SESSION_TIMEOUT_MS = 25 * 60 * 1000;
// The score id arrives about a second after the results screen, and never on unranked maps.
const RESULTS_TIMEOUT_MS = 3000;
const RESTART_TIME_JUMP_MS = 3000;
const PARTIAL_START_MS = 5000;
const SAMPLE_INTERVAL_MS = 1000;

type ActivePlay = {
  id: string;
  sessionId: string;
  startFrame: GameFrame;
  lastFrame: GameFrame;
  mapTimeMs: number;
  partial: boolean;
  samples: PlaySample[];
  lastSampleAt: number;
  resultsSince: number | null;
  results: GameFrame["results"] | null;
};

type Session = { id: string; lastActivityAt: number };

export type TrackerOptions = {
  createId?: () => string;
  sessionTimeoutMs?: number;
  /** A session that was still going on when the app closed. */
  resumedSession?: { id: string; lastActivityAt: number };
};

/** Turns the stream of tosu frames into plays and sessions. Pure: no I/O and no clock. */
export class Tracker {
  private readonly createId: () => string;
  private readonly sessionTimeoutMs: number;
  private session: Session | null = null;
  private active: ActivePlay | null = null;
  private previous: GameFrame | null = null;
  private waitingForScoreReset = false;
  private lastProfilePp = 0;

  constructor(options: TrackerOptions = {}) {
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.sessionTimeoutMs = options.sessionTimeoutMs ?? SESSION_TIMEOUT_MS;
    this.session = options.resumedSession ?? null;
  }

  feed(frame: GameFrame): TrackerEvent[] {
    const events: TrackerEvent[] = [];

    this.expireSession(frame, events);
    if (this.active) this.updateActive(this.active, frame, events);
    if (!this.active && this.isNewPlay(frame)) this.startPlay(frame, events);

    this.previous = frame;
    this.lastProfilePp = frame.profile.pp;
    return events;
  }

  /** tosu went away: the current play can no longer be observed. */
  disconnect(now: number): TrackerEvent[] {
    const events: TrackerEvent[] = [];
    if (this.active) {
      this.active.partial = true;
      this.finishPlay(this.active, "quit", now, events);
    }
    this.previous = null;
    return events;
  }

  /** The app is closing. */
  stop(now: number): TrackerEvent[] {
    const events = this.disconnect(now);
    if (this.session) {
      events.push({
        type: "session-ended",
        sessionId: this.session.id,
        endedAt: this.session.lastActivityAt,
        endPp: this.lastProfilePp,
      });
      this.session = null;
    }
    return events;
  }

  /** A play starts with the score of the previous one for a moment: it must not be read as its own. */
  private isNewPlay(frame: GameFrame): boolean {
    if (!isOwnPlayFrame(frame)) {
      this.waitingForScoreReset = false;
      return false;
    }

    if (
      this.previous &&
      this.previous.state !== "play" &&
      frame.play.score > 0
    ) {
      this.waitingForScoreReset = true;
    }
    if (this.waitingForScoreReset && frame.play.score > 0) return false;

    this.waitingForScoreReset = false;
    return true;
  }

  private expireSession(frame: GameFrame, events: TrackerEvent[]): void {
    if (!this.session || this.active) return;
    if (frame.receivedAt - this.session.lastActivityAt < this.sessionTimeoutMs)
      return;

    events.push({
      type: "session-ended",
      sessionId: this.session.id,
      endedAt: this.session.lastActivityAt,
      endPp: frame.profile.pp,
    });
    this.session = null;
  }

  private startPlay(frame: GameFrame, events: TrackerEvent[]): void {
    if (!this.session) {
      this.session = { id: this.createId(), lastActivityAt: frame.receivedAt };
      events.push({
        type: "session-started",
        sessionId: this.session.id,
        startedAt: frame.receivedAt,
        startPp: frame.profile.pp,
      });
    }

    const active: ActivePlay = {
      id: this.createId(),
      sessionId: this.session.id,
      startFrame: frame,
      lastFrame: frame,
      mapTimeMs: frame.beatmap.liveTime,
      // Without a previous frame, the app was started or reconnected in the middle of a play.
      partial:
        this.previous === null && frame.beatmap.liveTime > PARTIAL_START_MS,
      samples: [],
      lastSampleAt: Number.NEGATIVE_INFINITY,
      resultsSince: null,
      results: null,
    };
    this.active = active;
    this.takeSample(active, frame);

    events.push({
      type: "play-started",
      sessionId: active.sessionId,
      playId: active.id,
      startedAt: frame.receivedAt,
      beatmapChecksum: frame.beatmap.checksum,
      mode: frame.play.mode,
      client: frame.client,
    });
  }

  private updateActive(
    active: ActivePlay,
    frame: GameFrame,
    events: TrackerEvent[],
  ): void {
    if (isResultsState(frame.state)) {
      active.resultsSince ??= frame.receivedAt;
      active.lastFrame = frame;

      // The results of the previous score stay there for a moment after replaying a map.
      const isCurrent = frame.results.score === frame.play.score;
      if (isCurrent && frame.results.score > 0) active.results = frame.results;

      const hasScoreId = isCurrent && frame.results.scoreId > 0;
      const timedOut =
        frame.receivedAt - active.resultsSince >= RESULTS_TIMEOUT_MS;
      if (hasScoreId || timedOut)
        this.finishPlay(active, "passed", frame.receivedAt, events);
      return;
    }

    if (active.resultsSince !== null) {
      this.finishPlay(active, "passed", frame.receivedAt, events);
      return;
    }

    if (frame.state !== "play") {
      const result = endedInFail(active)
        ? "failed"
        : reachedEnd(active)
          ? "passed"
          : "quit";
      this.finishPlay(active, result, frame.receivedAt, events);
      return;
    }

    // Transition frames: `play` is set before the player data is.
    if (!isOwnPlayFrame(frame)) return;

    if (isRestart(active.lastFrame, frame)) {
      const result = endedInFail(active) ? "failed" : "retried";
      this.finishPlay(active, result, frame.receivedAt, events);
      return;
    }

    // The first frames of a play can still hold the map time of the previous one.
    active.mapTimeMs = hasActivity(frame)
      ? Math.max(active.mapTimeMs, frame.beatmap.liveTime)
      : frame.beatmap.liveTime;
    active.lastFrame = frame;
    this.takeSample(active, frame);
  }

  private takeSample(active: ActivePlay, frame: GameFrame): void {
    if (frame.receivedAt - active.lastSampleAt < SAMPLE_INTERVAL_MS) return;

    active.lastSampleAt = frame.receivedAt;
    active.samples.push({
      mapTimeMs: frame.beatmap.liveTime,
      pp: frame.play.pp,
      accuracy: frame.play.accuracy,
      combo: frame.play.combo,
    });
  }

  private finishPlay(
    active: ActivePlay,
    result: PlayResult,
    endedAt: number,
    events: TrackerEvent[],
  ): void {
    const { play } = active.lastFrame;
    const results = active.results;

    if (!results && !hasActivity(active.lastFrame)) {
      events.push({
        type: "play-discarded",
        sessionId: active.sessionId,
        playId: active.id,
      });
      this.active = null;
      return;
    }

    const finished: TrackedPlay = {
      id: active.id,
      sessionId: active.sessionId,
      beatmap: active.lastFrame.beatmap,
      mode: play.mode,
      mods: results?.mods ?? play.mods,
      rate: results?.rate ?? play.rate,
      startedAt: active.startFrame.receivedAt,
      endedAt,
      mapTimeMs: active.mapTimeMs,
      result,
      partial: active.partial,
      score: results?.score ?? play.score,
      accuracy: results?.accuracy ?? play.accuracy,
      maxCombo: results?.maxCombo ?? play.maxCombo,
      hits: results?.hits ?? play.hits,
      sliderBreaks: play.sliderBreaks,
      unstableRate: play.unstableRate,
      hitError: play.hitError,
      rank: results?.rank ?? play.rank,
      // tosu does not recalculate the pp of the results when a map is played again.
      pp: play.pp,
      ppFc: play.ppFc,
      onlineScoreId: results && results.scoreId > 0 ? results.scoreId : null,
    };

    events.push({
      type: "play-finished",
      play: finished,
      samples: active.samples,
    });
    if (this.session) this.session.lastActivityAt = endedAt;
    this.active = null;
  }
}

function isOwnPlayFrame(frame: GameFrame): boolean {
  if (frame.state !== "play" || frame.play.playerName === "") return false;
  // Replays and autoplay are played under another name.
  return (
    frame.profile.name === "" || frame.play.playerName === frame.profile.name
  );
}

// The results of a multiplayer game have their own screen: any results screen counts.
function isResultsState(state: string): boolean {
  return /result/i.test(state);
}

const END_MARGIN_MS = 1000;

/**
 * The last note was reached without failing. Leaving the play there without a solo results
 * screen happens in multiplayer, where the game goes back to the lobby.
 */
function reachedEnd({ lastFrame, mapTimeMs }: ActivePlay): boolean {
  return (
    !isFailed(lastFrame) &&
    lastFrame.beatmap.lastObjectTime > 0 &&
    mapTimeMs >= lastFrame.beatmap.lastObjectTime - END_MARGIN_MS
  );
}

function hasActivity(frame: GameFrame): boolean {
  const { n300, n100, n50, misses } = frame.play.hits;
  return frame.play.score > 0 || n300 + n100 + n50 + misses > 0;
}

function hasNoFail(frame: GameFrame): boolean {
  return frame.play.mods.match(/.{2}/g)?.includes("NF") ?? false;
}

// tosu derives `failed` from the health bar being at 0, which is also the case when a map
// restarts, with No Fail, and in taiko where health starts at 0 and only matters at the end.
function isFailed(frame: GameFrame): boolean {
  if (frame.play.mode === "taiko" || hasNoFail(frame)) return false;
  return frame.play.failed && hasActivity(frame);
}

function endedInFail({ lastFrame, mapTimeMs }: ActivePlay): boolean {
  if (lastFrame.play.mode !== "taiko") return isFailed(lastFrame);

  // A taiko map cannot be failed before its end: reaching it without results is the fail.
  return !hasNoFail(lastFrame) && mapTimeMs >= lastFrame.beatmap.lastObjectTime;
}

function isRestart(previous: GameFrame, frame: GameFrame): boolean {
  if (previous.beatmap.checksum !== frame.beatmap.checksum) return true;
  if (isFailed(previous) && !isFailed(frame)) return true;
  if (previous.play.score > 0 && frame.play.score === 0) return true;

  // The map time rewinds slightly before the score resets, so a rewind alone only
  // counts when there was no score to reset.
  const rewound =
    previous.beatmap.liveTime - frame.beatmap.liveTime > RESTART_TIME_JUMP_MS;
  return rewound && previous.play.score === 0 && hasActivity(previous);
}
