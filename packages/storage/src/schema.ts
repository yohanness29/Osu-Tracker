import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  name: text("name"),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  startPp: real("start_pp").notNull(),
  endPp: real("end_pp"),
});

// A goal without session waits for the next one to start.
export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id),
  type: text("type", {
    enum: ["pp_gain", "passes", "full_combos", "accuracy"],
  }).notNull(),
  target: real("target").notNull(),
  minStars: real("min_stars"),
  createdAt: integer("created_at").notNull(),
});

export const beatmaps = sqliteTable("beatmaps", {
  checksum: text("checksum").primaryKey(),
  beatmapId: integer("beatmap_id").notNull(),
  beatmapsetId: integer("beatmapset_id").notNull(),
  artist: text("artist").notNull(),
  title: text("title").notNull(),
  version: text("version").notNull(),
  mapper: text("mapper").notNull(),
  status: text("status").notNull(),
  lengthMs: integer("length_ms").notNull(),
  maxCombo: integer("max_combo").notNull(),
});

// Filled independently of plays, once the calculation is done.
export const noModMaxPp = sqliteTable(
  "no_mod_max_pp",
  {
    beatmapChecksum: text("beatmap_checksum").notNull(),
    mode: text("mode").notNull(),
    pp: real("pp").notNull(),
    style: text("style"),
    // JSON list. Null for maps analyzed before tags existed.
    tags: text("tags"),
  },
  (table) => [primaryKey({ columns: [table.beatmapChecksum, table.mode] })],
);

