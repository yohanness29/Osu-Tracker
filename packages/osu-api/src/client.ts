import type { z } from "zod";
import {
  attributesSchema,
  beatmapSchema,
  catalogBeatmapSchema,
  meSchema,
  scoresSchema,
  searchModeNumber,
  searchSchema,
  tokenSchema,
  toCatalogMaps,
  toTopScore,
  type CatalogMap,
  type MapTexts,
  type TopScore,
} from "./schemas";

const SITE_URL = "https://osu.ppy.sh";
const API_URL = `${SITE_URL}/api/v2`;
const SCOPES = "public identify";
const TOP_SCORES_LIMIT = 100;
// The API asks for about one request per second.
const MIN_REQUEST_INTERVAL_MS = 1000;
// Tokens are renewed slightly early so that a request never starts with one about to expire.
const TOKEN_MARGIN_MS = 60000;

export type Credentials = { clientId: string; clientSecret: string };
export type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export class OsuApiError extends Error {
  constructor(readonly status: number) {
    super(`The osu! API answered ${status}`);
  }
}

/**
 * The session can no longer be renewed: osu! revokes a refresh token once used, or when the
 * player removes the access. Only a new login gives one back.
 */
export class OsuSessionExpiredError extends OsuApiError {
  constructor(status: number) {
    super(status);
    this.message =
      "Ta connexion osu! a expiré : reconnecte-toi depuis ton profil.";
  }
}

export type OsuClientOptions = {
  credentials: Credentials;
  redirectUri: string;
  tokens?: Tokens | null;
  onTokens?: (tokens: Tokens) => void;
  /** The tokens are no longer accepted: they are dropped before the error is thrown. */
  onSessionExpired?: () => void;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  minRequestIntervalMs?: number;
};

