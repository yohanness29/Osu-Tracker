import type {
  MatchScoreRow,
  PoolMap,
  RecentPlay,
  TournamentMatch,
  TournamentPool,
} from "@osu-tracker/storage";
import { average } from "./plays";

/** The mods a pool or a score is grouped by. Free mod and tiebreaker slots have their own. */
export type ModCategory =
  "NM" | "HD" | "HR" | "DT" | "EZ" | "FL" | "HT" | "FM" | "TB";

// Only these change how a map plays: NF, ScoreV2 or SD do not.
const PLAYED_MODS = ["HD", "HR", "DT", "EZ", "FL", "HT"];

function splitMods(mods: string): string[] {
  return (mods.match(/.{2}/g) ?? []).map((mod) => (mod === "NC" ? "DT" : mod));
}

function playedMods(mods: string): string[] {
  return splitMods(mods)
    .filter((mod) => PLAYED_MODS.includes(mod))
    .toSorted();
}

/** The family of a set of mods: speed first, then what the notes look like. */
export function categoryOfMods(mods: string): ModCategory {
  const list = playedMods(mods);
  for (const category of ["DT", "HT", "HR", "EZ", "FL", "HD"] as const) {
    if (list.includes(category)) return category;
  }
  return "NM";
}

export type PoolEntry = {
  slot: string;
  beatmapId: number;
  /** Applied to the map: empty for no mods, and for free mod and tiebreaker slots. */
  mods: string;
  freeMod: boolean;
};

const SLOT_PATTERN = /^(NM|HD|HR|DT|NC|HT|EZ|FL|FM|TB)(\d*)$/i;
const FREE_SLOTS = ["FM", "TB"];

