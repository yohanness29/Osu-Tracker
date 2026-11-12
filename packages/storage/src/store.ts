import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  lte,
  inArray,
  isNotNull,
  isNull,
  max,
  notInArray,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type {
  PlayResult,
  PlaySample,
  TrackedPlay,
  TrackerEvent,
} from "@osu-tracker/shared";
import * as schema from "./schema";

const {
  beatmaps,
  catalogAnalysis,
  catalogMaps,
  goals,
  noModMaxPp,
  playSamples,
  playlistMaps,
  playlists,
  plays,
  sessions,
  topScores,
} = schema;

// tosu cannot always read map texts: an empty one must not replace a known one.
function keepKnownText(column: AnyColumn) {
  return sql`coalesce(nullif(excluded.${sql.identifier(column.name)}, ''), ${column})`;
}

export type StoreOptions = {
  databasePath: string;
  migrationsFolder: string;
};

export type CatalogMapRow = typeof catalogMaps.$inferSelect;

/** What the analysis of a map file tells about its patterns. */
export type MapStyleValues = { style: string | null; tags: string[] };

function parseTags(tags: string | null): string[] {
  return tags === null ? [] : (JSON.parse(tags) as string[]);
}

export type CatalogSuggestionRow = Omit<CatalogMapRow, "stars" | "tags"> & {
  tags: string[];
  mapStars: number;
  mods: string;
  stars: number;
  od: number | null;
  cs: number | null;
  hp: number | null;
  ppByAccuracy: { accuracy: number; pp: number }[];
};

export type TopScoreRow = typeof topScores.$inferSelect;
export type NewTopScore = Omit<
  TopScoreRow,
  "mode" | "position" | "fetchedAt" | "moddedStars"
>;

export type MapTextsUpdate = {
  beatmapId: number;
  title: string;
  artist: string;
  version: string;
  mapper: string;
};

export type GoalType = "pp_gain" | "passes" | "full_combos" | "accuracy";

export type Goal = {
  id: string;
  sessionId: string | null;
  type: GoalType;
  target: number;
  minStars: number | null;
  createdAt: number;
};

export type NewGoal = Pick<Goal, "sessionId" | "type" | "target" | "minStars">;

export type RecentPlay = {
  id: string;
  sessionId: string;
  beatmapChecksum: string;
  beatmapId: number;
  beatmapsetId: number;
  title: string;
  version: string;
  artist: string;
  mapper: string;
  mode: string;
  mods: string;
  result: TrackedPlay["result"];
  partial: boolean;
  accuracy: number;
  pp: number;
  maxPp: number | null;
  noModMaxPp: number | null;
  netGain: number | null;
  rank: string;
  score: number;
  stars: number;
  ar: number;
  bpm: number;
  n300: number;
  n100: number;
  n50: number;
  misses: number;
  sliderBreaks: number;
  unstableRate: number;
  hitError: number | null;
  style: string | null;
  tags: string[];
  mapTimeMs: number;
  lengthMs: number;
  startedAt: number;
  endedAt: number;
};

export type ResultCounts = Record<PlayResult, number>;

export type SessionSummary = ResultCounts & {
  id: string;
  name: string | null;
  startedAt: number;
  endedAt: number | null;
  startPp: number;
  endPp: number | null;
  plays: number;
  playTimeMs: number;
};

export type MapAnalysis = { mods: string; stars: number; ssPp: number };

export type MapDetail = {
  checksum: string;
  beatmapId: number;
  beatmapsetId: number;
  artist: string;
  title: string;
  version: string;
  mapper: string;
  status: string;
  lengthMs: number;
  /** 0 when unknown, for a map that was never played. */
  maxCombo: number;
  plays: RecentPlay[];
  /** What the map can give, when it was analyzed for suggestions. */
  analyses: MapAnalysis[];
  /** Style of the map in each mode it was analyzed for. */
  styles: (MapStyleValues & { mode: string })[];
};

/** Everything known about a session, to keep it outside of the app. */
export type SessionExport = {
  format: "osu-tracker-session";
  version: 1;
  exportedAt: number;
  session: SessionSummary;
  goals: Goal[];
  /** Oldest first, each with how its pp, accuracy and combo went along the map. */
  plays: (RecentPlay & { samples: PlaySample[] })[];
};

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  maps: number;
};

/** What a playlist needs to show a map, saved when it is added. */
export type PlaylistMapInput = {
  beatmapChecksum: string;
  mode: string;
  beatmapId: number;
  beatmapsetId: number;
  title: string;
  artist: string;
  version: string;
  mapper: string;
};

