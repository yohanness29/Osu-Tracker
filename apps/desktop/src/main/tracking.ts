import { app, BrowserWindow, dialog } from 'electron'
import { is } from '@electron-toolkit/utils'
import { createWriteStream, mkdirSync, type WriteStream } from 'fs'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { TosuClient } from '@osu-tracker/collector'
import { recordNetGain, setupAccount, stopAccount } from './account'
import { addPlayedMap, setupFarming, stopFarming } from './farming'
import { setupTournaments } from './tournaments'
import { startTosu, stopTosu, type TosuLaunch } from './tosu-process'
import { analyzeMap } from '@osu-tracker/pp'
import type { GameFrame, TrackerEvent } from '@osu-tracker/shared'
import {
  TrackerStore,
  type Goal,
  type MapDetail,
  type MapResults,
  type NewGoal,
  type Playlist,
  type PlaylistMap,
  type PlaylistMapInput,
  type RecentPlay,
  type ResultCounts,
  type SessionSummary
} from '@osu-tracker/storage'
import { SESSION_TIMEOUT_MS, Tracker } from '@osu-tracker/tracker'

// Every map: the page searches and filters them.
const MAP_RESULTS_LIMIT = 10000
const ANALYSIS_PLAYS_LIMIT = 5000
const NO_RESULTS: ResultCounts = { passed: 0, failed: 0, retried: 0, quit: 0 }

export type TrackingStatus = {
  connected: boolean
  tosu: TosuLaunch
  backgroundUrl: string
  sessionId: string | null
  inPlay: boolean
  rejectedFrames: number
  sessionResults: ResultCounts
  totalResults: ResultCounts
}

const status: TrackingStatus = {
  connected: false,
  tosu: 'pending',
  backgroundUrl: '',
  sessionId: null,
  inPlay: false,
  rejectedFrames: 0,
  sessionResults: NO_RESULTS,
  totalResults: NO_RESULTS
}

let store: TrackerStore
let tracker: Tracker
let tosu: TosuClient
let capture: WriteStream | null = null
let stopped = false
let inGame = false
let analyzingPending = false
const pendingAnalyses = new Map<string, { checksum: string; mode: string; client: string }>()

export function getTrackingStatus(): TrackingStatus {
  return status
}

export function getAllPlays(): RecentPlay[] {
  return store.recentPlays(ANALYSIS_PLAYS_LIMIT)
}

export function getGoals(sessionId: string | null): Goal[] {
  return store.goals(sessionId)
}

export function addGoal(goal: NewGoal): void {
  store.addGoal(goal)
}

export function removeGoal(goalId: string): void {
  store.removeGoal(goalId)
}

export function getMaps(mode?: string): MapResults[] {
  return store.mapResults(MAP_RESULTS_LIMIT, mode)
}

export function getMapDetail(checksum: string): MapDetail | null {
  return store.mapDetail(checksum)
}

export function getSessions(): SessionSummary[] {
  return store.sessionSummaries()
}

