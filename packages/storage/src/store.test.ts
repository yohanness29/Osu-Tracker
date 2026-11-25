import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameFrame, TrackerEvent } from "@osu-tracker/shared";
import { Tracker } from "@osu-tracker/tracker";
import { TrackerStore, type NewTopScore } from "./store";

let idCounter = 0;
const nextId = (): string => `id-${++idCounter}`;

const migrationsFolder = join(import.meta.dirname, "../drizzle");

function fixtureEvents(): TrackerEvent[] {
  const path = join(
    import.meta.dirname,
    "../../../fixtures/session-basics.jsonl",
  );
  const frames: GameFrame[] = readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const tracker = new Tracker({ createId: nextId });
  return frames.flatMap((frame) => tracker.feed(frame));
}

describe("TrackerStore", () => {
  let directory: string;
  let databasePath: string;
  let store: TrackerStore;

  beforeEach(() => {
    idCounter = 0;
    directory = mkdtempSync(join(tmpdir(), "osu-tracker-"));
    databasePath = join(directory, "test.sqlite");
    store = new TrackerStore({ databasePath, migrationsFolder });
  });

  afterEach(() => {
    store.close();
    rmSync(directory, { recursive: true });
  });

  function count(table: string): number {
    const sqlite = new Database(databasePath, { readonly: true });
    const row = sqlite
      .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
      .get() as { count: number };
    sqlite.close();
    return row.count;
  }

  it("stores every play of a real session", () => {
    fixtureEvents().forEach((event) => store.apply(event));

    expect(count("sessions")).toBe(1);
    expect(count("plays")).toBe(5);
    expect(count("beatmaps")).toBe(4);
    expect(count("play_samples")).toBeGreaterThan(0);
  });

  it("keeps a play seen again after a restart of the app only once", () => {
    const events = fixtureEvents();
    events.forEach((event) => store.apply(event));
    const finished = events.findLast((event) => event.type === "play-finished");
    if (finished?.type !== "play-finished") throw new Error("play not found");

    const again = { ...finished.play, id: "again", partial: true };
    store.apply({ ...finished, play: again });
    expect(count("plays")).toBe(5);

    // Even when the copy is not partial, such as a replay of the score.
    store.apply({
      ...finished,
      play: { ...again, id: "replay", partial: false },
    });
    expect(count("plays")).toBe(5);

    // A real new try that reaches another score is kept.
    store.apply({
      ...finished,
      play: { ...again, id: "new", score: again.score + 1 },
    });
    expect(count("plays")).toBe(6);
  });

  it("returns the most recent plays first, with their map", () => {
    fixtureEvents().forEach((event) => store.apply(event));

    const [latest] = store.recentPlays(1);
    expect(latest).toMatchObject({
      title: "SAD!",
      result: "passed",
      mods: "HDDT",
    });
    expect(latest?.partial).toBe(false);
  });

  it("counts the results of a session and of all sessions", () => {
    fixtureEvents().forEach((event) => store.apply(event));
    const expected = { passed: 3, failed: 1, retried: 1, quit: 0 };

    expect(store.resultCounts()).toEqual(expected);
    expect(store.resultCounts("id-1")).toEqual(expected);
    expect(store.resultCounts("unknown")).toEqual({
      passed: 0,
      failed: 0,
      retried: 0,
      quit: 0,
    });
  });

  it("counts the results per map, latest map first", () => {
    fixtureEvents().forEach((event) => store.apply(event));

    const results = store.mapResults(10);
    expect(results.map((map) => map.title)).toEqual([
      "SAD!",
      "My New World",
      "BLACK or WHITE?",
      "HOLLOW HUNGER (TV Size)",
    ]);
    expect(results[1]).toMatchObject({
      tags: [],
      mods: expect.any(Array),
      lastPlayedAt: expect.any(Number),
      stars: expect.any(Number),
      passed: 1,
      failed: 1,
      retried: 0,
      quit: 0,
    });
    expect(results[3]).toMatchObject({
      passed: 0,
      failed: 0,
      retried: 1,
      quit: 0,
    });
  });

  it("stores the pp reached and the max pp of the map", () => {
    const events = fixtureEvents();
    const finished = events.findLast((event) => event.type === "play-finished");
    if (finished?.type !== "play-finished") throw new Error("play not found");
    events
      .filter((event) => event !== finished)
      .forEach((event) => store.apply(event));
    const beatmap = { ...finished.play.beatmap, maxPp: 210.5 };
    store.apply({ ...finished, play: { ...finished.play, beatmap, pp: 90.5 } });

    expect(store.recentPlays(1)[0]).toMatchObject({ pp: 90.5, maxPp: 210.5 });
  });

  it("adds the no-mod max pp to the plays of the same map and mode", () => {
    const events = fixtureEvents();
    events.forEach((event) => store.apply(event));
    const finished = events.findLast((event) => event.type === "play-finished");
    if (finished?.type !== "play-finished") throw new Error("play not found");
    const { beatmap, mode } = finished.play;

    expect(store.hasMapAnalysis(beatmap.checksum, mode)).toBe(false);
    expect(store.recentPlays(1)[0]?.noModMaxPp).toBeNull();

    store.saveMapAnalysis(beatmap.checksum, "taiko", 100, {
      style: "Stamina",
      tags: [],
    });
    store.saveMapAnalysis(beatmap.checksum, mode, 196.37, {
      style: "Stream",
      tags: ["Deathstream"],
    });

    expect(store.hasMapAnalysis(beatmap.checksum, mode)).toBe(true);
    expect(store.recentPlays(1)[0]?.style).toBe("Stream");
    expect(store.recentPlays(1)[0]?.tags).toEqual(["Deathstream"]);
    expect(store.mapDetail(beatmap.checksum)?.styles).toEqual(
      expect.arrayContaining([
        { mode: "taiko", style: "Stamina", tags: [] },
        { mode, style: "Stream", tags: ["Deathstream"] },
      ]),
    );
    expect(
      store.recentPlays(20).filter((play) => play.noModMaxPp !== null),
    ).toHaveLength(1);
    expect(store.recentPlays(1)[0]?.noModMaxPp).toBe(196.37);
  });

  it("exports a whole session, oldest play first, with its samples", () => {
    fixtureEvents().forEach((event) => store.apply(event));

    const exported = store.sessionExport("id-1", 123);
    expect(exported).toMatchObject({
      format: "osu-tracker-session",
      version: 1,
      exportedAt: 123,
      session: { id: "id-1", plays: 5 },
      goals: [],
    });
    const plays = exported!.plays;
    expect(plays).toHaveLength(5);
    expect(plays[0]!.startedAt).toBeLessThan(plays.at(-1)!.startedAt);
    expect(plays.some((play) => play.samples.length > 0)).toBe(true);
    expect(Object.keys(plays[0]!.samples[0] ?? {})).toEqual(
      plays[0]!.samples.length > 0
        ? ["mapTimeMs", "pp", "accuracy", "combo"]
        : [],
    );
    expect(store.sessionExport("unknown", 123)).toBeNull();
  });

  it("summarizes the sessions and returns their plays", () => {
    const events = fixtureEvents();
    events.forEach((event) => store.apply(event));

    const [session] = store.sessionSummaries();
    expect(session).toMatchObject({
      id: "id-1",
      plays: 5,
      passed: 3,
      failed: 1,
      retried: 1,
      quit: 0,
    });
    expect(session?.playTimeMs).toBeGreaterThan(0);

    const plays = store.sessionPlays("id-1");
    expect(plays).toHaveLength(5);
    expect(plays[0]).toMatchObject({ title: "SAD!", mode: "osu" });
    expect(plays[0]?.beatmapsetId).toBeGreaterThan(0);
    expect(store.sessionPlays("unknown")).toEqual([]);
  });

  it("returns a map with all its plays", () => {
    fixtureEvents().forEach((event) => store.apply(event));
    const [map] = store
      .mapResults(10)
      .filter(({ title }) => title === "My New World");

    const detail = store.mapDetail(map!.checksum);
    expect(detail).toMatchObject({ title: "My New World", version: "Rebirth" });
    expect(detail?.plays.map((play) => play.result)).toEqual([
      "passed",
      "failed",
    ]);
    expect(store.mapDetail("unknown")).toBeNull();
  });

  function saveSession(
    id: string,
    start: number,
    end: number,
    endPp = 6000,
    mode = "osu",
  ): void {
    const [finished] = fixtureEvents().filter(
      (event) => event.type === "play-finished",
    );
    if (finished?.type !== "play-finished") throw new Error("play not found");

    store.apply({
      type: "session-started",
      sessionId: id,
      startedAt: start,
      startPp: 5000,
    });
    store.apply({
      ...finished,
      samples: [],
      play: {
        ...finished.play,
        id: `play-${id}`,
        sessionId: id,
        mode,
        startedAt: start,
        endedAt: end,
      },
    });
    store.apply({ type: "session-ended", sessionId: id, endedAt: end, endPp });
  }

  it("merges sessions separated by a short gap, keeping every play", () => {
    saveSession("a", 0, 100, 6001);
    saveSession("b", 150, 200, 6002);
    saveSession("c", 1000, 1100, 6003);
    store.apply({
      type: "session-started",
      sessionId: "empty",
      startedAt: 500,
      startPp: 0,
    });

    store.mergeContiguousSessions(100);

    const summaries = store.sessionSummaries();
    expect(summaries.map(({ id, plays }) => [id, plays])).toEqual([
      ["c", 1],
      ["a", 2],
    ]);
    expect(summaries[1]).toMatchObject({
      endedAt: 200,
      startPp: 5000,
      endPp: 6002,
    });
    expect(count("sessions")).toBe(2);
    expect(count("plays")).toBe(3);
  });

  it("keeps the last known pp when merging a session without an end value", () => {
    saveSession("a", 0, 100, 6001);
    saveSession("b", 150, 200, 0);

    store.mergeContiguousSessions(100);
    expect(store.sessionSummaries()[0]?.endPp).toBe(6001);
  });

  it("does not change anything when merged twice", () => {
    saveSession("a", 0, 100);
    saveSession("b", 150, 200);

    store.mergeContiguousSessions(100);
    const merged = store.sessionSummaries();
    store.mergeContiguousSessions(100);
    expect(store.sessionSummaries()).toEqual(merged);
  });

  it("separates the results of a map per mode", () => {
    saveSession("a", 0, 100, 6000, "osu");
    saveSession("b", 1000, 1100, 6000, "taiko");

    expect(store.mapResults(10).map(({ mode }) => mode)).toEqual([
      "taiko",
      "osu",
    ]);
    expect(store.mapResults(10, "taiko")).toHaveLength(1);
    expect(store.mapResults(10, "mania")).toEqual([]);
  });

  it("renames a session and restores its default name when empty", () => {
    saveSession("a", 0, 100);

    store.renameSession("a", "  Farm HDDT  ");
    expect(store.sessionSummaries()[0]?.name).toBe("Farm HDDT");

    store.renameSession("a", "   ");
    expect(store.sessionSummaries()[0]?.name).toBeNull();
  });

  it("keeps the name of a renamed session when merging", () => {
    saveSession("a", 0, 100);
    saveSession("b", 150, 200);
    store.renameSession("b", "Grind");

    store.mergeContiguousSessions(100);
    expect(store.sessionSummaries()[0]).toMatchObject({
      id: "a",
      name: "Grind",
    });
  });

  it("attaches waiting goals to the next session", () => {
    store.addGoal({
      sessionId: null,
      type: "passes",
      target: 5,
      minStars: null,
    });
    expect(store.goals(null)).toHaveLength(1);

    saveSession("a", 0, 100);

    expect(store.goals(null)).toEqual([]);
    expect(store.goals("a")).toMatchObject([{ type: "passes", target: 5 }]);
  });

  it("removes a goal", () => {
    store.addGoal({
      sessionId: null,
      type: "full_combos",
      target: 3,
      minStars: 6,
    });
    const [goal] = store.goals(null);

    store.removeGoal(goal!.id);
    expect(store.goals(null)).toEqual([]);
  });

  it("keeps goals when sessions are merged or removed", () => {
    saveSession("a", 0, 100);
    saveSession("b", 150, 200);
    store.addGoal({
      sessionId: "b",
      type: "passes",
      target: 2,
      minStars: null,
    });
    store.apply({
      type: "session-started",
      sessionId: "empty",
      startedAt: 500,
      startPp: 0,
    });
    store.addGoal({
      sessionId: "empty",
      type: "accuracy",
      target: 98,
      minStars: null,
    });

    store.mergeContiguousSessions(100);

    expect(store.goals("a")).toMatchObject([{ type: "passes" }]);
    expect(store.goals(null)).toMatchObject([{ type: "accuracy" }]);
  });

  function catalogMap(beatmapId: number, playCount: number) {
    return {
      beatmapId,
      beatmapsetId: 1,
      checksum: `c${beatmapId}`,
      mode: "osu",
      title: "Map",
      artist: "Artist",
      mapper: "Mapper",
      version: "Hard",
      stars: 5,
      ar: 9,
      bpm: 180,
      lengthSeconds: 90,
      playCount,
    };
  }

  it("lists maps to analyze, most played first, until each mod is done", () => {
    store.saveCatalogMaps([
      catalogMap(1, 10),
      catalogMap(2, 50),
      catalogMap(3, 30),
    ]);
    const analysis = (mods: string) => ({
      mods,
      stars: 6,
      ar: 9,
      ppByAccuracy: [],
    });

    store.saveMapAnalyses(3, { style: "Aim", tags: [] }, [
      analysis(""),
      analysis("HD"),
    ]);
    store.saveMapAnalyses(2, { style: "Aim", tags: [] }, [analysis("")]);

    expect(
      store.mapsToAnalyze("osu", ["", "HD"], 10).map((map) => map.beatmapId),
    ).toEqual([2, 1]);
    expect(
      store.mapsToAnalyze("osu", [""], 10).map((map) => map.beatmapId),
    ).toEqual([1]);
    expect(store.mapsToAnalyze("taiko", [""], 10)).toEqual([]);
  });

  it("describes a suggested map that was never played", () => {
    store.saveCatalogMaps([catalogMap(1, 10)]);
    const ppByAccuracy = [
      { accuracy: 98, pp: 200 },
      { accuracy: 100, pp: 260 },
    ];
    store.saveMapAnalyses(1, { style: "Aim", tags: [] }, [
      { mods: "HR", stars: 6, ppByAccuracy },
    ]);

    expect(store.mapDetail("c1")).toMatchObject({
      title: "Map",
      beatmapId: 1,
      lengthMs: 90000,
      maxCombo: 0,
      plays: [],
      analyses: [{ mods: "HR", stars: 6, ssPp: 260 }],
    });
  });

  it("only analyzes the maps of a difficulty range", () => {
    store.saveCatalogMaps([
      { ...catalogMap(1, 10), stars: 4 },
      { ...catalogMap(2, 20), stars: 6 },
    ]);

    expect(
      store.mapsToAnalyze("osu", [""], 10, [5, 7]).map((map) => map.beatmapId),
    ).toEqual([2]);
    expect(store.mapsToAnalyze("osu", [""], 10, [0, 10], [1])).toHaveLength(1);
    expect(store.mapsToAnalyze("osu", [""], 10, [0, 10], [])).toEqual([]);
  });

  it("analyzes again the maps saved before difficulty values existed", () => {
    store.saveCatalogMaps([catalogMap(1, 10)]);
    store.saveMapAnalyses(1, { style: "Aim", tags: [] }, [
      { mods: "", stars: 6, ppByAccuracy: [] },
    ]);

    expect(store.mapsToAnalyze("osu", [""], 10)).toHaveLength(1);
  });

  it("returns the difficulty with mods, and the map value as a fallback for AR", () => {
    store.saveCatalogMaps([catalogMap(1, 10)]);
    const difficulty = { ar: 10.3, od: 9.8, cs: 4, hp: 5 };
    store.saveMapAnalyses(1, { style: "Aim", tags: [] }, [
      { mods: "DT", stars: 7, ppByAccuracy: [], ...difficulty },
      { mods: "", stars: 5, ppByAccuracy: [] },
    ]);

    const rows = store.catalogSuggestions("osu");
    expect(rows.find(({ mods }) => mods === "DT")).toMatchObject(difficulty);
    expect(rows.find(({ mods }) => mods === "")).toMatchObject({
      ar: 9,
      od: null,
    });
  });

  it("returns a row per analyzed mod, and keeps it when a map is updated", () => {
    store.saveCatalogMaps([catalogMap(1, 10)]);
    const ppByAccuracy = [{ accuracy: 98, pp: 200 }];
    store.saveMapAnalyses(1, { style: "Stream", tags: [] }, [
      { mods: "HDDT", stars: 6.5, ppByAccuracy },
    ]);
    store.saveCatalogMaps([catalogMap(1, 20)]);

    expect(store.catalogSuggestions("osu")).toMatchObject([
      {
        beatmapId: 1,
        mods: "HDDT",
        stars: 6.5,
        mapStars: 5,
        style: "Stream",
        tags: [],
        ppByAccuracy,
        playCount: 20,
      },
    ]);
  });

  describe("tournaments", () => {
    const poolMap = (slot: string, beatmapId: number) => ({
      slot,
      mods: slot.startsWith("HD") ? "HD" : "",
      freeMod: slot.startsWith("TB"),
      beatmapId,
      beatmapsetId: 1,
      checksum: `c${beatmapId}`,
      title: `Map ${beatmapId}`,
      artist: "A",
      version: "Futsuu",
      mapper: "M",
      stars: 2.4,
      ar: 0,
      od: 4,
      cs: 0,
      hp: 7,
      bpm: 195,
      lengthSeconds: 210,
      style: "Stamina",
      tags: ["Marathon"],
    });
    const score = (gameId: number, userId: number, accuracy: number) => ({
      gameId,
      beatmapId: 100 + gameId,
      title: "Map",
      version: "Futsuu",
      playedAt: gameId,
      userId,
      username: `player ${userId}`,
      mods: "NF",
      score: 900000,
      accuracy,
      maxCombo: 400,
      n300: 390,
      n100: 10,
      misses: 0,
      passed: true,
    });

    it("keeps pools in order, with their maps in the order given", () => {
      const id = store.createTournament("BTT10", "taiko", 1);
      store.createPool(
        id,
        "Qualifiers",
        [poolMap("NM1", 1), poolMap("HD1", 2)],
        10,
      );
      store.createPool(id, "RO32", [poolMap("TB", 3)], 20);
      store.updateTournament(id, { bans: 1, bestOf: 9, name: "  " });

      expect(store.tournaments()[0]).toMatchObject({
        name: "BTT10",
        bans: 1,
        bestOf: 9,
      });
      const pools = store.tournamentPools(id);
      expect(pools.map(({ name }) => name)).toEqual(["Qualifiers", "RO32"]);
      expect(pools[0]!.maps.map(({ slot, tags }) => [slot, tags])).toEqual([
        ["NM1", ["Marathon"]],
        ["HD1", ["Marathon"]],
      ]);
      expect(pools[1]!.maps[0]!.freeMod).toBe(true);
    });

    it("gives each round its format and bans, a new one taking the previous", () => {
      const id = store.createTournament("BTT10", "taiko", 1);
      const quals = store.createPool(id, "Quals", [poolMap("NM1", 1)], 10);
      const ro16 = store.createPool(id, "RO16", [poolMap("NM1", 2)], 20);
      store.updatePool(ro16, { bestOf: 9, bans: 2 });
      store.createPool(id, "QF", [poolMap("NM1", 3)], 30);

      const formats = store
        .tournamentPools(id)
        .map(({ id, bestOf, bans }) => [id, bestOf, bans]);
      expect(formats[0]).toEqual([quals, null, null]);
      expect(formats[1]).toEqual([ro16, 9, 2]);
      expect(formats[2]!.slice(1)).toEqual([9, 2]);
    });

    it("replaces the scores of a match imported again", () => {
      const id = store.createTournament("BTT10", "taiko", 1);
      const match = {
        osuMatchId: 7,
        name: "BTT10: (A) vs. (B)",
        startedAt: 5,
        scores: [score(2, 10, 99), score(2, 11, 98), score(1, 10, 97)],
      };
      store.saveMatch(id, match, 100);
      store.saveMatch(id, { ...match, scores: [score(1, 10, 96)] }, 200);

      const [saved] = store.tournamentMatches(id);
      expect(store.tournamentMatches(id)).toHaveLength(1);
      expect(saved).toMatchObject({ osuMatchId: 7, importedAt: 200 });
      expect(saved!.scores.map(({ accuracy }) => accuracy)).toEqual([96]);
    });

    it("keeps the players said in or out by hand, and forgets them on demand", () => {
      const id = store.createTournament("BTT10", "taiko", 1);
      store.setPlayerStatus(id, 7, true);
      store.setPlayerStatus(id, 8, false);
      store.setPlayerStatus(id, 7, false);
      store.setPlayerStatus(id, 8, null);
      expect(store.playerStatuses(id)).toEqual([{ userId: 7, eliminated: false }]);
      store.deleteTournament(id);
      expect(store.playerStatuses(id)).toEqual([]);
    });

    it("removes the pools and matches with the tournament", () => {
      const id = store.createTournament("BTT10", "taiko", 1);
      const poolId = store.createPool(id, "RO32", [poolMap("NM1", 1)], 10);
      store.saveMatch(
        id,
        { osuMatchId: 7, name: "x", startedAt: 5, scores: [score(1, 10, 99)] },
        1,
      );

      store.deletePool(poolId);
      expect(store.tournamentPools(id)).toEqual([]);
      store.deleteTournament(id);
      expect(store.tournaments()).toEqual([]);
      expect(store.tournamentMatches(id)).toEqual([]);
    });

    it("finds the plays made on the maps of a pool", () => {
      fixtureEvents().forEach((event) => store.apply(event));
      const [play] = store.recentPlays(1);
      expect(
        store.playsOnMaps([play!.beatmapId], play!.mode).length,
      ).toBeGreaterThan(0);
      expect(store.playsOnMaps([play!.beatmapId], "mania")).toEqual([]);
      expect(store.playsOnMaps([], "osu")).toEqual([]);
    });
  });

  describe("playlists", () => {
    const map = {
      beatmapChecksum: "abc",
      mode: "osu",
      beatmapId: 1860169,
      beatmapsetId: 886499,
      title: "RAISE MY SWORD",
      artist: "GALNERYUS",
      version: "A THOUSAND FLAMES",
      mapper: "Sotarks",
    };

    it("groups maps, last added first, each map once", () => {
      const id = store.createPlaylist("  Streams  ", 1);
      store.createPlaylist("", 2);
      store.addToPlaylist(id, map, 10);
      store.addToPlaylist(
        id,
        { ...map, beatmapChecksum: "def", title: "Other" },
        20,
      );
      store.addToPlaylist(id, map, 30);

      expect(store.playlists().map(({ name, maps }) => [name, maps])).toEqual([
        ["Nouvelle playlist", 0],
        ["Streams", 2],
      ]);
      expect(
        store.playlistMaps(id).map(({ title, addedAt }) => [title, addedAt]),
      ).toEqual([
        ["Other", 20],
        ["RAISE MY SWORD", 10],
      ]);
      expect(store.playlistsOfMap("abc")).toEqual([id]);
    });

    it("shows the style found for the suggestions of a map never played", () => {
      const id = store.createPlaylist("Streams", 1);
      store.saveCatalogMaps([{ ...catalogMap(7, 10), checksum: "abc" }]);
      store.saveMapAnalyses(7, { style: "Stream", tags: ["Deathstream"] }, []);
      store.addToPlaylist(id, map, 10);

      expect(store.playlistMaps(id)[0]).toMatchObject({
        style: "Stream",
        tags: ["Deathstream"],
        plays: 0,
        passed: 0,
      });
    });

    it("removes a map, or the playlist with its maps", () => {
      const id = store.createPlaylist("Streams", 1);
      store.addToPlaylist(id, map, 10);
      store.renamePlaylist(id, "Deathstreams");
      store.renamePlaylist(id, "   ");
      expect(store.playlists()[0]?.name).toBe("Deathstreams");

      store.removeFromPlaylist(id, "abc");
      expect(store.playlistMaps(id)).toEqual([]);

      store.addToPlaylist(id, map, 10);
      store.deletePlaylist(id);
      expect(store.playlists()).toEqual([]);
      expect(store.playlistsOfMap("abc")).toEqual([]);
    });
  });

  it("knows when a map is analyzed with every mod asked", () => {
    expect(store.isCatalogAnalyzed(1, [""])).toBe(false);
    store.saveCatalogMaps([catalogMap(1, 10)]);
    expect(store.isCatalogAnalyzed(1, [""])).toBe(false);

    const analysis = { stars: 5, ar: 9, ppByAccuracy: [] };
    store.saveMapAnalyses(1, { style: "Aim", tags: [] }, [
      { mods: "", ...analysis },
    ]);
    expect(store.isCatalogAnalyzed(1, [""])).toBe(true);
    expect(store.isCatalogAnalyzed(1, ["", "HDDT"])).toBe(false);
  });

  it("finds the maps analyzed before tags existed", () => {
    store.saveCatalogMaps([
      catalogMap(1, 10),
      catalogMap(2, 20),
      catalogMap(3, 30),
    ]);
    store.saveMapAnalyses(1, { style: "Aim", tags: [] }, []);
    // Written by an older version: a style without tags.
    store.saveMapAnalyses(2, { style: "Aim", tags: [] }, []);
    const sqlite = new Database(databasePath);
    sqlite
      .prepare("UPDATE catalog_maps SET tags = NULL WHERE beatmap_id = 2")
      .run();
    sqlite.close();

    expect(
      store.catalogMapsWithoutTags(10).map(({ beatmapId }) => beatmapId),
    ).toEqual([2]);

    store.saveCatalogStyle(2, { style: "Stream", tags: ["Bursts"] });
    expect(store.catalogMapsWithoutTags(10)).toEqual([]);
    expect(store.catalogSuggestions("osu")).toEqual([]);
  });

  function topScore(scoreId: number): NewTopScore {
    return {
      scoreId,
      beatmapId: scoreId,
      beatmapsetId: 1,
      title: "Map",
      artist: "Artist",
      version: "Hard",
      checksum: `checksum-${scoreId}`,
      mapper: "Mapper",
      stars: 5,
      mods: "HD",
      accuracy: 98,
      pp: 300 - scoreId,
      weightPercent: 100,
      rank: "S",
      playedAt: 1,
    };
  }

  it("replaces the top scores of a mode without touching the others", () => {
    store.replaceTopScores("osu", [topScore(1), topScore(2)], 10);
    store.replaceTopScores("taiko", [topScore(3)], 10);
    store.replaceTopScores("osu", [topScore(4)], 20);

    expect(store.topScores("osu")).toMatchObject([
      { scoreId: 4, position: 0, fetchedAt: 20 },
    ]);
    expect(store.topScores("taiko")).toMatchObject([{ scoreId: 3 }]);
  });

  it("keeps the known difficulty with mods when the top is replaced", () => {
    store.replaceTopScores("osu", [topScore(1), topScore(2)], 10);
    expect(store.scoresMissingModdedStars("osu")).toHaveLength(2);

    store.setModdedStars("osu", 1, 6.5);
    store.replaceTopScores("osu", [topScore(2), topScore(1), topScore(3)], 20);

    expect(
      store.scoresMissingModdedStars("osu").map(({ scoreId }) => scoreId),
    ).toEqual([2, 3]);
    expect(store.topScores("osu")[1]?.moddedStars).toBe(6.5);
  });

  it("finds analyses to redo, grouped by map", () => {
    store.saveCatalogMaps([catalogMap(1, 10), catalogMap(2, 50)]);
    const old = (mods: string) => ({ mods, stars: 6, ppByAccuracy: [] });
    store.saveMapAnalyses(1, { style: "Aim", tags: [] }, [old(""), old("HR")]);
    store.saveMapAnalyses(2, { style: "Aim", tags: [] }, [
      { ...old(""), ar: 9 },
    ]);

    expect(store.outdatedAnalyses(10)).toMatchObject([
      { map: { beatmapId: 1 }, mods: ["", "HR"] },
    ]);
  });

  it("stores the net gain of a play", () => {
    fixtureEvents().forEach((event) => store.apply(event));
    const [latest] = store.recentPlays(1);
    expect(latest?.netGain).toBeNull();

    store.setNetGain(latest!.id, 4.2);
    expect(store.recentPlays(1)[0]?.netGain).toBe(4.2);
  });

  it("finds maps without title and fills them", () => {
    fixtureEvents().forEach((event) => store.apply(event));
    const [map] = store.mapResults(1);
    const sqlite = new Database(databasePath);
    sqlite
      .prepare("UPDATE beatmaps SET title = '' WHERE checksum = ?")
      .run(map!.checksum);
    sqlite.close();

    expect(store.beatmapsWithoutTitle(10)).toEqual([map!.beatmapId]);

    const texts = {
      title: "Fixed",
      artist: "Someone",
      version: "Hard",
      mapper: "Mapper",
    };
    store.updateMapTexts({ beatmapId: map!.beatmapId, ...texts });
    expect(store.beatmapsWithoutTitle(10)).toEqual([]);
    expect(store.mapDetail(map!.checksum)).toMatchObject(texts);
  });

  it("resumes the latest session while it is recent", () => {
    saveSession("a", 0, 100);

    expect(store.resumeSession(150, 100)).toEqual({
      id: "a",
      lastActivityAt: 100,
    });
    expect(store.sessionSummaries()[0]?.endedAt).toBeNull();
  });

  it("does not resume an old session", () => {
    saveSession("a", 0, 100);

    expect(store.resumeSession(200, 100)).toBeNull();
    expect(store.sessionSummaries()[0]?.endedAt).toBe(100);
  });

  it("leaves out sessions without plays", () => {
    store.apply({
      type: "session-started",
      sessionId: "empty",
      startedAt: 1,
      startPp: 0,
    });
    expect(store.sessionSummaries()).toEqual([]);
  });

  it("keeps a known map title when tosu later returns an empty one", () => {
    const events = fixtureEvents();
    events.forEach((event) => store.apply(event));

    const finished = events.findLast((event) => event.type === "play-finished");
    if (finished?.type !== "play-finished") throw new Error("play not found");
    const beatmap = { ...finished.play.beatmap, title: "", version: "" };
    store.apply({
      ...finished,
      play: {
        ...finished.play,
        id: "another-play",
        endedAt: finished.play.endedAt + 1,
        beatmap,
      },
    });

    expect(store.recentPlays(1)[0]).toMatchObject({
      title: "SAD!",
      version: "Depression",
    });
  });

  it("closes a session left open by a crash at its last play", () => {
    const events = fixtureEvents();
    events.forEach((event) => store.apply(event));
    const lastPlay = events.findLast((event) => event.type === "play-finished");
    if (lastPlay?.type !== "play-finished") throw new Error("play not found");

    store.closeInterruptedSessions();

    const sqlite = new Database(databasePath, { readonly: true });
    const session = sqlite
      .prepare("SELECT ended_at AS endedAt FROM sessions")
      .get() as {
      endedAt: number;
    };
    sqlite.close();
    expect(session.endedAt).toBe(lastPlay.play.endedAt);
  });

  it("can be reopened without replaying the migrations", () => {
    store.close();
    store = new TrackerStore({ databasePath, migrationsFolder });
    expect(store.recentPlays(1)).toEqual([]);
  });
});
