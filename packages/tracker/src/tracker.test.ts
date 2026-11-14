import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { GameFrame, TrackedPlay, TrackerEvent } from "@osu-tracker/shared";
import { Tracker } from "./tracker";

function loadFixture(name: string): GameFrame[] {
  const path = join(import.meta.dirname, "../../../fixtures", name);
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

function replay(frames: GameFrame[]): TrackerEvent[] {
  const tracker = new Tracker();
  return frames.flatMap((frame) => tracker.feed(frame));
}

function finishedPlays(events: TrackerEvent[]): TrackedPlay[] {
  return events.flatMap((event) =>
    event.type === "play-finished" ? [event.play] : [],
  );
}

function summary(events: TrackerEvent[]): string[] {
  return finishedPlays(events).map(
    (play) =>
      `${play.result}${play.partial ? " (partial)" : ""}: ${play.beatmap.title}`,
  );
}

function makeFrame(overrides: {
  at: number;
  state?: string;
  score?: number;
  liveTime?: number;
  playerName?: string;
  failed?: boolean;
  misses?: number;
  mode?: string;
  mods?: string;
  lastObjectTime?: number;
}): GameFrame {
  const [base] = loadFixture("session-basics.jsonl").filter(
    (frame) => frame.state === "play",
  );
  const frame = structuredClone(base!);
  frame.receivedAt = overrides.at;
  frame.state = overrides.state ?? "play";
  frame.play.score = overrides.score ?? 0;
  frame.play.failed = overrides.failed ?? false;
  frame.play.mode = overrides.mode ?? "osu";
  frame.play.mods = overrides.mods ?? "";
  frame.beatmap.lastObjectTime = overrides.lastObjectTime ?? 90000;
  frame.play.hits = {
    n300: 0,
    n100: 0,
    n50: 0,
    misses: overrides.misses ?? 0,
    geki: 0,
    katu: 0,
  };
  frame.beatmap.liveTime = overrides.liveTime ?? 0;
  frame.play.playerName = overrides.playerName ?? frame.profile.name;
  return frame;
}

describe("real sessions", () => {
  it("reads passes, fails, quits and a retry", () => {
    expect(summary(replay(loadFixture("session-basics.jsonl")))).toEqual([
      "retried: HOLLOW HUNGER (TV Size)",
      "passed: BLACK or WHITE?",
      "failed: My New World",
      "passed: My New World",
      "passed: SAD!",
    ]);
  });

  it("reads restarts, including a capture that starts during a play", () => {
    expect(summary(replay(loadFixture("session-restarts.jsonl")))).toEqual([
      "retried (partial): Neo Moon",
      "quit: Neo Moon",
      "retried: reunion (TV Size)",
      "passed: reunion (TV Size)",
      "failed: Bookmaker",
      "quit: Joker's Cranberrybox",
      "failed: Natsuzora Yell (TV Size)",
      "passed: Natsuzora Yell (TV Size)",
    ]);
  });

  it("takes the final values and the score id from the results screen", () => {
    const plays = finishedPlays(replay(loadFixture("session-restarts.jsonl")));
    const pass = plays.at(-1)!;

    expect(pass.onlineScoreId).toBe(5092721205);
    expect(pass.rank).toBe("B");
    expect(pass.score).toBe(152264);
    expect(pass.mods).toBe("HDDT");
  });

  it("keeps the pp reached when a play is retried or quit", () => {
    const plays = finishedPlays(replay(loadFixture("session-restarts.jsonl")));
    const pp = plays
      .filter((play) => play.beatmap.title.startsWith("reunion"))
      .map((play) => [play.result, play.pp]);

    expect(pp[0]).toEqual(["retried", 168.17]);
    expect(
      finishedPlays(replay(loadFixture("session-restarts.jsonl")))[1]?.pp,
    ).toBe(90.85);
  });

  it("keeps the mods of the play, not those of the song select", () => {
    const plays = finishedPlays(replay(loadFixture("session-basics.jsonl")));
    expect(plays.map((play) => play.mods)).toEqual([
      "",
      "HD",
      "HR",
      "",
      "HDDT",
    ]);
  });

  it("groups a whole capture into one session", () => {
    const events = replay(loadFixture("session-basics.jsonl"));
    expect(
      events.filter((event) => event.type === "session-started"),
    ).toHaveLength(1);
  });

  // Fixtures keep one frame out of five, so samples are further apart than in a live session.
  it("stores at most one sample per second", () => {
    const events = replay(loadFixture("session-basics.jsonl"));
    const pass = events.find(
      (event) =>
        event.type === "play-finished" && event.play.beatmap.title === "SAD!",
    );
    if (pass?.type !== "play-finished") throw new Error("play not found");

    const seconds = (pass.play.endedAt - pass.play.startedAt) / 1000;
    expect(pass.samples.length).toBeGreaterThan(seconds / 2);
    expect(pass.samples.length).toBeLessThanOrEqual(seconds + 1);
  });
});

describe("rules", () => {
  it("ignores plays made under another name", () => {
    const tracker = new Tracker();
    const events = tracker.feed(makeFrame({ at: 0, playerName: "osu!" }));
    expect(events).toEqual([]);
  });

  it("does not start a play until the player data is there", () => {
    const tracker = new Tracker();
    expect(tracker.feed(makeFrame({ at: 0, playerName: "" }))).toEqual([]);
  });

  it("finishes a pass without a score id once the wait is over", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, score: 100 }));

    const results = makeFrame({ at: 100, state: "resultScreen", score: 100 });
    results.results.score = 100;
    results.results.scoreId = 0;
    expect(tracker.feed(results)).toEqual([]);

    const events = tracker.feed({ ...results, receivedAt: 3200 });
    const [play] = finishedPlays(events);
    expect(play?.result).toBe("passed");
    expect(play?.onlineScoreId).toBeNull();
  });

  it("does not count the failed flag left by a retry as a fail", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, score: 1000, liveTime: 30000 }));

    const events = [
      makeFrame({ at: 100, liveTime: 0 }),
      makeFrame({ at: 200, liveTime: 0, failed: true }),
      makeFrame({ at: 2000, liveTime: 0, failed: true }),
      makeFrame({ at: 2100, liveTime: 500 }),
      makeFrame({ at: 3000, score: 300, liveTime: 1400 }),
    ].flatMap((frame) => tracker.feed(frame));

    expect(finishedPlays(events).map((play) => play.result)).toEqual([
      "retried",
    ]);
    const finished = finishedPlays(
      tracker.feed(makeFrame({ at: 4000, state: "selectPlay" })),
    );
    expect(finished.map((play) => play.result)).toEqual(["quit"]);
    expect(finished[0]?.score).toBe(300);
  });

  it("does not count a taiko play as failed while health is at 0", () => {
    const taiko = { mode: "taiko", failed: true };
    const tracker = new Tracker();
    tracker.feed(
      makeFrame({ ...taiko, at: 0, score: 900, liveTime: 3000, misses: 1 }),
    );

    const events = tracker.feed(makeFrame({ at: 100, state: "selectPlay" }));
    expect(finishedPlays(events)[0]?.result).toBe("quit");
  });

  it("keeps a retry in taiko as a retry", () => {
    const taiko = { mode: "taiko", failed: true };
    const tracker = new Tracker();
    tracker.feed(makeFrame({ ...taiko, at: 0, score: 900, liveTime: 3000 }));

    const events = tracker.feed(makeFrame({ ...taiko, at: 100, liveTime: 0 }));
    expect(finishedPlays(events)[0]?.result).toBe("retried");
  });

  it("counts a taiko map reaching its end without results as failed", () => {
    const tracker = new Tracker();
    tracker.feed(
      makeFrame({ mode: "taiko", at: 0, score: 900, liveTime: 91000 }),
    );

    const events = tracker.feed(makeFrame({ at: 100, state: "selectPlay" }));
    expect(finishedPlays(events)[0]?.result).toBe("failed");
  });

  it("does not count health at 0 as a fail with No Fail", () => {
    const tracker = new Tracker();
    tracker.feed(
      makeFrame({
        mods: "HDNF",
        failed: true,
        at: 0,
        score: 100,
        liveTime: 1000,
      }),
    );

    const events = tracker.feed(makeFrame({ at: 100, state: "selectPlay" }));
    expect(finishedPlays(events)[0]?.result).toBe("quit");
  });

  function resultFrame(
    at: number,
    score: number,
    scoreId: number,
    playScore = score,
  ): GameFrame {
    const frame = makeFrame({ at, state: "resultScreen", score: playScore });
    frame.results = {
      ...frame.results,
      score,
      scoreId,
      pp: 211,
      accuracy: 97.66,
    };
    frame.play.pp = 225;
    return frame;
  }

  it("ignores the results of the previous score after replaying a map", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, score: 3952500, liveTime: 1000 }));

    expect(tracker.feed(resultFrame(100, 3570540, 111, 3952500))).toEqual([]);

    const events = tracker.feed(resultFrame(300, 3952500, 222));
    const [play] = finishedPlays(events);
    expect(play).toMatchObject({
      result: "passed",
      score: 3952500,
      onlineScoreId: 222,
    });
  });

  it("keeps the pp of the play: the one of the results can be outdated", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, score: 100, liveTime: 1000 }));

    const [play] = finishedPlays(tracker.feed(resultFrame(100, 100, 222)));
    expect(play?.pp).toBe(225);
  });

  it("finishes with the values of the play if the results never update", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, score: 500, liveTime: 1000 }));
    tracker.feed(resultFrame(100, 100, 111, 500));

    const [play] = finishedPlays(
      tracker.feed(resultFrame(3200, 100, 111, 500)),
    );
    expect(play).toMatchObject({
      result: "passed",
      score: 500,
      onlineScoreId: null,
    });
  });

  it("does not count the score left by the previous play as a retry", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, state: "selectPlay" }));

    const stale = tracker.feed(
      makeFrame({ at: 100, score: 3570540, liveTime: -1000 }),
    );
    expect(stale).toEqual([]);

    const events = tracker.feed(makeFrame({ at: 200, liveTime: -900 }));
    expect(events.map((event) => event.type)).toContain("play-started");
    expect(finishedPlays(events)).toEqual([]);
  });

  it("counts a multiplayer game finished on its own results screen as passed", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, score: 100, liveTime: 1000 }));
    tracker.feed(makeFrame({ at: 100, score: 5000, liveTime: 89000 }));

    const events = [
      ...tracker.feed(
        makeFrame({ at: 200, score: 5000, state: "multiplayerResultsScreen" }),
      ),
      ...tracker.feed(
        makeFrame({ at: 4000, score: 5000, state: "multiplayerResultsScreen" }),
      ),
    ];
    expect(finishedPlays(events).map((play) => play.result)).toEqual([
      "passed",
    ]);
  });

  it("counts a game played to its end then left for the lobby as passed", () => {
    const tracker = new Tracker();
    tracker.feed(
      makeFrame({
        at: 0,
        score: 100,
        liveTime: 1000,
        mode: "taiko",
        mods: "NF",
      }),
    );
    tracker.feed(
      makeFrame({
        at: 100,
        score: 5000,
        liveTime: 89500,
        mode: "taiko",
        mods: "NF",
      }),
    );

    const events = tracker.feed(
      makeFrame({ at: 200, state: "multiplayerRoom" }),
    );
    expect(finishedPlays(events)[0]?.result).toBe("passed");
  });

  it("still counts a map left before its end as quit", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, score: 100, liveTime: 1000 }));
    tracker.feed(makeFrame({ at: 100, score: 5000, liveTime: 40000 }));

    const events = tracker.feed(makeFrame({ at: 200, state: "selectPlay" }));
    expect(finishedPlays(events)[0]?.result).toBe("quit");
  });

  it("counts a real fail, even without any score", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, liveTime: 1000, misses: 2 }));
    tracker.feed(
      makeFrame({ at: 100, liveTime: 1500, misses: 3, failed: true }),
    );

    const events = tracker.feed(makeFrame({ at: 200, state: "selectPlay" }));
    expect(finishedPlays(events)[0]?.result).toBe("failed");
  });

  it("counts a fail followed by a retry once", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, score: 100, liveTime: 9000 }));
    tracker.feed(
      makeFrame({ at: 100, score: 100, liveTime: 9100, failed: true }),
    );

    const events = tracker.feed(
      makeFrame({ at: 200, liveTime: 0, failed: true }),
    );
    const results = [
      ...events,
      ...tracker.feed(makeFrame({ at: 300, liveTime: 0 })),
    ];
    expect(finishedPlays(results).map((play) => play.result)).toEqual([
      "failed",
    ]);
  });

  it("counts a restart without score as a retry when notes were missed", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, liveTime: 8000, misses: 3 }));
    tracker.feed(makeFrame({ at: 1000, liveTime: 9000, misses: 3 }));

    const events = tracker.feed(makeFrame({ at: 1100, liveTime: 0 }));
    expect(finishedPlays(events)[0]?.result).toBe("retried");
    expect(events.at(-1)?.type).toBe("play-started");
  });

  it("does not create a play when the map rewinds before any note", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, liveTime: 88000 }));

    const events = tracker.feed(makeFrame({ at: 100, liveTime: 0 }));
    expect(events).toEqual([]);
    const left = tracker.feed(makeFrame({ at: 200, state: "selectPlay" }));
    expect(finishedPlays(left)).toEqual([]);
    expect(left.map((event) => event.type)).toEqual(["play-discarded"]);
  });

  it("keeps nothing of a map left before its first note", () => {
    const tracker = new Tracker();
    const started = tracker.feed(makeFrame({ at: 0, liveTime: -1500 }));
    expect(started.map((event) => event.type)).toContain("play-started");

    const left = tracker.feed(makeFrame({ at: 500, state: "selectPlay" }));
    expect(left.map((event) => event.type)).toEqual(["play-discarded"]);
  });

  it("marks the play as partial when tosu disconnects", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, score: 100 }));

    const [play] = finishedPlays(tracker.disconnect(500));
    expect(play?.partial).toBe(true);
    expect(play?.result).toBe("quit");
  });

  it("ends the session after the inactivity timeout, at the last activity", () => {
    const tracker = new Tracker({ sessionTimeoutMs: 1000 });
    tracker.feed(makeFrame({ at: 0, score: 100 }));
    tracker.feed(makeFrame({ at: 500, state: "selectPlay" }));

    const events = tracker.feed(makeFrame({ at: 1600, state: "selectPlay" }));
    expect(events).toMatchObject([{ type: "session-ended", endedAt: 500 }]);
  });

  it("keeps the session alive during a long play", () => {
    const tracker = new Tracker({ sessionTimeoutMs: 1000 });
    tracker.feed(makeFrame({ at: 0, score: 100, liveTime: 1 }));

    const events = tracker.feed(
      makeFrame({ at: 5000, score: 200, liveTime: 5000 }),
    );
    expect(events).toEqual([]);
  });

  it("continues a resumed session instead of starting a new one", () => {
    const tracker = new Tracker({
      resumedSession: { id: "resumed", lastActivityAt: 0 },
    });

    const events = tracker.feed(makeFrame({ at: 1000, score: 100 }));
    expect(events.map((event) => event.type)).toEqual(["play-started"]);
    expect(events[0]).toMatchObject({ sessionId: "resumed" });
  });

  it("ends a resumed session that stayed inactive for too long", () => {
    const tracker = new Tracker({
      sessionTimeoutMs: 1000,
      resumedSession: { id: "resumed", lastActivityAt: 0 },
    });

    const events = tracker.feed(makeFrame({ at: 5000, score: 100 }));
    expect(events.map((event) => event.type)).toEqual([
      "session-ended",
      "session-started",
      "play-started",
    ]);
  });

  it("ends a session at its last activity when the app stops", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, score: 100 }));
    tracker.feed(makeFrame({ at: 500, state: "selectPlay" }));

    expect(tracker.stop(9000)).toMatchObject([
      { type: "session-ended", endedAt: 500 },
    ]);
  });

  it("keeps the profile pp at the end of a session closed by the app", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, score: 100 }));

    const ended = tracker
      .stop(500)
      .find((event) => event.type === "session-ended");
    expect(ended).toMatchObject({ endPp: makeFrame({ at: 0 }).profile.pp });
  });

  it("closes the current play and the session when the app stops", () => {
    const tracker = new Tracker();
    tracker.feed(makeFrame({ at: 0, score: 100 }));

    const types = tracker.stop(500).map((event) => event.type);
    expect(types).toEqual(["play-finished", "session-ended"]);
  });
});