/** A file name from the session name, or its date: no character a system would refuse. */
function exportFileName(session: SessionSummary): string {
  const date = new Date(session.startedAt).toISOString().slice(0, 10)
  const name = [...(session.name ?? `session ${date}`)]
    // Control characters are refused too.
    .map((character) => (character < ' ' || '<>:"/\\|?*'.includes(character) ? '-' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return `${name || `session ${date}`}.json`
}

/** Asks where to save it. Null when the player cancels. */
export async function exportSession(sessionId: string): Promise<string | null> {
  const exported = store.sessionExport(sessionId, Date.now())
  if (!exported) throw new Error('Cette session n’a aucune partie à exporter.')

  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const options = {
    title: 'Exporter la session',
    defaultPath: join(app.getPath('downloads'), exportFileName(exported.session)),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  }
  const { canceled, filePath } = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  if (canceled || !filePath) return null

  await writeFile(filePath, JSON.stringify(exported, null, 2), 'utf8')
  return filePath
}

export function getPlaylists(): Playlist[] {
  return store.playlists()
}

export function createPlaylist(name: string): string {
  return store.createPlaylist(name, Date.now())
}

export function renamePlaylist(playlistId: string, name: string): void {
  store.renamePlaylist(playlistId, name)
}

export function deletePlaylist(playlistId: string): void {
  store.deletePlaylist(playlistId)
}

export function getPlaylistMaps(playlistId: string): PlaylistMap[] {
  return store.playlistMaps(playlistId)
}

export function addToPlaylist(playlistId: string, map: PlaylistMapInput): void {
  store.addToPlaylist(playlistId, map, Date.now())
}

export function removeFromPlaylist(playlistId: string, checksum: string): void {
  store.removeFromPlaylist(playlistId, checksum)
}

export function getPlaylistsOfMap(checksum: string): string[] {
  return store.playlistsOfMap(checksum)
}

export function renameSession(sessionId: string, name: string): void {
  store.renameSession(sessionId, name)
}

export function getSessionPlays(sessionId: string): RecentPlay[] {
  return store.sessionPlays(sessionId)
}

function publishStatus(): void {
  status.rejectedFrames = tosu.rejectedFrameCount
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('tracking:status', status)
  }
}

function migrationsFolder(): string {
  return is.dev
    ? join(app.getAppPath(), '../../packages/storage/drizzle')
    : join(process.resourcesPath, 'migrations')
}

function refreshResults(): void {
  status.sessionResults = status.sessionId ? store.resultCounts(status.sessionId) : NO_RESULTS
  status.totalResults = store.resultCounts()
}

// Runs beside the tracking: a failure only leaves this value unknown.
async function cacheMapAnalysis(checksum: string, mode: string, client: string): Promise<void> {
  if (store.hasMapAnalysis(checksum, mode)) return

  const content = await tosu.fetchBeatmapFile(checksum)
  if (!content) return

  const { maxPp, ...style } = await analyzeMap({ content, mode, lazer: client === 'lazer' })
  if (stopped) return

  store.saveMapAnalysis(checksum, mode, maxPp, style)
  refreshResults()
  publishStatus()
}

// Analyses wait for the end of the map: nothing heavy may run during a play.
async function runPendingAnalyses(): Promise<void> {
  if (analyzingPending) return

  analyzingPending = true
  for (const [key, { checksum, mode, client }] of pendingAnalyses) {
    if (inGame || stopped) break

    pendingAnalyses.delete(key)
    await cacheMapAnalysis(checksum, mode, client).catch(console.error)
  }
  analyzingPending = false
}

function applyEvents(events: TrackerEvent[]): void {
  if (events.length === 0) return

  for (const event of events) {
    store.apply(event)
    if (event.type === 'play-finished' && event.play.result === 'passed') {
      recordNetGain(event.play)
    }
    if (event.type === 'play-finished') {
      addPlayedMap(event.play.beatmap.id, event.play.mode, event.play.mods)
    }
    if (event.type === 'session-started') status.sessionId = event.sessionId
    if (event.type === 'session-ended') status.sessionId = null
    if (event.type === 'play-started') {
      status.inPlay = true
      pendingAnalyses.set(`${event.beatmapChecksum}-${event.mode}`, {
        checksum: event.beatmapChecksum,
        mode: event.mode,
        client: event.client
      })
    }
    if (event.type === 'play-finished' || event.type === 'play-discarded') status.inPlay = false
  }

  refreshResults()
  publishStatus()
}

function handleFrame(frame: GameFrame): void {
  inGame = frame.state === 'play'
  applyEvents(tracker.feed(frame))
  if (!inGame && pendingAnalyses.size > 0) runPendingAnalyses().catch(console.error)
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('tracking:frame', frame)
  }
}

function handleConnectionChange(connected: boolean): void {
  status.connected = connected
  if (!connected) inGame = false
  if (!connected) applyEvents(tracker.disconnect(Date.now()))
  publishStatus()
}

// Raw captures weigh about 700 MB per hour: only for producing new fixtures.
function createRawCapture(): ((raw: string, receivedAt: number) => void) | undefined {
  if (!process.env['OSU_TRACKER_CAPTURE']) return undefined

  const directory = is.dev
    ? join(app.getAppPath(), '../../fixtures')
    : join(app.getPath('userData'), 'captures')
  mkdirSync(directory, { recursive: true })
  const fileName = `capture-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`
  capture = createWriteStream(join(directory, fileName))

  return (message, receivedAt) => {
    capture?.write(`${JSON.stringify({ receivedAt, message })}\n`)
  }
}

export function startTracking(): void {
  store = new TrackerStore({
    databasePath: join(app.getPath('userData'), 'osu-tracker.sqlite'),
    migrationsFolder: migrationsFolder()
  })
  store.closeInterruptedSessions()
  store.mergeContiguousSessions(SESSION_TIMEOUT_MS)
  const resumedSession = store.resumeSession(Date.now(), SESSION_TIMEOUT_MS) ?? undefined
  status.sessionId = resumedSession?.id ?? null
  refreshResults()

  tracker = new Tracker({ resumedSession })
  tosu = new TosuClient({
    onFrame: handleFrame,
    onConnectionChange: handleConnectionChange,
    onRawMessage: createRawCapture()
  })
  setupAccount(store, () => inGame)
  setupFarming(store, () => inGame)
  setupTournaments(store, () => inGame)
  status.backgroundUrl = tosu.backgroundUrl
  tosu.start()
  startTosu((launch) => {
    status.tosu = launch
    publishStatus()
  }).catch(console.error)
}

export function stopTracking(): void {
  stopped = true
  stopAccount()
  stopFarming()
  tosu.stop()
  stopTosu()
  applyEvents(tracker.stop(Date.now()))
  capture?.end()
  store.close()
}