export type PlaylistMap = PlaylistMapInput & {
  addedAt: number;
  style: string | null;
  tags: string[];
  /** Without mods, when the map is in the catalog of suggestions. */
  stars: number | null;
  plays: number;
  passed: number;
};

export type MapResults = ResultCounts & {
  checksum: string;
  mode: string;
  beatmapId: number;
  beatmapsetId: number;
  title: string;
  artist: string;
  version: string;
  mapper: string;
  style: string | null;
  tags: string[];
  /** Each combination of mods played on the map, an empty string for none. */
  mods: string[];
  lastPlayedAt: number;
  /** The lowest of the plays: the map itself when it was played without mods. */
  stars: number;
};

function countResult(result: PlayResult) {
  return sql<number>`sum(${plays.result} = ${result})`;
}

export class TrackerStore {
  private readonly sqlite: Database.Database;
  private readonly db: BetterSQLite3Database<typeof schema>;

  constructor(options: StoreOptions) {
    this.sqlite = new Database(options.databasePath);
    this.sqlite.pragma("journal_mode = WAL");
    this.sqlite.pragma("foreign_keys = ON");
    this.db = drizzle(this.sqlite, { schema });
    migrate(this.db, { migrationsFolder: options.migrationsFolder });
  }

  apply(event: TrackerEvent): void {
    switch (event.type) {
      case "session-started":
        this.db
          .insert(sessions)
          .values({
            id: event.sessionId,
            startedAt: event.startedAt,
            startPp: event.startPp,
          })
          .run();
        this.db
          .update(goals)
          .set({ sessionId: event.sessionId })
          .where(isNull(goals.sessionId))
          .run();
        break;
      case "play-finished":
        this.savePlay(event.play, event.samples);
        break;
      case "session-ended":
        this.db
          .update(sessions)
          // A session resumed then closed without any tosu data has no new value.
          .set({ endedAt: event.endedAt, endPp: event.endPp || undefined })
          .where(eq(sessions.id, event.sessionId))
          .run();
        break;
      case "play-started":
      case "play-discarded":
        break;
    }
  }

  /** Sessions left open by a crash end with their last play. */
  closeInterruptedSessions(): void {
    const interrupted = this.db
      .select({
        id: sessions.id,
        startedAt: sessions.startedAt,
        lastPlayAt: max(plays.endedAt),
      })
      .from(sessions)
      .leftJoin(plays, eq(plays.sessionId, sessions.id))
      .where(isNull(sessions.endedAt))
      .groupBy(sessions.id)
      .all();

    for (const session of interrupted) {
      this.db
        .update(sessions)
        .set({ endedAt: session.lastPlayAt ?? session.startedAt })
        .where(eq(sessions.id, session.id))
        .run();
    }
  }

  recentPlays(limit: number): RecentPlay[] {
    return this.queryPlays(undefined, limit);
  }

  saveCatalogMaps(maps: Omit<CatalogMapRow, "style" | "tags">[]): void {
    this.db.transaction((tx) => {
      for (const map of maps) {
        const { beatmapId, ...values } = map;
        tx.insert(catalogMaps)
          .values(map)
          .onConflictDoUpdate({ target: catalogMaps.beatmapId, set: values })
          .run();
      }
    });
  }

  /** Most played first, among maps of a mode missing one of the wanted mods. */
  mapsToAnalyze(
    mode: string,
    mods: string[],
    limit: number,
    [minStars, maxStars]: [number, number] = [0, Infinity],
    /** Only among these maps, for example those of one search. */
    beatmapIds?: number[],
  ): CatalogMapRow[] {
    const analyzed = this.db
      .select({ beatmapId: catalogAnalysis.beatmapId })
      .from(catalogAnalysis)
      .where(
        and(inArray(catalogAnalysis.mods, mods), isNotNull(catalogAnalysis.ar)),
      )
      .groupBy(catalogAnalysis.beatmapId)
      .having(sql`count(*) >= ${mods.length}`);

    return this.db
      .select()
      .from(catalogMaps)
      .where(
        and(
          eq(catalogMaps.mode, mode),
          notInArray(catalogMaps.beatmapId, analyzed),
          gte(catalogMaps.stars, minStars),
          lte(catalogMaps.stars, maxStars),
          beatmapIds ? inArray(catalogMaps.beatmapId, beatmapIds) : undefined,
        ),
      )
      .orderBy(desc(catalogMaps.playCount))
      .limit(limit)
      .all();
  }