function beatmapIdOf(text: string): number | null {
  const match =
    /^(\d+)$/.exec(text) ??
    /#[a-z]+\/(\d+)/.exec(text) ??
    /\/(?:b|beatmaps)\/(\d+)/.exec(text);
  const id = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * A pool pasted as lines such as « NM1 4630139 » or « HD2: https://osu.ppy.sh/b/123 ».
 * Lines that cannot be read are listed, so that the player can fix them.
 */
export function parsePool(text: string): {
  entries: PoolEntry[];
  errors: string[];
} {
  const entries: PoolEntry[] = [];
  const errors: string[] = [];

  for (const line of text.split(/\r?\n/).map((value) => value.trim())) {
    if (!line) continue;
    const [slotText = "", ...rest] = line.split(/[\s:;,|-]+/).filter(Boolean);
    const slot = SLOT_PATTERN.exec(slotText);
    const beatmapId = rest.map(beatmapIdOf).find((id) => id !== null) ?? null;
    if (!slot || beatmapId === null) {
      errors.push(line);
      continue;
    }

    const kind = slot[1]!.toUpperCase();
    const name = `${kind}${slot[2] ?? ""}`;
    if (entries.some((entry) => entry.slot === name)) {
      errors.push(`${line} (slot en double)`);
      continue;
    }
    const freeMod = FREE_SLOTS.includes(kind);
    entries.push({
      slot: name,
      beatmapId,
      mods: freeMod || kind === "NM" ? "" : kind === "NC" ? "DT" : kind,
      freeMod,
    });
  }
  return { entries, errors };
}

export function slotCategory(
  map: Pick<PoolMap, "slot" | "mods" | "freeMod">,
): ModCategory {
  if (map.freeMod) return map.slot.startsWith("TB") ? "TB" : "FM";
  return categoryOfMods(map.mods);
}

/** A play counts for a slot when it was made with its mods. Any mods do for a free slot. */
export function matchesSlot(
  playMods: string,
  map: Pick<PoolMap, "mods" | "freeMod">,
): boolean {
  if (map.freeMod) return true;
  return playedMods(playMods).join("") === playedMods(map.mods).join("");
}

export type Readiness = "ready" | "fragile" | "weak" | "untested";

export type SlotTraining = {
  attempts: number;
  /** Played to the end, failed apart. */
  finished: number;
  best: {
    accuracy: number;
    misses: number;
    maxCombo: number;
    endedAt: number;
  } | null;
  /** On the last finished plays. */
  recentAccuracy: number | null;
  recentMisses: number | null;
  unstableRate: number | null;
  hitError: number | null;
  /** Between the best and worst of the last finished plays: how steady the player is. */
  accuracySpread: number | null;
  readiness: Readiness;
  /** What decided the readiness, to be shown to the player. */
  reasons: string[];
};

const RECENT_PLAYS = 5;
const END_MARGIN_MS = 1000;

function isFinished(play: RecentPlay): boolean {
  if (play.result === "passed") return true;
  return (
    play.result !== "failed" && play.mapTimeMs >= play.lengthMs - END_MARGIN_MS
  );
}

function percent(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} %`;
}

function rounded(value: number): string {
  return value.toFixed(1).replace(".", ",").replace(",0", "");
}

/** Plays must be the latest first, as the store gives them. */
export function slotTraining(
  plays: RecentPlay[],
  map: Pick<PoolMap, "beatmapId" | "mods" | "freeMod">,
): SlotTraining {
  const own = plays.filter(
    (play) => play.beatmapId === map.beatmapId && matchesSlot(play.mods, map),
  );
  const finished = own.filter(isFinished);
  const recent = finished.slice(0, RECENT_PLAYS);
  const best = finished.toSorted((a, b) => b.accuracy - a.accuracy)[0];

  const recentAccuracy = average(recent.map((play) => play.accuracy));
  const recentMisses = average(recent.map((play) => play.misses));
  const unstableRate = average(
    recent.flatMap((play) =>
      play.unstableRate > 0 ? [play.unstableRate] : [],
    ),
  );
  const hitError = average(
    recent.flatMap((play) => (play.hitError === null ? [] : [play.hitError])),
  );
  const accuracies = recent.map((play) => play.accuracy);
  const accuracySpread =
    accuracies.length > 1
      ? Math.max(...accuracies) - Math.min(...accuracies)
      : null;

  const training = {
    attempts: own.length,
    finished: finished.length,
    best: best
      ? {
          accuracy: best.accuracy,
          misses: best.misses,
          maxCombo: best.maxCombo,
          endedAt: best.endedAt,
        }
      : null,
    recentAccuracy,
    recentMisses,
    unstableRate,
    hitError,
    accuracySpread,
  };
  return { ...training, ...judgeReadiness(training) };
}

// Thresholds of a player who fights for a match: below them, the slot costs points.
const READY = { accuracy: 97, misses: 2, unstableRate: 165 };
const WEAK = { accuracy: 94, misses: 5, unstableRate: 200, spread: 4 };
const HIT_ERROR_DRIFT_MS = 8;

function judgeReadiness(
  training: Omit<SlotTraining, "readiness" | "reasons">,
): Pick<SlotTraining, "readiness" | "reasons"> {
  const {
    finished,
    recentAccuracy,
    recentMisses,
    unstableRate,
    accuracySpread,
    hitError,
  } = training;
  if (finished === 0 || recentAccuracy === null || recentMisses === null) {
    return {
      readiness: "untested",
      reasons: [
        training.attempts === 0
          ? "Jamais jouée avec les mods du slot"
          : "Jamais terminée avec les mods du slot",
      ],
    };
  }

  const weak: string[] = [];
  const fragile: string[] = [];
  if (recentAccuracy < WEAK.accuracy)
    weak.push(`Précision moyenne de ${percent(recentAccuracy)}`);
  else if (recentAccuracy < READY.accuracy) {
    fragile.push(`Précision moyenne de ${percent(recentAccuracy)}`);
  }
  if (recentMisses >= WEAK.misses)
    weak.push(`${rounded(recentMisses)} misses en moyenne`);
  else if (recentMisses > READY.misses)
    fragile.push(`${rounded(recentMisses)} misses en moyenne`);
  if (unstableRate !== null && unstableRate >= WEAK.unstableRate) {
    weak.push(`UR de ${Math.round(unstableRate)} : timing irrégulier`);
  } else if (unstableRate !== null && unstableRate > READY.unstableRate) {
    fragile.push(`UR de ${Math.round(unstableRate)}`);
  }
  if (accuracySpread !== null && accuracySpread >= WEAK.spread) {
    fragile.push(
      `Résultats instables : ${rounded(accuracySpread)} points d’écart entre essais`,
    );
  }
  if (hitError !== null && Math.abs(hitError) >= HIT_ERROR_DRIFT_MS) {
    fragile.push(
      `Timing décalé de ${Math.round(Math.abs(hitError))} ms ${hitError < 0 ? "en avance" : "en retard"}`,
    );
  }
  if (finished === 1) fragile.push("Terminée une seule fois");

  if (weak.length > 0)
    return { readiness: "weak", reasons: [...weak, ...fragile] };
  if (fragile.length > 0) return { readiness: "fragile", reasons: fragile };
  return {
    readiness: "ready",
    reasons: [
      `${percent(recentAccuracy)} et ${rounded(recentMisses)} miss en moyenne`,
    ],
  };
}

export type PlayerResult = { accuracy: number; misses: number; score: number };

export type CategoryComparison = {
  category: ModCategory;
  /** Averages over the maps each player played in this category, null without any. */
  mine: { maps: number; accuracy: number; misses: number } | null;
  theirs: { maps: number; accuracy: number; misses: number } | null;
  /** Maps both played: only there can scores be compared directly. */
  common: number;
  /** Mean of my score divided by theirs on the common maps. */
  scoreRatio: number | null;
};

export type MapComparison = {
  beatmapId: number;
  title: string;
  version: string;
  category: ModCategory;
  mine: PlayerResult | null;
  theirs: PlayerResult | null;
};

export type OpponentComparison = {
  categories: CategoryComparison[];
  maps: MapComparison[];
};

/** Best score of a player on each map and mods category, across every match imported. */
function bestScores(
  scores: MatchScoreRow[],
  userId: number,
): Map<string, MatchScoreRow> {
  const best = new Map<string, MatchScoreRow>();
  for (const score of scores) {
    if (score.userId !== userId) continue;
    const key = `${score.beatmapId}-${categoryOfMods(score.mods)}`;
    const known = best.get(key);
    if (!known || score.score > known.score) best.set(key, score);
  }
  return best;
}

function summary(
  scores: MatchScoreRow[],
): { maps: number; accuracy: number; misses: number } | null {
  if (scores.length === 0) return null;
  return {
    maps: scores.length,
    accuracy: average(scores.map(({ accuracy }) => accuracy))!,
    misses: average(scores.map(({ misses }) => misses))!,
  };
}

const CATEGORY_ORDER: ModCategory[] = [
  "NM",
  "HD",
  "HR",
  "DT",
  "HT",
  "EZ",
  "FL",
  "FM",
  "TB",
];

/**
 * Two players compared on everything imported: qualifiers played in separate lobbies count too,
 * since the same maps were played.
 */
export function compareOpponent(
  matches: TournamentMatch[],
  meId: number,
  opponentId: number,
): OpponentComparison {
  const scores = matches.flatMap((match) => match.scores);
  const mine = bestScores(scores, meId);
  const theirs = bestScores(scores, opponentId);
  const keys = [...new Set([...mine.keys(), ...theirs.keys()])];

  const result = (score: MatchScoreRow | undefined): PlayerResult | null =>
    score
      ? { accuracy: score.accuracy, misses: score.misses, score: score.score }
      : null;

  const maps = keys
    .map((key) => {
      const sample = (mine.get(key) ?? theirs.get(key))!;
      return {
        beatmapId: sample.beatmapId,
        title: sample.title,
        version: sample.version,
        category: categoryOfMods(sample.mods),
        mine: result(mine.get(key)),
        theirs: result(theirs.get(key)),
        playedAt: sample.playedAt,
      };
    })
    .toSorted((a, b) => a.playedAt - b.playedAt)
    .map(({ playedAt: _playedAt, ...map }) => map);

  const categories = CATEGORY_ORDER.flatMap((category) => {
    const inCategory = (best: Map<string, MatchScoreRow>) =>
      [...best.values()].filter(
        (score) => categoryOfMods(score.mods) === category,
      );
    const myScores = inCategory(mine);
    const theirScores = inCategory(theirs);
    if (myScores.length === 0 && theirScores.length === 0) return [];

    const common = maps.filter(
      (map) => map.category === category && map.mine && map.theirs,
    );
    const ratios = common.flatMap(({ mine: my, theirs: their }) =>
      their!.score > 0 ? [my!.score / their!.score] : [],
    );
    return [
      {
        category,
        mine: summary(myScores),
        theirs: summary(theirScores),
        common: common.length,
        scoreRatio: average(ratios),
      },
    ];
  });

  return { categories, maps };
}

/** Everyone met in the imported matches, the player apart. Those met most first. */
export function playersMet(
  matches: TournamentMatch[],
  meId: number,
): { userId: number; username: string; games: number }[] {
  const players = new Map<
    number,
    { userId: number; username: string; games: number }
  >();
  for (const score of matches.flatMap((match) => match.scores)) {
    if (score.userId === meId) continue;
    const known = players.get(score.userId) ?? {
      userId: score.userId,
      username: score.username,
      games: 0,
    };
    known.games += 1;
    players.set(score.userId, known);
  }
  return [...players.values()].toSorted((a, b) => b.games - a.games);
}

/** What lost a map: combo when the accuracy was better, then misses, then accuracy. */
export type LossReason = "combo" | "misses" | "accuracy";

export type ReviewedGame = {
  gameId: number;
  title: string;
  version: string;
  category: ModCategory;
  mine: PlayerResult;
  theirs: PlayerResult;
  won: boolean;
  gap: number;
  lossReason: LossReason | null;
};

export type MatchReview = {
  opponent: { userId: number; username: string };
  games: ReviewedGame[];
  wins: number;
  losses: number;
};

/** A head-to-head match from the player's side. Null when no one else played with them. */
export function reviewMatch(
  match: TournamentMatch,
  meId: number,
): MatchReview | null {
  const [opponent] = playersMet([match], meId);
  if (!opponent) return null;

  const games = Map.groupBy(match.scores, ({ gameId }) => gameId);
  const reviewed = [...games.values()].flatMap((scores) => {
    const my = scores.find(({ userId }) => userId === meId);
    const their = scores.find(({ userId }) => userId === opponent.userId);
    if (!my || !their) return [];

    const won = my.score > their.score;
    const lossReason: LossReason | null = won
      ? null
      : my.accuracy >= their.accuracy
        ? "combo"
        : my.misses > their.misses
          ? "misses"
          : "accuracy";
    return [
      {
        gameId: my.gameId,
        title: my.title,
        version: my.version,
        category: categoryOfMods(my.mods),
        mine: { accuracy: my.accuracy, misses: my.misses, score: my.score },
        theirs: {
          accuracy: their.accuracy,
          misses: their.misses,
          score: their.score,
        },
        won,
        gap: my.score - their.score,
        lossReason,
      },
    ];
  });

  return {
    opponent: { userId: opponent.userId, username: opponent.username },
    games: reviewed,
    wins: reviewed.filter(({ won }) => won).length,
    losses: reviewed.filter(({ won }) => !won).length,
  };
}

/**
 * A match between two other players, from the side of the one named first in its name
 * ("(A) vs. (B)"). Null for a lobby of more or fewer than two players, like qualifiers.
 */
export function headToHead(match: TournamentMatch): {
  player: { userId: number; username: string };
  review: MatchReview;
} | null {
  const players = [
    ...new Map(
      match.scores.map(({ userId, username }) => [
        userId,
        { userId, username },
      ]),
    ).values(),
  ];
  if (players.length !== 2) return null;
  const position = (username: string): number => {
    const index = match.name.toLowerCase().indexOf(username.toLowerCase());
    return index === -1 ? Infinity : index;
  };
  const player = players.toSorted(
    (a, b) => position(a.username) - position(b.username),
  )[0]!;
  const review = reviewMatch(match, player.userId);
  return review ? { player, review } : null;
}

/** The id of a match from its link (osu.ppy.sh/community/matches/123 or osu.ppy.sh/mp/123). */
export function parseMatchId(text: string): number | null {
  const value = text.trim();
  const match =
    /^(\d+)$/.exec(value) ?? /\/(?:community\/matches|mp)\/(\d+)/.exec(value);
  const id = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** The imported matches of one round: the pool they were played on. */
export type MatchRound = {
  /** Null for the matches played on none of the pools added. */
  pool: TournamentPool | null;
  matches: TournamentMatch[];
};

/** The pool a match was played on: the one sharing the most maps with it. */
export function poolOfMatch(
  match: TournamentMatch,
  pools: TournamentPool[],
): TournamentPool | null {
  const played = new Set(match.scores.map(({ beatmapId }) => beatmapId));
  let best: TournamentPool | null = null;
  let bestShared = 0;
  for (const pool of pools) {
    const shared = new Set(
      pool.maps
        .map(({ beatmapId }) => beatmapId)
        .filter((beatmapId) => played.has(beatmapId)),
    ).size;
    if (shared > bestShared) {
      best = pool;
      bestShared = shared;
    }
  }
  return best;
}

/**
 * The matches grouped by round, the latest round first. In a round, the maps out of its pool are
 * left out: warm-ups the players picked before the match.
 */
export function matchRounds(
  matches: TournamentMatch[],
  pools: TournamentPool[],
): MatchRound[] {
  const rounds = new Map<string | null, MatchRound>();
  for (const match of matches) {
    const pool = poolOfMatch(match, pools);
    const round = rounds.get(pool?.id ?? null) ?? { pool, matches: [] };
    const inPool = pool
      ? new Set(pool.maps.map(({ beatmapId }) => beatmapId))
      : null;
    round.matches.push(
      inPool
        ? {
            ...match,
            scores: match.scores.filter(({ beatmapId }) =>
              inPool.has(beatmapId),
            ),
          }
        : match,
    );
    rounds.set(pool?.id ?? null, round);
  }
  const firstMatch = (round: MatchRound): number =>
    Math.min(...round.matches.map(({ startedAt }) => startedAt));
  return [...rounds.values()].toSorted((a, b) => {
    if (!a.pool !== !b.pool) return a.pool ? -1 : 1;
    return firstMatch(b) - firstMatch(a);
  });
}

/** A qualifier lobby: named so, or played by more than two players. */
export function isQualifierMatch(match: TournamentMatch): boolean {
  const players = new Set(match.scores.map(({ userId }) => userId)).size;
  return /qualif/i.test(match.name) || players > 2;
}

/**
 * The seeds the qualifiers give: on each map, the players are ranked by their best score (the pool
 * can be played more than once), and the lowest sum of ranks seeds first. Equal scores share a
 * rank, and a map not played counts as ranked last.
 */
export function qualifierSeeds(
  matches: TournamentMatch[],
): Map<number, number> {
  const scores = matches
    .filter(isQualifierMatch)
    .flatMap((match) => match.scores);
  const players = [...new Set(scores.map(({ userId }) => userId))];
  const best = new Map<number, Map<number, number>>();
  for (const { beatmapId, userId, score } of scores) {
    const onMap = best.get(beatmapId) ?? new Map<number, number>();
    onMap.set(userId, Math.max(onMap.get(userId) ?? 0, score));
    best.set(beatmapId, onMap);
  }

  const ranks = new Map(players.map((userId) => [userId, 0]));
  const totals = new Map(players.map((userId) => [userId, 0]));
  for (const onMap of best.values()) {
    const results = [...onMap.values()];
    for (const userId of players) {
      const own = onMap.get(userId);
      // Equal scores share a rank: 1, 2, 2, 4.
      const rank =
        own === undefined
          ? players.length + 1
          : 1 + results.filter((other) => other > own).length;
      ranks.set(userId, ranks.get(userId)! + rank);
      totals.set(userId, totals.get(userId)! + (onMap.get(userId) ?? 0));
    }
  }

  const order = players.toSorted(
    (a, b) => ranks.get(a)! - ranks.get(b)! || totals.get(b)! - totals.get(a)!,
  );
  return new Map(order.map((userId, index) => [userId, index + 1]));
}

export type PlayerStanding = {
  userId: number;
  username: string;
  /** Null when the player is in no qualifier lobby imported. */
  seed: number | null;
  /** Bracket matches lost, among those imported. */
  losses: number;
  eliminated: boolean;
  /** What decided it: a choice by hand, the bracket, or the matches imported. */
  decidedBy: "hand" | "bracket" | "matches";
  /** Maps played in the imported matches. */
  games: number;
};

/** A player said in or out by hand, above what the bracket and the matches say. */
export type ManualStatus = { userId: number; eliminated: boolean };

export type TournamentFormat = {
  /** How many players the qualifiers keep; null when everyone goes on. */
  qualifiedCount: number | null;
  /** With a loser bracket, a player is out after two lost matches. */
  loserBracket: boolean;
};

/**
 * What the bracket of the tournament says, when one is linked: who plays in it, and who it has
 * knocked out, forfeits included. Names as written on the bracket.
 */
export type BracketStatus = { players: string[]; out: string[] };

/**
 * Every player met, the player included, by seed: who is still in the tournament. With the
 * bracket, a player in it is out only when it says so; the matches imported decide otherwise.
 */
export function tournamentStandings(
  matches: TournamentMatch[],
  format: TournamentFormat,
  bracket: BracketStatus | null = null,
  manual: ManualStatus[] = [],
): PlayerStanding[] {
  const seeds = qualifierSeeds(matches);
  const players = new Map<number, PlayerStanding>();
  for (const { userId, username } of matches.flatMap((match) => match.scores)) {
    const known = players.get(userId) ?? {
      userId,
      username,
      seed: seeds.get(userId) ?? null,
      losses: 0,
      eliminated: false,
      decidedBy: "matches",
      games: 0,
    };
    known.games += 1;
    players.set(userId, known);
  }

  for (const match of matches) {
    if (isQualifierMatch(match)) continue;
    const between = headToHead(match);
    if (!between || between.review.wins === between.review.losses) continue;
    const loser =
      between.review.wins < between.review.losses
        ? between.player.userId
        : between.review.opponent.userId;
    players.get(loser)!.losses += 1;
  }

  const allowedLosses = format.loserBracket ? 2 : 1;
  const qualified = format.qualifiedCount;
  const key = (name: string): string => name.trim().toLowerCase();
  const inBracket = new Set(bracket?.players.map(key));
  const outOfBracket = new Set(bracket?.out.map(key));
  for (const player of players.values()) {
    const notQualified =
      qualified !== null &&
      seeds.size > 0 &&
      (player.seed === null || player.seed > qualified);
    const byHand = manual.find(({ userId }) => userId === player.userId);
    if (byHand) {
      player.eliminated = byHand.eliminated;
      player.decidedBy = "hand";
    } else if (inBracket.has(key(player.username))) {
      player.eliminated = notQualified || outOfBracket.has(key(player.username));
      player.decidedBy = "bracket";
    } else {
      player.eliminated = notQualified || player.losses >= allowedLosses;
    }
  }

  return [...players.values()].toSorted(
    (a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity) || b.games - a.games,
  );
}

/** A pool of qualifiers, named so: Qualifiers, Quals… */
export function isQualifierPool(pool: { name: string }): boolean {
  return /qualif|^quals?$/i.test(pool.name.trim());
}

/**
 * Where the player stands in the tournament.
 * - dnq: not among the players the qualifiers keep;
 * - placed: done, eliminated or winner, placed between `high` and `low` (17-32 is high 32, low 17), or exactly
 *   `high` when both are equal;
 * - alive: still in the tournament;
 * - unknown: nothing imported shows the player in it.
 */
export type Placement =
  | { kind: "unknown" }
  | { kind: "dnq" }
  | { kind: "alive" }
  | { kind: "placed"; high: number; low: number };

function powerOfTwoAbove(count: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(2, count)));
}

/**
 * The placement of a single elimination bracket: losing in the round where `size` players are
 * left places between `size` and `size / 2 + 1`, the final gives 2, winning it gives 1.
 * With a loser bracket, the round of the last loss stands for it: close, not exact.
 */
export function tournamentPlacement(
  matches: TournamentMatch[],
  pools: TournamentPool[],
  format: TournamentFormat,
  userId: number,
  bracket: BracketStatus | null = null,
  manual: ManualStatus[] = [],
): Placement {
  const standings = tournamentStandings(matches, format, bracket, manual);
  const me = standings.find((player) => player.userId === userId);
  if (!me) return { kind: "unknown" };

  const seeded = standings.filter(({ seed }) => seed !== null).length;
  if (
    format.qualifiedCount !== null &&
    seeded > 0 &&
    (me.seed === null || me.seed > format.qualifiedCount)
  ) {
    return { kind: "dnq" };
  }

  // The bracket knows when the player is still in, even without every match imported.
  const name = me.username.trim().toLowerCase();
  const onBracket = (names: string[]): boolean =>
    names.some((candidate) => candidate.trim().toLowerCase() === name);
  if (me.decidedBy === "hand" && !me.eliminated) return { kind: "alive" };
  if (bracket && onBracket(bracket.players) && !onBracket(bracket.out)) {
    return { kind: "alive" };
  }

  const bracketPools = pools.filter((pool) => !isQualifierPool(pool));
  const bracketMatches = matches
    .filter((match) => !isQualifierMatch(match))
    .toSorted((a, b) => a.startedAt - b.startedAt);
  const bracketPlayers = new Set(
    bracketMatches.flatMap(({ scores }) => scores.map((score) => score.userId)),
  ).size;
  const size = format.qualifiedCount ?? powerOfTwoAbove(Math.max(seeded, bracketPlayers));

  // Round by round, the matches the player won and lost.
  const allowedLosses = format.loserBracket ? 2 : 1;
  let losses = 0;
  let lastWin = -1;
  for (const match of bracketMatches) {
    const between = headToHead(match);
    if (!between || between.review.wins === between.review.losses) continue;
    const players = [between.player.userId, between.review.opponent.userId];
    if (!players.includes(userId)) continue;
    const won =
      (between.player.userId === userId) ===
      between.review.wins > between.review.losses;
    const pool = poolOfMatch(match, bracketPools);
    const round = pool ? bracketPools.indexOf(pool) : -1;
    if (won) {
      lastWin = Math.max(lastWin, round);
      continue;
    }
    losses += 1;
    if (losses >= allowedLosses) {
      const left = Math.max(2, size / 2 ** Math.max(0, round));
      return { kind: "placed", high: left, low: left <= 2 ? 2 : left / 2 + 1 };
    }
  }

  // The final won: the round of two players.
  if (lastWin >= 0 && size / 2 ** lastWin <= 2) return { kind: "placed", high: 1, low: 1 };
  return { kind: "alive" };
}