export class OsuClient {
  private readonly fetch: typeof globalThis.fetch;
  private readonly now: () => number;
  private readonly minRequestIntervalMs: number;
  private tokens: Tokens | null;
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly options: OsuClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? Date.now;
    this.minRequestIntervalMs =
      options.minRequestIntervalMs ?? MIN_REQUEST_INTERVAL_MS;
    this.tokens = options.tokens ?? null;
  }

  authorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.options.credentials.clientId,
      redirect_uri: this.options.redirectUri,
      response_type: "code",
      scope: SCOPES,
      state,
    });
    return `${SITE_URL}/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<void> {
    await this.requestTokens({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.options.redirectUri,
    });
  }

  async getMe(): Promise<z.infer<typeof meSchema>> {
    return meSchema.parse(await this.get("/me"));
  }

  async getTopScores(userId: number, mode: string): Promise<TopScore[]> {
    const params = new URLSearchParams({
      mode,
      limit: String(TOP_SCORES_LIMIT),
    });
    const scores = scoresSchema.parse(
      await this.get(`/users/${userId}/scores/best?${params}`),
    );
    return scores.map(toTopScore);
  }

  /** The API gives scores the difficulty without mods: this one includes them. */
  async getStarsWithMods(
    beatmapId: number,
    mods: string,
    mode: string,
  ): Promise<number> {
    const body = { mods: mods.match(/.{2}/g) ?? [], ruleset: mode };
    const result = await this.post(`/beatmaps/${beatmapId}/attributes`, body);
    return attributesSchema.parse(result).attributes.star_rating;
  }

  async getMapTexts(beatmapId: number): Promise<MapTexts> {
    const { id, version, beatmapset } = beatmapSchema.parse(
      await this.get(`/beatmaps/${beatmapId}`),
    );
    return {
      beatmapId: id,
      title: beatmapset.title,
      artist: beatmapset.artist,
      version,
      mapper: beatmapset.creator,
    };
  }

  /** One difficulty, with its status: only ranked and approved maps give pp. */
  async getCatalogMap(
    beatmapId: number,
  ): Promise<{ map: CatalogMap; status: string }> {
    const map = catalogBeatmapSchema.parse(
      await this.get(`/beatmaps/${beatmapId}`),
    );
    if (!map.checksum) throw new OsuApiError(404);

    return {
      status: map.status,
      map: {
        beatmapId: map.id,
        beatmapsetId: map.beatmapset.id,
        checksum: map.checksum,
        mode: map.mode,
        title: map.beatmapset.title,
        artist: map.beatmapset.artist,
        mapper: map.beatmapset.creator,
        version: map.version,
        stars: map.difficulty_rating,
        ar: map.ar,
        bpm: map.bpm,
        lengthSeconds: map.total_length,
        playCount: map.playcount ?? 0,
      },
    };
  }

  /** Ranked maps of a difficulty range, most played first. */
  async searchMaps(
    mode: string,
    minStars: number,
    maxStars: number,
    cursor: string | null,
    text = "",
  ): Promise<{ maps: CatalogMap[]; cursor: string | null }> {
    const params = new URLSearchParams({
      m: String(searchModeNumber(mode)),
      s: "ranked",
      sort: "plays_desc",
      q: `${text} stars>=${minStars.toFixed(2)} stars<=${maxStars.toFixed(2)}`.trim(),
    });
    if (cursor) params.set("cursor_string", cursor);

    const result = searchSchema.parse(
      await this.get(`/beatmapsets/search?${params}`),
    );
    return {
      maps: toCatalogMaps(result, mode, minStars, maxStars),
      cursor: result.cursor_string ?? null,
    };
  }

  /** The .osu file of a map, as raw bytes so that its checksum can be verified. */
  fetchMapFile(beatmapId: number): Promise<Buffer> {
    const request = this.queue.then(async () => {
      await this.waitForTurn();
      const response = await this.fetch(`${SITE_URL}/osu/${beatmapId}`);
      if (!response.ok) throw new OsuApiError(response.status);
      return Buffer.from(await response.arrayBuffer());
    });
    this.queue = request.catch(() => undefined);
    return request;
  }

  private async requestTokens(grant: Record<string, string>): Promise<void> {
    const { clientId, clientSecret } = this.options.credentials;
    const response = await this.fetch(`${SITE_URL}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        ...grant,
      }),
    });
    if (!response.ok) throw new OsuApiError(response.status);

    const token = tokenSchema.parse(await response.json());
    this.tokens = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: this.now() + token.expires_in * 1000,
    };
    this.options.onTokens?.(this.tokens);
  }

  private async refreshTokens(): Promise<void> {
    if (!this.tokens) throw new OsuSessionExpiredError(401);
    try {
      await this.requestTokens({
        grant_type: "refresh_token",
        refresh_token: this.tokens.refreshToken,
      });
    } catch (error) {
      // osu! answers 400 or 401 to a refresh token it no longer knows.
      if (
        !(error instanceof OsuApiError) ||
        (error.status !== 400 && error.status !== 401)
      ) {
        throw error;
      }
      this.tokens = null;
      this.options.onSessionExpired?.();
      throw new OsuSessionExpiredError(error.status);
    }
  }

  private get(path: string): Promise<unknown> {
    return this.enqueue(path);
  }

  private post(path: string, body: unknown): Promise<unknown> {
    return this.enqueue(path, JSON.stringify(body));
  }

  private enqueue(path: string, body?: string): Promise<unknown> {
    const request = this.queue.then(() => this.send(path, body));
    this.queue = request.catch(() => undefined);
    return request;
  }

  private async waitForTurn(): Promise<void> {
    const wait = this.lastRequestAt + this.minRequestIntervalMs - this.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = this.now();
  }

  private async send(
    path: string,
    body?: string,
    retried = false,
  ): Promise<unknown> {
    if (!this.tokens) throw new OsuSessionExpiredError(401);
    if (this.tokens.expiresAt - TOKEN_MARGIN_MS <= this.now())
      await this.refreshTokens();

    await this.waitForTurn();
    const response = await this.fetch(`${API_URL}${path}`, {
      method: body ? "POST" : "GET",
      body,
      headers: {
        Authorization: `Bearer ${this.tokens!.accessToken}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
    });

    if (response.status === 401 && !retried) {
      await this.refreshTokens();
      return this.send(path, body, true);
    }
    if (!response.ok) throw new OsuApiError(response.status);

    return response.json();
  }
}