  /** The map is in the catalog, with its style and an analysis for each of these mods. */
  isCatalogAnalyzed(beatmapId: number, mods: string[]): boolean {
    const map = this.db
      .select({ tags: catalogMaps.tags })
      .from(catalogMaps)
      .where(eq(catalogMaps.beatmapId, beatmapId))
      .get();
    if (!map || map.tags === null) return false;

    const analyzed = this.db
      .select({ total: count() })
      .from(catalogAnalysis)
      .where(
        and(
          eq(catalogAnalysis.beatmapId, beatmapId),
          inArray(catalogAnalysis.mods, mods),
          isNotNull(catalogAnalysis.ar),
        ),
      )
      .get();
    return (analyzed?.total ?? 0) >= new Set(mods).size;
  }

  saveMapAnalyses(
    beatmapId: number,
    { style, tags }: MapStyleValues,
    analyses: {
      mods: string;
      stars: number;
      ar?: number;
      od?: number;
      cs?: number;
      hp?: number;
      ppByAccuracy: unknown[];
    }[],
  ): void {
    this.db.transaction((tx) => {
      tx.update(catalogMaps)
        .set({ style, tags: JSON.stringify(tags) })
        .where(eq(catalogMaps.beatmapId, beatmapId))
        .run();
      for (const { mods, ppByAccuracy, ...difficulty } of analyses) {
        const values = {
          ...difficulty,
          ppByAccuracy: JSON.stringify(ppByAccuracy),
        };
        tx.insert(catalogAnalysis)
          .values({ beatmapId, mods, ...values })
          .onConflictDoUpdate({
            target: [catalogAnalysis.beatmapId, catalogAnalysis.mods],
            set: values,
          })
          .run();
      }
    });
  }

  catalogSuggestions(mode: string): CatalogSuggestionRow[] {
    return this.db
      .select({
        map: catalogMaps,
        mods: catalogAnalysis.mods,
        stars: catalogAnalysis.stars,
        ar: catalogAnalysis.ar,
        od: catalogAnalysis.od,
        cs: catalogAnalysis.cs,
        hp: catalogAnalysis.hp,
        ppByAccuracy: catalogAnalysis.ppByAccuracy,
      })
      .from(catalogAnalysis)
      .innerJoin(
        catalogMaps,
        eq(catalogAnalysis.beatmapId, catalogMaps.beatmapId),
      )
      .where(eq(catalogMaps.mode, mode))
      .all()
      .map(
        ({
          map: { stars: mapStars, ...map },
          mods,
          stars,
          ar,
          od,
          cs,
          hp,
          ppByAccuracy,
        }) => ({
          ...map,
          tags: parseTags(map.tags),
          mapStars,
          mods,
          stars,
          ar: ar ?? map.ar,
          od,
          cs,
          hp,
          ppByAccuracy: JSON.parse(ppByAccuracy),
        }),
      );
  }

  setNetGain(playId: string, netGain: number): void {
    this.db.update(plays).set({ netGain }).where(eq(plays.id, playId)).run();
  }

  /** Best scores first. */
  topScores(mode: string): TopScoreRow[] {
    return this.db
      .select()
      .from(topScores)
      .where(eq(topScores.mode, mode))
      .orderBy(asc(topScores.position))
      .all();
  }

  /** Keeps the difficulty with mods already known: asking for it again costs a request each. */
  replaceTopScores(
    mode: string,
    scores: NewTopScore[],
    fetchedAt: number,
  ): void {
    const known = new Map(
      this.topScores(mode).map(({ scoreId, moddedStars }) => [
        scoreId,
        moddedStars,
      ]),
    );

    this.db.transaction((tx) => {
      tx.delete(topScores).where(eq(topScores.mode, mode)).run();
      if (scores.length === 0) return;

      tx.insert(topScores)
        .values(
          scores.map((score, position) => ({
            ...score,
            mode,
            position,
            fetchedAt,
            moddedStars: known.get(score.scoreId) ?? null,
          })),
        )
        .run();
    });
  }

  scoresMissingModdedStars(mode: string): TopScoreRow[] {
    return this.db
      .select()
      .from(topScores)
      .where(and(eq(topScores.mode, mode), isNull(topScores.moddedStars)))
      .orderBy(asc(topScores.position))
      .all();
  }

  setModdedStars(mode: string, scoreId: number, moddedStars: number): void {
    this.db
      .update(topScores)
      .set({ moddedStars })
      .where(and(eq(topScores.mode, mode), eq(topScores.scoreId, scoreId)))
      .run();
  }

