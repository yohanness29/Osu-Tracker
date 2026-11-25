import { describe, expect, it } from "vitest";
import {
  bracketEliminations,
  parseChallonge,
  parseChallongeBracket,
} from "./challonge";

describe("parseChallonge", () => {
  it("reads the id of a bracket from its link", () => {
    expect(parseChallonge("https://challonge.com/AUMT23")).toBe("challonge.com/AUMT23");
    expect(parseChallonge(" challonge.com/AUMT23/module ")).toBe("challonge.com/AUMT23");
    expect(parseChallonge("https://www.challonge.com/fr/AUMT23")).toBe("challonge.com/AUMT23");
    expect(parseChallonge("AUMT23")).toBe("challonge.com/AUMT23");
  });

  it("keeps the organisation of a bracket", () => {
    expect(parseChallonge("https://btt.challonge.com/btt10")).toBe("btt.challonge.com/btt10");
  });

  it("refuses what is not a Challonge link", () => {
    expect(parseChallonge("https://osu.ppy.sh/community/matches/1")).toBeNull();
    expect(parseChallonge("https://challonge.com/")).toBeNull();
    expect(parseChallonge("")).toBeNull();
  });
});

/** A match drawn as Challonge does, cut down to what is read. */
function drawn(
  identifier: string,
  state: string,
  players: [name: string, classes: string][],
): string {
  const rows = players
    .map(
      ([name, classes]) =>
        `<svg x="0" class="match--player" data-participant-id="1"><title>${name}</title>` +
        `<text class="match--seed">1</text><text class="match--player-name ${classes}">${name}</text></svg>`,
    )
    .join("");
  return `<g transform="translate(0 0)" class="match -${state} " data-identifier="${identifier}" data-match-id="9">${rows}</g>`;
}

const bracket = `<svg>${[
  drawn("1", "complete", [["TomadouSora", " -winner"], ["yohanness", ""]]),
  drawn("2", "complete", [["walled", " -winner"], ["i love manosaba", ""]]),
  // A forfeit: a score of -1, a winner all the same.
  drawn("3", "complete", [["Envid", " -winner"], ["Lnk", ""]]),
  drawn("4", "complete", [["yohanness", " -winner"], ["i love manosaba", ""]]),
  drawn("5", "pending", [["Loser of 60", "-placeholder"], ["yohanness", ""]]),
  drawn("6", "open", [["A &amp; B", ""], ["Lnk", ""]]),
].join("")}</svg>`;

describe("parseChallongeBracket", () => {
  it("reads each match, its players and its winner, empty slots left out", () => {
    const matches = parseChallongeBracket(bracket);
    expect(matches).toHaveLength(6);
    expect(matches[0]).toEqual({
      identifier: "1",
      state: "complete",
      players: [
        { name: "TomadouSora", winner: true },
        { name: "yohanness", winner: false },
      ],
    });
    expect(matches[4]!.players.map(({ name }) => name)).toEqual(["yohanness"]);
    expect(matches[5]!.players[0]!.name).toBe("A & B");
  });
});

describe("bracketEliminations", () => {
  it("knocks a player out at the second loss with a loser bracket, forfeits counted", () => {
    const { players, out } = bracketEliminations(parseChallongeBracket(bracket), true);
    expect(out).toEqual(["i love manosaba"]);
    expect(players).toContain("Lnk");
  });

  it("knocks a player out at the first loss without one", () => {
    const { out } = bracketEliminations(parseChallongeBracket(bracket), false);
    expect(out.toSorted()).toEqual(["Lnk", "i love manosaba", "yohanness"]);
  });
});