// Maps that may be suggested, filled from the osu! search.
export const catalogMaps = sqliteTable("catalog_maps", {
  beatmapId: integer("beatmap_id").primaryKey(),
  beatmapsetId: integer("beatmapset_id").notNull(),
  checksum: text("checksum").notNull(),
  mode: text("mode").notNull(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  mapper: text("mapper").notNull(),
  version: text("version").notNull(),
  stars: real("stars").notNull(),
  ar: real("ar").notNull(),
  bpm: real("bpm").notNull(),
  lengthSeconds: integer("length_seconds").notNull(),
  playCount: integer("play_count").notNull(),
  style: text("style"),
  // JSON list. Null for maps analyzed before tags existed.
  tags: text("tags"),
});

export const catalogAnalysis = sqliteTable(
  "catalog_analysis",
  {
    beatmapId: integer("beatmap_id")
      .notNull()
      .references(() => catalogMaps.beatmapId, { onDelete: "cascade" }),
    mods: text("mods").notNull(),
    stars: real("stars").notNull(),
    // With the mods applied. Null for maps analyzed before these values existed.
    ar: real("ar"),
    od: real("od"),
    cs: real("cs"),
    hp: real("hp"),
    // JSON: pp reached at each analyzed accuracy.
    ppByAccuracy: text("pp_by_accuracy").notNull(),
  },
  (table) => [primaryKey({ columns: [table.beatmapId, table.mods] })],
);

// Latest top scores of the profile, per mode.
export const topScores = sqliteTable(
  "top_scores",
  {
    mode: text("mode").notNull(),
    position: integer("position").notNull(),
    scoreId: integer("score_id").notNull(),
    beatmapId: integer("beatmap_id").notNull(),
    beatmapsetId: integer("beatmapset_id").notNull(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    version: text("version").notNull(),
    // Null for scores fetched before these were kept.
    checksum: text("checksum"),
    mapper: text("mapper"),
    // Without mods, as the API gives it for scores.
    stars: real("stars").notNull(),
    moddedStars: real("modded_stars"),
    mods: text("mods").notNull(),
    accuracy: real("accuracy").notNull(),
    pp: real("pp").notNull(),
    weightPercent: real("weight_percent"),
    rank: text("rank").notNull(),
    playedAt: integer("played_at").notNull(),
    fetchedAt: integer("fetched_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.mode, table.position] })],
);

export const plays = sqliteTable("plays", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  beatmapChecksum: text("beatmap_checksum")
    .notNull()
    .references(() => beatmaps.checksum),
  mode: text("mode").notNull(),
  mods: text("mods").notNull(),
  rate: real("rate").notNull(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at").notNull(),
  mapTimeMs: integer("map_time_ms").notNull(),
  result: text("result", {
    enum: ["passed", "failed", "retried", "quit"],
  }).notNull(),
  partial: integer("partial", { mode: "boolean" }).notNull(),
  score: integer("score").notNull(),
  accuracy: real("accuracy").notNull(),
  maxCombo: integer("max_combo").notNull(),
  n300: integer("n300").notNull(),
  n100: integer("n100").notNull(),
  n50: integer("n50").notNull(),
  misses: integer("misses").notNull(),
  geki: integer("geki").notNull(),
  katu: integer("katu").notNull(),
  sliderBreaks: integer("slider_breaks").notNull(),
  unstableRate: real("unstable_rate").notNull(),
  hitError: real("hit_error"),
  rank: text("rank").notNull(),
  pp: real("pp").notNull(),
  ppFc: real("pp_fc").notNull(),
  // pp added to the profile. Unknown without a connected account.
  netGain: real("net_gain"),
  // pp of an SS with the mods of this play. Unknown for the first recorded plays.
  maxPp: real("max_pp"),
  onlineScoreId: integer("online_score_id"),
  // Difficulty with the mods of this play.
  stars: real("stars").notNull(),
  ar: real("ar").notNull(),
  cs: real("cs").notNull(),
  od: real("od").notNull(),
  hp: real("hp").notNull(),
  bpm: real("bpm").notNull(),
});

export const playSamples = sqliteTable(
  "play_samples",
  {
    playId: text("play_id")
      .notNull()
      .references(() => plays.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    mapTimeMs: integer("map_time_ms").notNull(),
    pp: real("pp").notNull(),
    accuracy: real("accuracy").notNull(),
    combo: integer("combo").notNull(),
  },
  (table) => [primaryKey({ columns: [table.playId, table.position] })],
);

// Maps grouped by the player, as they wish.
export const playlists = sqliteTable("playlists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

// The texts of the map are kept: it may be neither played nor in the catalog.
export const playlistMaps = sqliteTable(
  "playlist_maps",
  {
    playlistId: text("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    beatmapChecksum: text("beatmap_checksum").notNull(),
    mode: text("mode").notNull(),
    beatmapId: integer("beatmap_id").notNull(),
    beatmapsetId: integer("beatmapset_id").notNull(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    version: text("version").notNull(),
    mapper: text("mapper").notNull(),
    addedAt: integer("added_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.playlistId, table.beatmapChecksum] }),
  ],
);

export const tournaments = sqliteTable("tournaments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode").notNull(),
  // Format of the matches, null until the player gives it.
  bestOf: integer("best_of"),
  bans: integer("bans"),
  // How many players the qualifiers keep, and whether a loss sends to a loser bracket.
  qualifiedCount: integer("qualified_count"),
  loserBracket: integer("loser_bracket", { mode: "boolean" })
    .notNull()
    .default(false),
  /** The id of its bracket on Challonge, as in challonge.com/<id>. */
  challonge: text("challonge"),
  // The next match, to prepare it.
  nextMatchAt: integer("next_match_at"),
  nextPoolId: text("next_pool_id"),
  nextOpponentId: integer("next_opponent_id"),
  createdAt: integer("created_at").notNull(),
});

// The maps of one round: qualifiers, round of 32…
export const tournamentPools = sqliteTable("tournament_pools", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
  /** The format of the round: its matches are won at (best of + 1) / 2 maps. */
  bestOf: integer("best_of"),
  /** Bans per player in the round. */
  bans: integer("bans"),
});

// Values read with the mods of the slot when the pool was added.
export const poolMaps = sqliteTable(
  "pool_maps",
  {
    poolId: text("pool_id")
      .notNull()
      .references(() => tournamentPools.id, { onDelete: "cascade" }),
    slot: text("slot").notNull(),
    position: integer("position").notNull(),
    mods: text("mods").notNull(),
    // Free mod and tiebreaker slots: any mods may be played.
    freeMod: integer("free_mod", { mode: "boolean" }).notNull(),
    beatmapId: integer("beatmap_id").notNull(),
    beatmapsetId: integer("beatmapset_id").notNull(),
    checksum: text("checksum").notNull(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    version: text("version").notNull(),
    mapper: text("mapper").notNull(),
    stars: real("stars").notNull(),
    ar: real("ar").notNull(),
    od: real("od").notNull(),
    cs: real("cs").notNull(),
    hp: real("hp").notNull(),
    bpm: real("bpm").notNull(),
    lengthSeconds: real("length_seconds").notNull(),
    style: text("style"),
    // JSON list.
    tags: text("tags").notNull(),
  },
  (table) => [primaryKey({ columns: [table.poolId, table.slot] })],
);

// A multiplayer match read from the osu! website: qualifiers or a match against an opponent.
export const tournamentMatches = sqliteTable("tournament_matches", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  osuMatchId: integer("osu_match_id").notNull(),
  name: text("name").notNull(),
  startedAt: integer("started_at").notNull(),
  importedAt: integer("imported_at").notNull(),
});

// A player said in or out by hand: for brackets kept elsewhere than on Challonge, or to fix one.
export const playerStatuses = sqliteTable(
  "player_statuses",
  {
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull(),
    eliminated: integer("eliminated", { mode: "boolean" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.tournamentId, table.userId] })],
);

export const matchScores = sqliteTable(
  "match_scores",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => tournamentMatches.id, { onDelete: "cascade" }),
    gameId: integer("game_id").notNull(),
    position: integer("position").notNull(),
    beatmapId: integer("beatmap_id").notNull(),
    title: text("title").notNull(),
    version: text("version").notNull(),
    playedAt: integer("played_at").notNull(),
    userId: integer("user_id").notNull(),
    username: text("username").notNull(),
    mods: text("mods").notNull(),
    score: integer("score").notNull(),
    accuracy: real("accuracy").notNull(),
    maxCombo: integer("max_combo").notNull(),
    n300: integer("n300").notNull(),
    n100: integer("n100").notNull(),
    misses: integer("misses").notNull(),
    passed: integer("passed", { mode: "boolean" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.gameId, table.userId] }),
  ],
);