  /** Maps analyzed before difficulty values with mods existed, with the mods to redo. */
  outdatedAnalyses(limit: number): { map: CatalogMapRow; mods: string[] }[] {
    const rows = this.db
      .select({ map: catalogMaps, mods: catalogAnalysis.mods })
      .from(catalogAnalysis)
      .innerJoin(
        catalogMaps,
        eq(catalogAnalysis.beatmapId, catalogMaps.beatmapId),
      )
      .where(isNull(catalogAnalysis.ar))
      .orderBy(desc(catalogMaps.playCount))
      .all();

    return [...Map.groupBy(rows, ({ map }) => map.beatmapId).values()]
      .slice(0, limit)
      .map((group) => ({
        map: group[0]!.map,
        mods: group.map(({ mods }) => mods),
      }));
  }

  /** Maps whose title tosu could not read. */
  beatmapsWithoutTitle(limit: number): number[] {
    return this.db
      .select({ beatmapId: beatmaps.beatmapId })
      .from(beatmaps)
      .where(and(eq(beatmaps.title, ""), gt(beatmaps.beatmapId, 0)))
      .limit(limit)
      .all()
      .map(({ beatmapId }) => beatmapId);
  }

  updateMapTexts({ beatmapId, ...texts }: MapTextsUpdate): void {
    this.db
      .update(beatmaps)
      .set(texts)
      .where(eq(beatmaps.beatmapId, beatmapId))
      .run();
  }

  /** Goals of a session, or those waiting for the next one when `sessionId` is null. */
  goals(sessionId: string | null): Goal[] {
    return this.db
      .select()
      .from(goals)
      .where(
        sessionId ? eq(goals.sessionId, sessionId) : isNull(goals.sessionId),
      )
      .orderBy(asc(goals.createdAt))
      .all();
  }

  addGoal(goal: NewGoal): void {
    this.db
      .insert(goals)
      .values({ ...goal, id: randomUUID(), createdAt: Date.now() })
      .run();
  }

  removeGoal(goalId: string): void {
    this.db.delete(goals).where(eq(goals.id, goalId)).run();
  }

  /** The plays of a session, latest first. */
  sessionPlays(sessionId: string): RecentPlay[] {
    return this.queryPlays(eq(plays.sessionId, sessionId));
  }

  /**
   * Joins sessions separated by less than `maxGapMs`, since closing the app is not a pause
   * in the game. Sessions without plays are removed.
   */
  mergeContiguousSessions(maxGapMs: number): void {
    const rows = this.db
      .select({
        id: sessions.id,
        name: sessions.name,
        startedAt: sessions.startedAt,
        endPp: sessions.endPp,
        lastPlayAt: max(plays.endedAt),
      })
      .from(sessions)
      .leftJoin(plays, eq(plays.sessionId, sessions.id))
      .groupBy(sessions.id)
      .orderBy(asc(sessions.startedAt))
      .all();

    this.db.transaction((tx) => {
      let current: {
        id: string;
        name: string | null;
        lastPlayAt: number;
        endPp: number | null;
      } | null = null;

      for (const { id, name, startedAt, endPp, lastPlayAt } of rows) {
        if (lastPlayAt === null) {
          tx.update(goals)
            .set({ sessionId: null })
            .where(eq(goals.sessionId, id))
            .run();
          tx.delete(sessions).where(eq(sessions.id, id)).run();
        } else if (current && startedAt - current.lastPlayAt < maxGapMs) {
          tx.update(plays)
            .set({ sessionId: current.id })
            .where(eq(plays.sessionId, id))
            .run();
          tx.update(goals)
            .set({ sessionId: current.id })
            .where(eq(goals.sessionId, id))
            .run();
          tx.delete(sessions).where(eq(sessions.id, id)).run();
          current.lastPlayAt = lastPlayAt;
          current.endPp = endPp || current.endPp;
          current.name ??= name;
          tx.update(sessions)
            .set({
              name: current.name,
              endedAt: lastPlayAt,
              endPp: current.endPp,
            })
            .where(eq(sessions.id, current.id))
            .run();
        } else {
          current = { id, name, lastPlayAt, endPp };
        }
      }
    });
  }

  /** An empty name gives the session its default name back. */
  /** Most recent first. */
  playlists(): Playlist[] {
    return this.db
      .select({
        id: playlists.id,
        name: playlists.name,
        createdAt: playlists.createdAt,
        maps: count(playlistMaps.beatmapChecksum),
      })
      .from(playlists)
      .leftJoin(playlistMaps, eq(playlistMaps.playlistId, playlists.id))
      .groupBy(playlists.id)
      .orderBy(desc(playlists.createdAt))
      .all();
  }

  createPlaylist(name: string, createdAt: number): string {
    const id = randomUUID();
    this.db
      .insert(playlists)
      .values({ id, name: name.trim() || "Nouvelle playlist", createdAt })
      .run();
    return id;
  }

