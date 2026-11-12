import { describe, expect, it } from "vitest";
import { parseTosuMessage } from "./tosu";

const hits = { "0": 1, "50": 2, "100": 3, "300": 4, geki: 5, katu: 6 };
const mods = { name: "HDDT", rate: 1.5 };

const message = {
  client: "stable",
  state: { name: "play" },
  game: { paused: false },
  profile: { id: 1, name: "player", pp: 6184, globalRank: 60038 },
  performance: {
    accuracy: {
      "100": 293.05,
      "99": 267.53,
      "98": 248.54,
      "97": 232.48,
      "95": 211.93,
    },
  },
  beatmap: {
    id: 2,
    set: 3,
    checksum: "abc",
    artist: "artist",
    title: "title",
    version: "version",
    mapper: "mapper",
    status: { name: "ranked" },
    time: { live: 1000, lastObject: 90000 },
    stats: {
      stars: { total: 5.97 },
      ar: { converted: 10 },
      cs: { converted: 4 },
      od: { converted: 9.78 },
      hp: { converted: 6 },
      bpm: { common: 112.5 },
      maxCombo: 319,
    },
  },
  play: {
    playerName: "player",
    failed: false,
    mode: { name: "osu" },
    score: 100,
    accuracy: 98.5,
    healthBar: { normal: 90 },
    hits: { ...hits, sliderBreaks: 7 },
    combo: { current: 10, max: 20 },
    mods,
    rank: { current: "A" },
    pp: { current: 90, fc: 200 },
    unstableRate: 120,
    hitErrorArray: [-10, 2, 5],
  },
  resultsScreen: {
    scoreId: 0,
    score: 0,
    accuracy: 0,
    hits,
    mods,
    maxCombo: 0,
    rank: "",
    pp: { current: 0, fc: 0 },
  },
};

describe("parseTosuMessage", () => {
  it("flattens the fields the app uses", () => {
    const frame = parseTosuMessage(JSON.stringify(message), 42);

    expect(frame).toMatchObject({
      receivedAt: 42,
      state: "play",
      beatmap: { setId: 3, liveTime: 1000, stars: 5.97, ar: 10, maxPp: 293.05 },
      play: { mode: "osu", mods: "HDDT", rate: 1.5, sliderBreaks: 7 },
    });
    expect(frame?.play.hits).toEqual({
      n300: 4,
      n100: 3,
      n50: 2,
      misses: 1,
      geki: 5,
      katu: 6,
    });
  });

  it("removes the NUL characters tosu can return for map texts", () => {
    const beatmap = { ...message.beatmap, title: "\0", version: "" };
    const frame = parseTosuMessage(JSON.stringify({ ...message, beatmap }), 0);
    expect(frame?.beatmap.title).toBe("");
  });

  it("averages the hit errors, and has none before the first hit", () => {
    expect(parseTosuMessage(JSON.stringify(message), 0)?.play.hitError).toBe(
      -1,
    );

    const play = { ...message.play, hitErrorArray: [] };
    const frame = parseTosuMessage(JSON.stringify({ ...message, play }), 0);
    expect(frame?.play.hitError).toBeNull();
  });

  it("keeps the pp of the shown accuracies, best first", () => {
    expect(
      parseTosuMessage(JSON.stringify(message), 0)?.beatmap.ppByAccuracy,
    ).toEqual([
      { accuracy: 100, pp: 293.05 },
      { accuracy: 99, pp: 267.53 },
      { accuracy: 98, pp: 248.54 },
      { accuracy: 95, pp: 211.93 },
    ]);
  });

  it("has no accuracy values when tosu has not calculated them", () => {
    const performance = { accuracy: { "100": 0 } };
    const frame = parseTosuMessage(
      JSON.stringify({ ...message, performance }),
      0,
    );
    expect(frame?.beatmap.ppByAccuracy).toEqual([]);
  });

  it("treats a max pp of 0 as unknown", () => {
    const performance = { accuracy: { "100": 0 } };
    const frame = parseTosuMessage(
      JSON.stringify({ ...message, performance }),
      0,
    );
    expect(frame?.beatmap.maxPp).toBeNull();
  });

  it("accepts a message without max pp", () => {
    const { performance: _performance, ...rest } = message;
    expect(parseTosuMessage(JSON.stringify(rest), 0)?.beatmap.maxPp).toBeNull();
  });

  it("ignores fields it does not know", () => {
    const frame = parseTosuMessage(
      JSON.stringify({ ...message, leaderboard: [] }),
      0,
    );
    expect(frame).not.toBeNull();
    expect(frame).not.toHaveProperty("leaderboard");
  });

  it("rejects invalid JSON", () => {
    expect(parseTosuMessage("{", 0)).toBeNull();
  });

  it("rejects a message with a missing section", () => {
    const { play: _play, ...incomplete } = message;
    expect(parseTosuMessage(JSON.stringify(incomplete), 0)).toBeNull();
  });
});
