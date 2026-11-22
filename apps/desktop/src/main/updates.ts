import { app, BrowserWindow, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { isBeta, isNewer } from './versions'

const { autoUpdater } = electronUpdater

const OWNER = 'yohanness29'
const REPO = 'Osu-Tracker'
const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases`
// Often enough to see a release the same day, rarely enough for GitHub's limits.
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

export type UpdateState =
  | { status: 'idle' | 'checking' | 'up-to-date' }
  | { status: 'available'; version: string; url: string; installable: boolean; beta: boolean }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string }

let state: UpdateState = { status: 'idle' }

function publish(next: UpdateState): void {
  state = next
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('updates:state', state)
  }
}

export function getUpdateState(): UpdateState {
  return state
}

/** Whether the player also gets the betas, published as pre-releases on GitHub. */
type UpdateSettings = { beta: boolean }

function settingsFile(): string {
  return join(app.getPath('userData'), 'updates.json')
}

function readSettings(): UpdateSettings {
  try {
    if (existsSync(settingsFile())) {
      const saved = JSON.parse(readFileSync(settingsFile(), 'utf8')) as Partial<UpdateSettings>
      return { beta: saved.beta === true }
    }
  } catch (error) {
    console.error('Réglages des mises à jour illisibles :', error)
  }
  return { beta: false }
}

let settings: UpdateSettings | null = null

export function getBetaUpdates(): boolean {
  settings ??= readSettings()
  return settings.beta
}

/**
 * Leaving the betas does not go back to an older stable version: its database may not read the
 * data of the beta. The player stays on the beta until a newer stable version is out.
 */
export async function setBetaUpdates(beta: boolean): Promise<void> {
  settings = { beta }
  writeFileSync(settingsFile(), JSON.stringify(settings))
  autoUpdater.allowPrerelease = beta
  if (state.status === 'downloading' || state.status === 'ready') return
  await checkForUpdates()
}

/**
 * Run from the sources, the app cannot replace itself: it only reads the latest release on
 * GitHub, and the button opens its page.
 */
async function checkFromSources(): Promise<void> {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'osu-tracker' }
  const base = `https://api.github.com/repos/${OWNER}/${REPO}/releases`
  // The latest release leaves out the pre-releases: with the betas, the newest of the list.
  const response = await fetch(getBetaUpdates() ? `${base}?per_page=10` : `${base}/latest`, {
    headers
  })
  // No release published yet.
  if (response.status === 404) return publish({ status: 'up-to-date' })
  if (!response.ok) throw new Error(`GitHub a répondu ${response.status}.`)
  type Release = { tag_name: string; html_url: string; draft?: boolean }
  const body = (await response.json()) as Release | Release[]
  const release = Array.isArray(body) ? body.find(({ draft }) => !draft) : body
  if (!release || !isNewer(release.tag_name, app.getVersion())) {
    return publish({ status: 'up-to-date' })
  }
  const version = release.tag_name.replace(/^v/, '')
  publish({
    status: 'available',
    version,
    url: release.html_url,
    installable: false,
    beta: isBeta(version)
  })
}

export async function checkForUpdates(): Promise<void> {
  if (state.status === 'downloading' || state.status === 'ready') return
  publish({ status: 'checking' })
  try {
    if (app.isPackaged) await autoUpdater.checkForUpdates()
    else await checkFromSources()
  } catch (error) {
    publish({ status: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

/** Downloads the new version, or opens its page when the app runs from the sources. */
export async function downloadUpdate(): Promise<void> {
  if (state.status !== 'available') return
  if (!state.installable) {
    await shell.openExternal(state.url)
    return
  }
  publish({ status: 'downloading', version: state.version, percent: 0 })
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    publish({ status: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

export function installUpdate(): void {
  if (state.status === 'ready') autoUpdater.quitAndInstall()
}

export function setupUpdates(): void {
  // The player chooses when to download and restart.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  // Set in both directions: electron-updater turns the betas on by itself on a beta version.
  autoUpdater.allowPrerelease = getBetaUpdates()
  autoUpdater.allowDowngrade = false
  autoUpdater.on('update-available', (info) =>
    publish({
      status: 'available',
      version: info.version,
      url: `${RELEASES_URL}/tag/v${info.version}`,
      installable: true,
      beta: isBeta(info.version)
    })
  )
  autoUpdater.on('update-not-available', () => publish({ status: 'up-to-date' }))
  autoUpdater.on('download-progress', (progress) => {
    if (state.status === 'downloading') {
      publish({ ...state, percent: Math.round(progress.percent) })
    }
  })
  autoUpdater.on('update-downloaded', (info) => publish({ status: 'ready', version: info.version }))
  autoUpdater.on('error', (error) => publish({ status: 'error', message: error.message }))

  void checkForUpdates()
  setInterval(() => void checkForUpdates(), CHECK_EVERY_MS)
}