  renamePlaylist(playlistId: string, name: string): void {
    if (!name.trim()) return;
    this.db
      .update(playlists)
      .set({ name: name.trim() })
      .where(eq(playlists.id, playlistId))
      .run();
  }

  /** Its maps go with it. */
  deletePlaylist(playlistId: string): void {
    this.db.delete(playlists).where(eq(playlists.id, playlistId)).run();
  }

  /** A map already there keeps the date it was first added. */
  addToPlaylist(
    playlistId: string,
    map: PlaylistMapInput,
    addedAt: number,
  ): void {
    this.db
      .insert(playlistMaps)
      .values({ playlistId, ...map, addedAt })
      .onConflictDoNothing()
      .run();
  }

  removeFromPlaylist(playlistId: string, beatmapChecksum: string): void {
    this.db
      .delete(playlistMaps)
      .where(
        and(
          eq(playlistMaps.playlistId, playlistId),
          eq(playlistMaps.beatmapChecksum, beatmapChecksum),
        ),
      )
      .run();
  }

  /** Ids of the playlists holding a map. */
  playlistsOfMap(beatmapChecksum: string): string[] {
    return this.db
      .select({ id: playlistMaps.playlistId })
      .from(playlistMaps)
      .where(eq(playlistMaps.beatmapChecksum, beatmapChecksum))
      .all()
      .map(({ id }) => id);
  }

  /** Last added first, with the style found while playing or for the suggestions. */
  playlistMaps(playlistId: string): PlaylistMap[] {
    const rows = this.db
      .select({
        map: playlistMaps,
        playedStyle: noModMaxPp.style,
        playedTags: noModMaxPp.tags,
        catalogStyle: catalogMaps.style,
        catalogTags: catalogMaps.tags,
        stars: catalogMaps.stars,
        plays: sql<number>`(select count(*) from ${plays} where ${plays.beatmapChecksum} = ${playlistMaps.beatmapChecksum} and ${plays.mode} = ${playlistMaps.mode})`,
        passed: sql<number>`(select count(*) from ${plays} where ${plays.beatmapChecksum} = ${playlistMaps.beatmapChecksum} and ${plays.mode} = ${playlistMaps.mode} and ${plays.result} = 'passed')`,
      })
      .from(playlistMaps)
      .leftJoin(
        noModMaxPp,
        and(
          eq(noModMaxPp.beatmapChecksum, playlistMaps.beatmapChecksum),
          eq(noModMaxPp.mode, playlistMaps.mode),
        ),
      )
      .leftJoin(
        catalogMaps,
        eq(catalogMaps.checksum, playlistMaps.beatmapChecksum),
      )
      .where(eq(playlistMaps.playlistId, playlistId))
      .orderBy(desc(playlistMaps.addedAt))
      .all();

    return rows.map(({ map: { playlistId: _playlistId, ...map }, ...row }) => {
      const fromPlays = row.playedStyle !== null;
      return {
        ...map,
        style: fromPlays ? row.playedStyle : row.catalogStyle,
        tags: parseTags(fromPlays ? row.playedTags : row.catalogTags),
        stars: row.stars,
        plays: row.plays,
        passed: row.passed,
      };
    });
  }

  /** Null for an unknown session, or one without any play. */
  sessionExport(sessionId: string, exportedAt: number): SessionExport | null {
    const session = this.sessionSummaries().find(({ id }) => id === sessionId);
    if (!session) return null;

    const samples = Map.groupBy(
      this.db
        .select()
        .from(playSamples)
        .innerJoin(plays, eq(playSamples.playId, plays.id))
        .where(eq(plays.sessionId, sessionId))
        .orderBy(asc(playSamples.position))
        .all()
        .map(({ play_samples: sample }) => sample),
      ({ playId }) => playId,
    );

    return {
      format: "osu-tracker-session",
      version: 1,
      exportedAt,
      session,
      goals: this.goals(sessionId),
      plays: this.sessionPlays(sessionId)
        .toReversed()
        .map((play) => ({
          ...play,
          samples: (samples.get(play.id) ?? []).map(
            ({ mapTimeMs, pp, accuracy, combo }) => ({
              mapTimeMs,
              pp,
              accuracy,
              combo,
            }),
          ),
        })),
    };
  }

  renameSession(sessionId: string, name: string): void {
    this.db
      .update(sessions)
      .set({ name: name.trim() || null })
      .where(eq(sessions.id, sessionId))
      .run();
  }

