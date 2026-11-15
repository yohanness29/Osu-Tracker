import { describe, expect, it, vi } from "vitest";
import {
  errorOf,
  OsuBlockedError,
  OsuApiError,
  OsuClient,
  OsuSessionExpiredError,
  type OsuClientOptions,
  type Tokens,
} from "./client";
import { toOsuMatch } from "./schemas";

const credentials = { clientId: "1", clientSecret: "secret" };
const validTokens: Tokens = {
  accessToken: "token",
  refreshToken: "refresh",
  expiresAt: 4e12,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function client(
  fetch: typeof globalThis.fetch,
  options: Partial<OsuClientOptions> = {},
): OsuClient {
  return new OsuClient({
    credentials,
    redirectUri: "http://127.0.0.1:7270/callback",
    tokens: validTokens,
    fetch,
    now: () => 1000,
    minRequestIntervalMs: 0,
    ...options,
  });
}

const score = {
  id: 9,
  pp: 241.5,
  accuracy: 0.9842,
  rank: "S",
  mods: ["HD", "DT"],
  ended_at: "2026-10-31T01:29:08Z",
  weight: { percentage: 95, pp: 229.4 },
  beatmap: { id: 2, version: "Hard", difficulty_rating: 5.91 },
  beatmapset: { id: 3, title: "Million Smile", artist: "Kano" },
};

describe("OsuClient", () => {
  it("builds the authorization address", () => {
    const url = new URL(client(vi.fn()).authorizeUrl("xyz"));

    expect(url.origin + url.pathname).toBe(
      "https://osu.ppy.sh/oauth/authorize",
    );
    expect(url.searchParams.get("state")).toBe("xyz");
    expect(url.searchParams.get("scope")).toBe("public identify");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:7270/callback",
    );
  });

  it("exchanges a code and reports the tokens", async () => {
    const fetch = vi.fn(async () =>
      json({ access_token: "a", refresh_token: "r", expires_in: 86400 }),
    );
    const onTokens = vi.fn();

    await client(fetch, { tokens: null, onTokens }).exchangeCode("code");

    expect(onTokens).toHaveBeenCalledWith({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 1000 + 86400000,
    });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      grant_type: "authorization_code",
      code: "code",
      client_secret: "secret",
    });
  });

  it("reads top scores in a simple form", async () => {
    const fetch = vi.fn(async () => json([score]));
    const [top] = await client(fetch).getTopScores(5, "taiko");

    expect(top).toMatchObject({
      scoreId: 9,
      beatmapId: 2,
      beatmapsetId: 3,
      title: "Million Smile",
      mods: "HDDT",
      pp: 241.5,
      weightPercent: 95,
    });
    expect(top?.accuracy).toBeCloseTo(98.42);
    expect(top?.playedAt).toBe(Date.parse("2026-10-31T01:29:08Z"));

    const [url] = fetch.mock.calls[0] as unknown as [string];
    expect(url).toContain("/users/5/scores/best?mode=taiko&limit=100");
  });

  it("understands mods as objects and hides Classic", async () => {
    const mods = [{ acronym: "HD" }, { acronym: "CL" }];
    const [top] = await client(
      vi.fn(async () => json([{ ...score, mods }])),
    ).getTopScores(5, "osu");
    expect(top?.mods).toBe("HD");
  });

  it("searches maps in a mode and a difficulty range", async () => {
    const fetch = vi.fn(async () =>
      json({
        cursor_string: "next",
        beatmapsets: [
          {
            id: 3,
            title: "Song",
            artist: "Artist",
            creator: "Mapper",
            beatmaps: [
              {
                id: 1,
                checksum: "a",
                mode: "osu",
                version: "Hard",
                difficulty_rating: 5,
                ar: 9,
                bpm: 180,
                total_length: 90,
                playcount: 1000,
              },
              {
                id: 2,
                checksum: "b",
                mode: "osu",
                version: "Easy",
                difficulty_rating: 2,
                ar: 4,
                bpm: 180,
                total_length: 90,
              },
              {
                id: 4,
                checksum: "c",
                mode: "taiko",
                version: "Oni",
                difficulty_rating: 5,
                ar: 9,
                bpm: 180,
                total_length: 90,
              },
            ],
          },
        ],
      }),
    );

    const { maps, cursor } = await client(fetch).searchMaps("osu", 4, 6, "abc");

    expect(cursor).toBe("next");
    expect(maps).toMatchObject([
      { beatmapId: 1, title: "Song", mapper: "Mapper", playCount: 1000 },
    ]);
    const [url] = fetch.mock.calls[0] as unknown as [string];
    const query = new URL(url).searchParams;
    expect(query.get("m")).toBe("0");
    expect(query.get("s")).toBe("ranked");
    expect(query.get("q")).toBe("stars>=4.00 stars<=6.00");
    expect(query.get("cursor_string")).toBe("abc");
  });

  it("asks for the difficulty with mods", async () => {
    const fetch = vi.fn(async () =>
      json({ attributes: { star_rating: 6.57 } }),
    );

    await expect(
      client(fetch).getStarsWithMods(7, "HDDT", "osu"),
    ).resolves.toBe(6.57);

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/beatmaps/7/attributes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      mods: ["HD", "DT"],
      ruleset: "osu",
    });
  });

  it("adds a text to the search", async () => {
    const fetch = vi.fn(async () => json({ beatmapsets: [] }));
    await client(fetch).searchMaps("osu", 4, 6, null, "camellia");

    const [url] = fetch.mock.calls[0] as unknown as [string];
    expect(new URL(url).searchParams.get("q")).toBe(
      "camellia stars>=4.00 stars<=6.00",
    );
  });

  it("downloads the raw file of a map", async () => {
    const fetch = vi.fn(async () => new Response("osu file format v14"));

    const file = await client(fetch).fetchMapFile(7);

    expect(file.toString()).toBe("osu file format v14");
    const [url] = fetch.mock.calls[0] as unknown as [string];
    expect(url).toBe("https://osu.ppy.sh/osu/7");
  });

  it("renews an expired token before asking", async () => {
    const tokens = { ...validTokens, expiresAt: 1000 };
    const fetch = vi.fn(async (url: string) =>
      url.includes("oauth/token")
        ? json({ access_token: "new", refresh_token: "r2", expires_in: 100 })
        : json({ id: 1, username: "player", playmode: "osu" }),
    ) as unknown as typeof globalThis.fetch;

    await client(fetch, { tokens }).getMe();

    const calls = vi.mocked(fetch).mock.calls;
    expect(String(calls[0]?.[0])).toContain("oauth/token");
    expect(calls[1]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer new",
    });
  });

  it("renews once when the API refuses the token", async () => {
    let first = true;
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("oauth/token")) {
        return json({
          access_token: "new",
          refresh_token: "r2",
          expires_in: 100,
        });
      }
      if (first) {
        first = false;
        return json({}, 401);
      }
      return json({ id: 1, username: "player", playmode: "osu" });
    }) as unknown as typeof globalThis.fetch;

    await expect(client(fetch).getMe()).resolves.toMatchObject({
      username: "player",
    });
  });

  it("reports a session that can no longer be renewed", async () => {
    const tokens = { ...validTokens, expiresAt: 1000 };
    const fetch = vi.fn(async (url: string) =>
      url.includes("oauth/token")
        ? json({ error: "invalid_grant" }, 400)
        : json({}),
    ) as unknown as typeof globalThis.fetch;
    const onSessionExpired = vi.fn();
    const api = client(fetch, { tokens, onSessionExpired });

    await expect(api.getMe()).rejects.toBeInstanceOf(OsuSessionExpiredError);
    expect(onSessionExpired).toHaveBeenCalledOnce();
    // Nothing else is sent with tokens known to be refused.
    await expect(api.getMe()).rejects.toBeInstanceOf(OsuSessionExpiredError);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("keeps the session when the renewal fails for another reason", async () => {
    const tokens = { ...validTokens, expiresAt: 1000 };
    const fetch = vi.fn(async () =>
      json({}, 503),
    ) as unknown as typeof globalThis.fetch;
    const onSessionExpired = vi.fn();

    await expect(
      client(fetch, { tokens, onSessionExpired }).getMe(),
    ).rejects.not.toBeInstanceOf(OsuSessionExpiredError);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("reads every game of a match, in both score formats", async () => {
    const game = (id: number, score: object) => ({
      id: id * 10,
      game: {
        id,
        beatmap_id: 100 + id,
        start_time: "2026-11-14T13:21:08Z",
        mode: "taiko",
        mods: ["NF"],
        scoring_type: "scorev2",
        beatmap: {
          version: "Futsuu",
          beatmapset: { title: `Map ${id}`, artist: "A" },
        },
        scores: [score],
      },
    });
    const pages = [
      {
        match: {
          id: 7,
          name: "BTT10: (A) vs. (B)",
          start_time: "2026-11-14T12:52:33Z",
        },
        events: [
          { id: 1, detail: { type: "match-created" }, user_id: null },
          game(1, {
            user_id: 2,
            accuracy: 0.987,
            max_combo: 490,
            score: 936538,
            mods: ["HR"],
            passed: true,
            statistics: { count_300: 722, count_100: 3, count_miss: 8 },
          }),
        ],
        users: [{ id: 2, username: "TomadouSora" }],
        latest_event_id: 20,
      },
      {
        match: {
          id: 7,
          name: "BTT10: (A) vs. (B)",
          start_time: "2026-11-14T12:52:33Z",
        },
        events: [
          game(2, {
            user_id: 3,
            accuracy: 0.9877,
            max_combo: 381,
            legacy_total_score: 924875,
            total_score: 800000,
            mods: [{ acronym: "HD" }],
            statistics: { great: 718, ok: 12, miss: 3 },
          }),
        ],
        users: [{ id: 3, username: "yohanness" }],
        latest_event_id: 20,
      },
      {
        match: { id: 7, name: "x", start_time: "2026-11-14T12:52:33Z" },
        events: [],
        users: [],
      },
    ];
    let call = 0;
    const fetch = vi.fn(async () =>
      json(pages[call++]),
    ) as unknown as typeof globalThis.fetch;

    const match = await client(fetch).getMatch(7);

    expect(match.name).toBe("BTT10: (A) vs. (B)");
    expect(match.games.map((played) => played.title)).toEqual([
      "Map 1",
      "Map 2",
    ]);
    expect(match.games[0]!.scores[0]).toMatchObject({
      username: "TomadouSora",
      score: 936538,
      n300: 722,
      misses: 8,
      mods: "NFHR",
    });
    expect(match.games[1]!.scores[0]).toMatchObject({
      username: "yohanness",
      score: 924875,
      n100: 12,
      misses: 3,
      mods: "NFHD",
    });
    expect(match.games[1]!.scores[0]!.accuracy).toBeCloseTo(98.77);
    expect(match.games.map(({ warmup }) => warmup)).toEqual([false, false]);
  });

  it("reads one map for the catalog, with its status", async () => {
    const fetch = vi.fn(async () =>
      json({
        id: 776951,
        checksum: "abc",
        mode: "osu",
        status: "ranked",
        version: "The World",
        difficulty_rating: 6.52,
        ar: 9,
        bpm: 180,
        total_length: 172,
        playcount: 1000,
        beatmapset: {
          id: 5,
          title: "Night of Knights",
          artist: "beatMARIO",
          creator: "Mapper",
        },
      }),
    ) as unknown as typeof globalThis.fetch;

    const { map, status } = await client(fetch).getCatalogMap(776951);

    expect(status).toBe("ranked");
    expect(map).toMatchObject({
      beatmapId: 776951,
      beatmapsetId: 5,
      checksum: "abc",
      stars: 6.52,
      lengthSeconds: 172,
    });
  });

  it("reads whether the account is a supporter", async () => {
    const me = {
      id: 1,
      username: "player",
      playmode: "osu",
      is_supporter: true,
    };
    await expect(
      client(vi.fn(async () => json(me))).getMe(),
    ).resolves.toMatchObject({
      is_supporter: true,
    });
  });

  it("reports API errors and keeps working after them", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(
        json({ id: 1, username: "player", playmode: "osu" }),
      );
    const api = client(fetch);

    await expect(api.getMe()).rejects.toBeInstanceOf(OsuApiError);
    await expect(api.getMe()).resolves.toMatchObject({ id: 1 });
  });

  it("sends requests one at a time, spaced out", async () => {
    const order: string[] = [];
    const fetch = vi.fn(async (url: string) => {
      order.push(url);
      return json({ id: 1, username: "player", playmode: "osu" });
    }) as unknown as typeof globalThis.fetch;
    const api = client(fetch, { now: Date.now, minRequestIntervalMs: 20 });

    const started = Date.now();
    await Promise.all([api.getMe(), api.getMe(), api.getMe()]);

    expect(order).toHaveLength(3);
    expect(Date.now() - started).toBeGreaterThanOrEqual(35);
  });
});

describe("toOsuMatch", () => {
  const game = (id: number, scoringType: string) => ({
    id,
    game: {
      id,
      beatmap_id: id,
      start_time: "2026-11-14T13:00:00Z",
      mode: "taiko",
      mods: [],
      scoring_type: scoringType,
      scores: [],
    },
  });

  it("marks the warm-up maps played before the match with another scoring", () => {
    const match = toOsuMatch([
      {
        match: { id: 1, name: "x", start_time: "2026-11-14T13:00:00Z" },
        events: [
          game(1, "score"),
          game(2, "score"),
          game(3, "scorev2"),
          game(4, "scorev2"),
          game(5, "scorev2"),
        ],
        users: [],
      },
    ]);
    expect(match.games.map(({ warmup }) => warmup)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});

describe("errorOf", () => {
  it("tells osu!'s firewall page apart from the API's own refusals", () => {
    const blocked = errorOf(
      new Response(
        "<!DOCTYPE html><title>Attention Required! | Cloudflare</title>",
        {
          status: 403,
          headers: { "content-type": "text/html; charset=UTF-8" },
        },
      ),
    );
    expect(blocked).toBeInstanceOf(OsuBlockedError);
    expect(blocked.message).toMatch(/bloque/);

    const refused = errorOf(
      new Response('{"error":"forbidden"}', {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    expect(refused).not.toBeInstanceOf(OsuBlockedError);
    expect(refused.status).toBe(403);
  });
});
