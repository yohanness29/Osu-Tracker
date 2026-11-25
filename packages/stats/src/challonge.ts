/**
 * A bracket on Challonge, from its link: challonge.com/AUMT23, a translated page
 * (challonge.com/fr/AUMT23), or the bracket of an organisation (btt.challonge.com/btt10).
 * Kept as "challonge.com/AUMT23" or "btt.challonge.com/btt10".
 */
export function parseChallonge(text: string): string | null {
  const value = text.trim();
  if (/^[\w-]+$/.test(value)) return `challonge.com/${value}`;

  const match = /^(?:https?:\/\/)?((?:[\w-]+\.)?challonge\.com)\/([^?#]+)/i.exec(value);
  if (!match) return null;
  const host = match[1]!.toLowerCase().replace(/^www\./, "");
  const parts = match[2]!.split("/").filter(Boolean);
  // A language before the id: fr, pt_BR…
  if (parts.length > 1 && /^[a-z]{2}(_[A-Z]{2})?$/.test(parts[0]!)) parts.shift();
  const id = parts[0]?.replace(/\.(svg|json)$/, "");
  return id && /^[\w-]+$/.test(id) ? `${host}/${id}` : null;
}

/** A player in a match of the bracket, as Challonge draws it. */
export type BracketPlayer = { name: string; winner: boolean };

export type BracketMatch = {
  /** The number Challonge shows next to the match. */
  identifier: string;
  state: "complete" | "open" | "pending";
  players: BracketPlayer[];
};

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

/**
 * The matches of a bracket, read from the SVG image Challonge draws of it: winners and losers
 * brackets alike, forfeits included (a score of -1 still has a winner).
 */
export function parseChallongeBracket(svg: string): BracketMatch[] {
  const starts = [
    ...svg.matchAll(
      /<g[^>]*class="match -(complete|open|pending)[^"]*"[^>]*data-identifier="([^"]*)"[^>]*>/g,
    ),
  ];
  return starts.map((start, index) => {
    const end = starts[index + 1]?.index ?? svg.length;
    const body = svg.slice(start.index, end);
    const players = [
      ...body.matchAll(
        /class="match--player"[^>]*>\s*<title>([^<]*)<\/title>[\s\S]*?class="match--player-name([^"]*)"/g,
      ),
    ]
      // Empty slots waiting for a result: "Loser of 60", "Winner of Losers Bracket"…
      .filter(([, , classes]) => !/(^|\s)-placeholder(\s|$)/.test(classes!))
      .map(([, name, classes]) => ({
        name: decodeEntities(name!).trim(),
        winner: /(^|\s)-winner(\s|$)/.test(classes!),
      }));
    return {
      identifier: start[2]!,
      state: start[1] as BracketMatch["state"],
      players,
    };
  });
}

/**
 * Who the bracket has knocked out: a player is out after as many lost matches as the format
 * allows, one without a loser bracket, two with one. Names are kept as written on Challonge.
 */
export function bracketEliminations(
  matches: BracketMatch[],
  loserBracket: boolean,
): { players: string[]; out: string[] } {
  const losses = new Map<string, number>();
  for (const { players } of matches) {
    for (const { name } of players) if (name) losses.set(name, losses.get(name) ?? 0);
  }
  for (const match of matches) {
    if (match.state !== "complete" || !match.players.some(({ winner }) => winner)) continue;
    for (const { name, winner } of match.players) {
      if (name && !winner) losses.set(name, losses.get(name)! + 1);
    }
  }
  const allowed = loserBracket ? 2 : 1;
  return {
    players: [...losses.keys()],
    out: [...losses].filter(([, count]) => count >= allowed).map(([name]) => name),
  };
}