  /** Reopens the latest session if its last play is recent enough to continue it. */
  resumeSession(
    now: number,
    maxGapMs: number,
  ): { id: string; lastActivityAt: number } | null {
    const latest = this.db
      .select({ id: sessions.id, lastActivityAt: max(plays.endedAt) })
      .from(sessions)
      .innerJoin(plays, eq(plays.sessionId, sessions.id))
      .groupBy(sessions.id)
      .orderBy(desc(sessions.startedAt))
      .limit(1)
      .get();

    if (!latest?.lastActivityAt || now - latest.lastActivityAt >= maxGapMs)
      return null;

    this.db
      .update(sessions)
      .set({ endedAt: null })
      .where(eq(sessions.id, latest.id))
      .run();
    return { id: latest.id, lastActivityAt: latest.lastActivityAt };
  }

  /** A map with all its plays, latest first. A suggested map may have none. */
  mapDetail(checksum: string): MapDetail | null {
    const beatmap = this.db
      .select()
      .from(beatmaps)
      .where(eq(beatmaps.checksum, checksum))
      .get();
    const catalog = this.db
      .select()
      .from(catalogMaps)
      .where(eq(catalogMaps.checksum, checksum))
      .get();
    if (!beatmap && !catalog) return null;

    const analyses = catalog ? this.mapAnalyses(catalog.beatmapId) : [];
    const playsOfMap = this.queryPlays(eq(plays.beatmapChecksum, checksum));
    const styles = this.mapStyles(checksum, catalog);
    if (beatmap) return { ...beatmap, plays: playsOfMap, analyses, styles };

    const {
      beatmapId,
      beatmapsetId,
      artist,
      title,
      version,
      mapper,
      lengthSeconds,
    } = catalog!;
    return {
      checksum,
      beatmapId,
      beatmapsetId,
      artist,
      title,
      version,
      mapper,
      status: "ranked",
      lengthMs: lengthSeconds * 1000,
      maxCombo: 0,
      plays: playsOfMap,
      analyses,
      styles,
    };
  }

  /** Those found while playing, then the one of the suggestions for a mode not played. */
  private mapStyles(
    checksum: string,
    catalog: CatalogMapRow | undefined,
  ): MapDetail["styles"] {
    const played = this.db
      .select({
        mode: noModMaxPp.mode,
        style: noModMaxPp.style,
        tags: noModMaxPp.tags,
      })
      .from(noModMaxPp)
      .where(eq(noModMaxPp.beatmapChecksum, checksum))
      .all()
      .filter(({ style }) => style !== null);
    const suggested =
      catalog?.style && !played.some(({ mode }) => mode === catalog.mode)
        ? [{ mode: catalog.mode, style: catalog.style, tags: catalog.tags }]
        : [];

    return [...played, ...suggested].map(({ mode, style, tags }) => ({
      mode,
      style,
      tags: parseTags(tags),
    }));
  }

  private mapAnalyses(beatmapId: number): MapAnalysis[] {
    return this.db
      .select()
      .from(catalogAnalysis)
      .where(eq(catalogAnalysis.beatmapId, beatmapId))
      .all()
      .map(({ mods, stars, ppByAccuracy }) => {
        const values: { pp: number }[] = JSON.parse(ppByAccuracy);
        return { mods, stars, ssPp: values.at(-1)?.pp ?? 0 };
      });
  }

  /** Sessions with at least one play, latest first. */
  sessionSummaries(): SessionSummary[] {
    return this.db
      .select({
        id: sessions.id,
        name: sessions.name,
        startedAt: sessions.startedAt,
        endedAt: sessions.endedAt,
        startPp: sessions.startPp,
        endPp: sessions.endPp,
        plays: count(),
        playTimeMs: sql<number>`sum(${plays.endedAt} - ${plays.startedAt})`,
        passed: countResult("passed"),
        failed: countResult("failed"),
        retried: countResult("retried"),
        quit: countResult("quit"),
      })
      .from(sessions)
      .innerJoin(plays, eq(plays.sessionId, sessions.id))
      .groupBy(sessions.id)
      .orderBy(desc(sessions.startedAt))
      .all();
  }

