import { app, BrowserWindow, shell } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

const OWNER = 'yohanness29'
const REPO = 'Osu-Tracker'
const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases`
// Often enough to see a release the same day, rarely enough for GitHub's limits.
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

export type UpdateState =
  | { status: 'idle' | 'checking' | 'up-to-date' }
  | { status: 'available'; version: string; url: string; installable: boolean }
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

/** 1.10.0 is after 1.9.2: numbers compared one by one. */
export function isNewer(candidate: string, current: string): boolean {
  const parts = (version: string): number[] =>
    version
      .replace(/^v/, '')
      .split('-')[0]!
      .split('.')
      .map((part) => Number(part) || 0)
  const a = parts(candidate)
  const b = parts(current)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return false
}

/**
 * Run from the sources, the app cannot replace itself: it only reads the latest release on
 * GitHub, and the button opens its page.
 */
async function checkFromSources(): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'osu-tracker' }
  })
  // No release published yet.
  if (response.status === 404) return publish({ status: 'up-to-date' })
  if (!response.ok) throw new Error(`GitHub a répondu ${response.status}.`)
  const release = (await response.json()) as { tag_name: string; html_url: string }
  publish(
    isNewer(release.tag_name, app.getVersion())
      ? {
          status: 'available',
          version: release.tag_name.replace(/^v/, ''),
          url: release.html_url,
          installable: false
        }
      : { status: 'up-to-date' }
  )
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
  autoUpdater.on('update-available', (info) =>
    publish({
      status: 'available',
      version: info.version,
      url: `${RELEASES_URL}/tag/v${info.version}`,
      installable: true
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
