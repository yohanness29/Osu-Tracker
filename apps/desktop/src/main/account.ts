import { app, BrowserWindow, safeStorage, shell } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { createServer } from 'http'
import { join } from 'path'
import { OsuClient, type Credentials, type Tokens } from '@osu-tracker/osu-api'
import type { TrackedPlay } from '@osu-tracker/shared'
import { netPpGain } from '@osu-tracker/stats'
import type { TopScoreRow, TrackerStore } from '@osu-tracker/storage'

const CALLBACK_PORT = 7270
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}/callback`
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const MODES = ['osu', 'taiko', 'fruits', 'mania']
const TOP_SCORES_MAX_AGE_MS = 10 * 60 * 1000
const REFRESH_AFTER_GAIN_MS = 60 * 1000
const TITLES_PER_SYNC = 20
const IN_GAME_RETRY_MS = 3000
const PP_GIVING_STATUSES = ['ranked', 'approved']

type AccountUser = { id: number; name: string; mode: string; supporter: boolean }
type StoredAccount = {
  credentials: Credentials
  tokens: Tokens | null
  user: AccountUser | null
}

export type AccountStatus = {
  hasCredentials: boolean
  user: AccountUser | null
  redirectUri: string
  /** Secrets are protected by the system keyring. */
  encrypted: boolean
  syncing: boolean
  error: string | null
}

let store: TrackerStore
let account: StoredAccount | null = null
let syncing = false
let lastError: string | null = null
let isInGame: () => boolean = () => false
let stopped = false
let refreshTimer: ReturnType<typeof setTimeout> | null = null

function accountPath(): string {
  return join(app.getPath('userData'), 'osu-account.json')
}

function saveAccount(): void {
  if (!account) {
    rmSync(accountPath(), { force: true })
    return
  }

  const encrypted = safeStorage.isEncryptionAvailable()
  const json = JSON.stringify(account)
  const data = encrypted
    ? safeStorage.encryptString(json).toString('base64')
    : Buffer.from(json).toString('base64')
  writeFileSync(accountPath(), JSON.stringify({ encrypted, data }), { mode: 0o600 })
}

function loadAccount(): StoredAccount | null {
  if (!existsSync(accountPath())) return null

  try {
    const { encrypted, data } = JSON.parse(readFileSync(accountPath(), 'utf8'))
    const bytes = Buffer.from(data, 'base64')
    return JSON.parse(encrypted ? safeStorage.decryptString(bytes) : bytes.toString('utf8'))
  } catch {
    return null
  }
}

function publish(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('account:status', getAccountStatus())
  }
}

function fail(error: unknown): void {
  lastError = error instanceof Error ? error.message : String(error)
  publish()
}

function createClient({ credentials, tokens }: StoredAccount): OsuClient {
  return new OsuClient({
    credentials,
    tokens,
    redirectUri: REDIRECT_URI,
    onTokens: (next) => {
      if (!account) return
      account.tokens = next
      saveAccount()
    },
    // The profile then offers to log in again: the app id and secret are kept.
    onSessionExpired: () => {
      if (!account) return
      account.tokens = null
      account.user = null
      saveAccount()
      publish()
    }
  })
}

export function getAccountStatus(): AccountStatus {
  return {
    hasCredentials: account !== null,
    user: account?.user ?? null,
    redirectUri: REDIRECT_URI,
    encrypted: safeStorage.isEncryptionAvailable(),
    syncing,
    error: lastError
  }
}

export function saveCredentials(credentials: Credentials): void {
  lastError = null
  if (!credentials.clientId.trim()) {
    account = null
    saveAccount()
    publish()
    return
  }

  account = {
    credentials: {
      clientId: credentials.clientId.trim(),
      clientSecret: credentials.clientSecret.trim()
    },
    tokens: null,
    user: null
  }
  saveAccount()
  publish()
}

/** A login given up for a newer one: it has nothing to tell the player. */
class LoginReplacedError extends Error {}

// The login waiting for osu! to send the player back: a new click replaces it.
let pendingLogin: { cancel: () => void } | null = null

function waitForCode(state: string): Promise<string> {
  pendingLogin?.cancel()

  return new Promise((resolve, reject) => {
    const finish = (): void => {
      clearTimeout(timeout)
      server.close()
      server.closeAllConnections()
      if (pendingLogin === current) pendingLogin = null
    }

    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', REDIRECT_URI)
      if (url.pathname !== '/callback') {
        response.writeHead(404).end()
        return
      }

      const code = url.searchParams.get('code')
      const denied = url.searchParams.get('error') === 'access_denied'
      // A page from an earlier click, or reloaded: only the latest login counts.
      const stale = code !== null && url.searchParams.get('state') !== state
      const valid = code !== null && !stale
      response.writeHead(valid ? 200 : 400, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end(
        valid
          ? 'Connexion réussie, tu peux revenir sur Osu!tracker.'
          : stale
            ? 'Cette page vient d’une ancienne tentative : clique de nouveau sur « Se connecter » dans Osu!tracker.'
            : 'Connexion refusée.'
      )
      if (stale) return

      finish()
      if (valid) resolve(code)
      else
        reject(
          new Error(
            denied
              ? 'Tu as refusé l’accès sur osu! : clique sur « Se connecter » pour réessayer.'
              : 'La connexion a été refusée.'
          )
        )
    })

    const timeout = setTimeout(() => {
      finish()
      reject(new Error('La connexion a pris trop de temps.'))
    }, LOGIN_TIMEOUT_MS)

    const current = {
      cancel: () => {
        finish()
        reject(new LoginReplacedError())
      }
    }
    pendingLogin = current

    server.on('error', (error) => {
      finish()
      reject(error)
    })
    server.listen(CALLBACK_PORT, '127.0.0.1')
  })
}

export async function login(): Promise<void> {
  if (!account) return

  lastError = null
  const client = createClient(account)
  const state = randomUUID()

  try {
    const code = waitForCode(state)
    await shell.openExternal(client.authorizeUrl(state))
    await client.exchangeCode(await code)

    await refreshUser(client)
    publish()
    await syncAccount(0)
  } catch (error) {
    if (!(error instanceof LoginReplacedError)) fail(error)
  }
}

export function logout(): void {
  if (!account) return

  account.tokens = null
  account.user = null
  saveAccount()
  publish()
}

async function refreshUser(client: OsuClient): Promise<void> {
  if (!account) return

  const me = await client.getMe()
  account.user = {
    id: me.id,
    name: me.username,
    mode: me.playmode,
    supporter: me.is_supporter ?? false
  }
  saveAccount()
}

function needsRefresh(mode: string, maxAgeMs: number): boolean {
  const [first] = store.topScores(mode)
  return !first || Date.now() - first.fetchedAt >= maxAgeMs
}

async function waitForBreak(): Promise<void> {
  while (isInGame() && !stopped) {
    await new Promise((resolve) => setTimeout(resolve, IN_GAME_RETRY_MS))
  }
}

async function fillModdedStars(client: OsuClient, mode: string): Promise<void> {
  for (const { scoreId, beatmapId, mods, stars } of store.scoresMissingModdedStars(mode)) {
    await waitForBreak()
    if (stopped) return

    const modded = mods ? await client.getStarsWithMods(beatmapId, mods, mode) : stars
    store.setModdedStars(mode, scoreId, modded)
  }
}

/** Top scores change rarely: recent ones are kept to stay gentle with the API. */
export async function syncAccount(maxAgeMs = TOP_SCORES_MAX_AGE_MS): Promise<void> {
  if (!account?.user || !account.tokens || syncing) return

  syncing = true
  lastError = null
  publish()

  try {
    const client = createClient(account)
    await refreshUser(client)
    const user = account.user!
    for (const mode of MODES) {
      if (!needsRefresh(mode, maxAgeMs)) continue
      store.replaceTopScores(mode, await client.getTopScores(user.id, mode), Date.now())
    }
    for (const mode of MODES) {
      await fillModdedStars(client, mode)
    }
    for (const beatmapId of store.beatmapsWithoutTitle(TITLES_PER_SYNC)) {
      store.updateMapTexts(await client.getMapTexts(beatmapId))
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error)
  } finally {
    syncing = false
    publish()
  }
}

/** Null without a connected account. */
export function osuClient(): OsuClient | null {
  return account?.user && account.tokens ? createClient(account) : null
}

export function getTopScores(mode: string): TopScoreRow[] {
  return store.topScores(mode)
}

/** Null when the profile is unknown, since nothing can be compared. */
export function recordNetGain(play: TrackedPlay): void {
  if (!PP_GIVING_STATUSES.includes(play.beatmap.status)) return

  const top = store.topScores(play.mode)
  if (top.length === 0) return

  const gain = netPpGain(top, { beatmapId: play.beatmap.id, pp: play.pp })
  store.setNetGain(play.id, gain)

  // The profile changed: later plays must be compared to it.
  if (gain > 0 && !refreshTimer) {
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      syncAccount(REFRESH_AFTER_GAIN_MS).catch(fail)
    }, REFRESH_AFTER_GAIN_MS)
  }
}

export function setupAccount(trackerStore: TrackerStore, inGame: () => boolean): void {
  store = trackerStore
  isInGame = inGame
  account = loadAccount()
  syncAccount().catch(fail)
}

export function stopAccount(): void {
  stopped = true
  if (refreshTimer) clearTimeout(refreshTimer)
}