  private queryPlays(where?: SQL, limit = -1): RecentPlay[] {
    return this.db
      .select({
        id: plays.id,
        sessionId: plays.sessionId,
        beatmapChecksum: plays.beatmapChecksum,
        beatmapId: beatmaps.beatmapId,
        beatmapsetId: beatmaps.beatmapsetId,
        title: beatmaps.title,
        version: beatmaps.version,
        artist: beatmaps.artist,
        mapper: beatmaps.mapper,
        mode: plays.mode,
        mods: plays.mods,
        result: plays.result,
        partial: plays.partial,
        accuracy: plays.accuracy,
        pp: plays.pp,
        maxPp: plays.maxPp,
        noModMaxPp: noModMaxPp.pp,
        netGain: plays.netGain,
        rank: plays.rank,
        score: plays.score,
        stars: plays.stars,
        ar: plays.ar,
        bpm: plays.bpm,
        n300: plays.n300,
        n100: plays.n100,
        n50: plays.n50,
        misses: plays.misses,
        sliderBreaks: plays.sliderBreaks,
        unstableRate: plays.unstableRate,
        hitError: plays.hitError,
        style: noModMaxPp.style,
        tags: noModMaxPp.tags,
        mapTimeMs: plays.mapTimeMs,
        lengthMs: beatmaps.lengthMs,
        startedAt: plays.startedAt,
        endedAt: plays.endedAt,
      })
      .from(plays)
      .innerJoin(beatmaps, eq(plays.beatmapChecksum, beatmaps.checksum))
      .leftJoin(
        noModMaxPp,
        and(
          eq(noModMaxPp.beatmapChecksum, plays.beatmapChecksum),
          eq(noModMaxPp.mode, plays.mode),
        ),
      )
      .where(where)
      .orderBy(desc(plays.endedAt))
      .limit(limit)
      .all()
      .map((play) => ({ ...play, tags: parseTags(play.tags) }));
  }

  /** Maps analyzed before tags existed still need it. */
  hasMapAnalysis(beatmapChecksum: string, mode: string): boolean {
    const row = this.db
      .select({ tags: noModMaxPp.tags })
      .from(noModMaxPp)
      .where(
        and(
          eq(noModMaxPp.beatmapChecksum, beatmapChecksum),
          eq(noModMaxPp.mode, mode),
        ),
      )
      .get();
    return row?.tags != null;
  }

  saveMapAnalysis(
    beatmapChecksum: string,
    mode: string,
    pp: number,
    { style, tags }: MapStyleValues,
  ): void {
    const values = { pp, style, tags: JSON.stringify(tags) };
    this.db
      .insert(noModMaxPp)
      .values({ beatmapChecksum, mode, ...values })
      .onConflictDoUpdate({
        target: [noModMaxPp.beatmapChecksum, noModMaxPp.mode],
        set: values,
      })
      .run();
  }

  /** Played maps analyzed before tags existed. */
  playedMapsWithoutTags(
    limit: number,
  ): { beatmapChecksum: string; mode: string; beatmapId: number }[] {
    return this.db
      .select({
        beatmapChecksum: noModMaxPp.beatmapChecksum,
        mode: noModMaxPp.mode,
        beatmapId: beatmaps.beatmapId,
      })
      .from(noModMaxPp)
      .innerJoin(beatmaps, eq(noModMaxPp.beatmapChecksum, beatmaps.checksum))
      .where(and(isNull(noModMaxPp.tags), gt(beatmaps.beatmapId, 0)))
      .limit(limit)
      .all();
  }

  /** Keeps the pp: it may come from the client the map was played on. */
  saveMapStyle(
    beatmapChecksum: string,
    mode: string,
    { style, tags }: MapStyleValues,
  ): void {
    this.db
      .update(noModMaxPp)
      .set({ style, tags: JSON.stringify(tags) })
      .where(
        and(
          eq(noModMaxPp.beatmapChecksum, beatmapChecksum),
          eq(noModMaxPp.mode, mode),
        ),
      )
      .run();
  }

  /** Suggested maps analyzed before tags existed, most played first. */
  catalogMapsWithoutTags(limit: number): CatalogMapRow[] {
    return this.db
      .select()
      .from(catalogMaps)
      .where(and(isNotNull(catalogMaps.style), isNull(catalogMaps.tags)))
      .orderBy(desc(catalogMaps.playCount))
      .limit(limit)
      .all();
  }

  saveCatalogStyle(beatmapId: number, { style, tags }: MapStyleValues): void {
    this.db
      .update(catalogMaps)
      .set({ style, tags: JSON.stringify(tags) })
      .where(eq(catalogMaps.beatmapId, beatmapId))
      .run();
  }

  /** Counts every play, or those of one session. */
  resultCounts(sessionId?: string): ResultCounts {
    const rows = this.db
      .select({ result: plays.result, total: count() })
      .from(plays)
      .where(sessionId ? eq(plays.sessionId, sessionId) : undefined)
      .groupBy(plays.result)
      .all();

    const counts: ResultCounts = { passed: 0, failed: 0, retried: 0, quit: 0 };
    for (const { result, total } of rows) counts[result] = total;
    return counts;
  }

