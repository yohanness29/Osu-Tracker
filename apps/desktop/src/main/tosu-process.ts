import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { spawn, type ChildProcess } from 'child_process'
import { createHash } from 'crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { unzipSync } from 'fflate'

const TOSU_HOST = '127.0.0.1'
const TOSU_PORT = 24050
const PROBE_TIMEOUT_MS = 1000
const LATEST_RELEASE_URL = 'https://api.github.com/repos/tosuapp/tosu/releases/latest'

/**
 * - `external`: a tosu started by the player was already there, it is left alone.
 * - `installing`: no tosu yet, the release for this system is being downloaded.
 * - `internal`: the app started its own tosu, and stops it when it closes.
 */
export type TosuLaunch =
  'pending' | 'installing' | 'external' | 'internal' | 'unsupported' | 'failed'

// The app reads tosu itself: its dashboard would open a browser page at each start,
// and an update would replace the binary while it runs.
const FORCED_SETTINGS: Record<string, string> = {
  OPEN_DASHBOARD_ON_STARTUP: 'false',
  ENABLE_AUTOUPDATE: 'false',
  SERVER_IP: TOSU_HOST,
  SERVER_PORT: String(TOSU_PORT)
}

// Names of the systems in the files of the tosu releases.
const RELEASE_SYSTEMS: Partial<Record<NodeJS.Platform, string>> = {
  linux: 'linux',
  win32: 'windows'
}

const BINARY_NAME = process.platform === 'win32' ? 'tosu.exe' : 'tosu'

let child: ChildProcess | null = null
let stopped = false

/** At the root of the project while developing, among the app data once installed. */
function installFolder(): string {
  return is.dev ? join(app.getAppPath(), '../../tosu') : join(app.getPath('userData'), 'tosu-bin')
}

async function isTosuRunning(): Promise<boolean> {
  try {
    await fetch(`http://${TOSU_HOST}:${TOSU_PORT}/`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    })
    return true
  } catch {
    return false
  }
}

type ReleaseAsset = { name: string; browser_download_url: string; digest?: string | null }

async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'User-Agent': 'osu-tracker' } })
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
  return (await response.json()) as T
}

/** Downloads the latest release for this system, checked against the digest GitHub gives. */
async function installTosu(system: string): Promise<string> {
  const release = await githubJson<{ tag_name: string; assets: ReleaseAsset[] }>(LATEST_RELEASE_URL)
  const asset = release.assets.find(({ name }) => name.startsWith(`tosu-${system}-`))
  if (!asset) throw new Error(`No tosu ${release.tag_name} for ${system}`)

  const response = await fetch(asset.browser_download_url)
  if (!response.ok) throw new Error(`Download answered ${response.status}`)
  const archive = new Uint8Array(await response.arrayBuffer())

  const expected = asset.digest?.replace(/^sha256:/, '')
  const actual = createHash('sha256').update(archive).digest('hex')
  if (expected && expected !== actual) throw new Error(`${asset.name} does not match its digest`)

  const files = unzipSync(archive, { filter: ({ name }) => name === BINARY_NAME })
  const binary = files[BINARY_NAME]
  if (!binary) throw new Error(`${asset.name} has no ${BINARY_NAME}`)

  const folder = installFolder()
  mkdirSync(folder, { recursive: true })
  const path = join(folder, BINARY_NAME)
  writeFileSync(path, binary)
  if (process.platform !== 'win32') chmodSync(path, 0o755)
  return path
}

/** Keeps what the player may have changed in it, except the settings the app needs. */
function writeSettings(path: string): void {
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/) : []
  const kept = lines.filter(
    (line) => line.trim() !== '' && !(line.split('=')[0]!.trim() in FORCED_SETTINGS)
  )
  const forced = Object.entries(FORCED_SETTINGS).map(([key, value]) => `${key}=${value}`)
  writeFileSync(path, [...forced, ...kept].join('\n') + '\n')
}

/**
 * The app gets its own tosu folder: its settings do not touch those of a tosu the player runs.
 * On Linux tosu reads `$XDG_CONFIG_HOME/tosu`. Elsewhere it reads the folder of its binary,
 * or the one it runs in, depending on how it was built.
 */
function prepareFolder(binary: string): { folder: string; configHome: string } {
  const configHome = app.getPath('userData')
  const folder = join(configHome, 'tosu')
  mkdirSync(folder, { recursive: true })
  writeSettings(join(folder, 'tosu.env'))
  if (process.platform === 'win32') writeSettings(join(dirname(binary), 'tosu.env'))
  return { folder, configHome }
}

function launch(binary: string): Promise<TosuLaunch> {
  const { folder, configHome } = prepareFolder(binary)
  const started = spawn(binary, [], {
    cwd: folder,
    env: { ...process.env, XDG_CONFIG_HOME: configHome },
    stdio: 'ignore',
    windowsHide: true
  })
  child = started
  started.once('exit', () => {
    if (child === started) child = null
  })

  return new Promise((resolve) => {
    started.once('spawn', () => resolve('internal'))
    started.once('error', (error) => {
      console.error('tosu could not be started', error)
      resolve('failed')
    })
  })
}

/** Uses a tosu already running, or starts the one of the app, installing it the first time. */
export async function startTosu(onChange: (launch: TosuLaunch) => void): Promise<void> {
  if (await isTosuRunning()) return onChange('external')

  const system = RELEASE_SYSTEMS[process.platform]
  if (!system) return onChange('unsupported')

  try {
    let binary = join(installFolder(), BINARY_NAME)
    if (!existsSync(binary)) {
      onChange('installing')
      binary = await installTosu(system)
    }
    if (stopped) return
    onChange(await launch(binary))
  } catch (error) {
    console.error('tosu could not be installed', error)
    onChange('failed')
  }
}

/** Only the tosu the app started. */
export function stopTosu(): void {
  stopped = true
  child?.kill()
  child = null
}