  /** Results per map and mode, most recently played first. */
  mapResults(limit: number, mode?: string): MapResults[] {
    return this.db
      .select({
        checksum: beatmaps.checksum,
        mode: plays.mode,
        beatmapId: beatmaps.beatmapId,
        beatmapsetId: beatmaps.beatmapsetId,
        title: beatmaps.title,
        artist: beatmaps.artist,
        version: beatmaps.version,
        mapper: beatmaps.mapper,
        style: noModMaxPp.style,
        tags: noModMaxPp.tags,
        mods: sql<string>`group_concat(distinct ${plays.mods})`,
        lastPlayedAt: sql<number>`max(${plays.endedAt})`,
        stars: sql<number>`min(${plays.stars})`,
        passed: countResult("passed"),
        failed: countResult("failed"),
        retried: countResult("retried"),
        quit: countResult("quit"),
      })
      .from(plays)
      .innerJoin(beatmaps, eq(plays.beatmapChecksum, beatmaps.checksum))
      .leftJoin(
        noModMaxPp,
        and(
          eq(noModMaxPp.beatmapChecksum, plays.beatmapChecksum),
          eq(noModMaxPp.mode, plays.mode),
        ),
      )
      .where(mode ? eq(plays.mode, mode) : undefined)
      .groupBy(beatmaps.checksum, plays.mode)
      .orderBy(desc(max(plays.endedAt)))
      .limit(limit)
      .all()
      .map((map) => ({
        ...map,
        tags: parseTags(map.tags),
        mods: map.mods.split(","),
      }));
  }

  close(): void {
    this.sqlite.close();
  }

  /**
   * A play observed again after the app restarted in the middle of it, or while the game was
   * paused: same session, same map, same score and combo as a play already kept.
   */
  private isRepeatedPlay(play: TrackedPlay): boolean {
    if (!play.partial || play.score === 0) return false;
    const repeated = this.db
      .select({ id: plays.id })
      .from(plays)
      .where(
        and(
          eq(plays.sessionId, play.sessionId),
          eq(plays.beatmapChecksum, play.beatmap.checksum),
          eq(plays.score, play.score),
          eq(plays.maxCombo, play.maxCombo),
        ),
      )
      .get();
    return repeated !== undefined;
  }

  private savePlay(play: TrackedPlay, samples: PlaySample[]): void {
    const { beatmap, hits } = play;
    if (this.isRepeatedPlay(play)) return;

    const metadata = {
      beatmapId: beatmap.id,
      beatmapsetId: beatmap.setId,
      artist: beatmap.artist,
      title: beatmap.title,
      version: beatmap.version,
      mapper: beatmap.mapper,
      status: beatmap.status,
      lengthMs: beatmap.lastObjectTime,
      maxCombo: beatmap.maxCombo,
    };

    this.db.transaction((tx) => {
      tx.insert(beatmaps)
        .values({ checksum: beatmap.checksum, ...metadata })
        .onConflictDoUpdate({
          target: beatmaps.checksum,
          set: {
            ...metadata,
            artist: keepKnownText(beatmaps.artist),
            title: keepKnownText(beatmaps.title),
            version: keepKnownText(beatmaps.version),
            mapper: keepKnownText(beatmaps.mapper),
          },
        })
        .run();

      tx.insert(plays)
        .values({
          id: play.id,
          sessionId: play.sessionId,
          beatmapChecksum: beatmap.checksum,
          mode: play.mode,
          mods: play.mods,
          rate: play.rate,
          startedAt: play.startedAt,
          endedAt: play.endedAt,
          mapTimeMs: play.mapTimeMs,
          result: play.result,
          partial: play.partial,
          score: play.score,
          accuracy: play.accuracy,
          maxCombo: play.maxCombo,
          n300: hits.n300,
          n100: hits.n100,
          n50: hits.n50,
          misses: hits.misses,
          geki: hits.geki,
          katu: hits.katu,
          sliderBreaks: play.sliderBreaks,
          unstableRate: play.unstableRate,
          hitError: play.hitError,
          rank: play.rank,
          pp: play.pp,
          ppFc: play.ppFc,
          maxPp: beatmap.maxPp,
          onlineScoreId: play.onlineScoreId,
          stars: beatmap.stars,
          ar: beatmap.ar,
          cs: beatmap.cs,
          od: beatmap.od,
          hp: beatmap.hp,
          bpm: beatmap.bpm,
        })
        .run();

      if (samples.length > 0) {
        tx.insert(playSamples)
          .values(
            samples.map((sample, position) => ({
              playId: play.id,
              position,
              ...sample,
            })),
          )
          .run();
      }
    });
  }
}
