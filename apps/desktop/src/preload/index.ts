import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { GameFrame } from '@osu-tracker/shared'
import type {
  Goal,
  MapDetail,
  MapResults,
  NewGoal,
  Playlist,
  PlaylistMap,
  PlaylistMapInput,
  Tournament,
  TournamentUpdate,
  RecentPlay,
  SessionSummary,
  TopScoreRow
} from '@osu-tracker/storage'
import type { Credentials } from '@osu-tracker/osu-api'
import type { SearchFilters } from '@osu-tracker/recommender'
import type { AccountStatus } from '../main/account'
import type { FarmingStatus, FarmSuggestion, ImportedMap } from '../main/farming'
import type { TrackingStatus } from '../main/tracking'
import type { UpdateState } from '../main/updates'
import type { ImportProgress, MatchImport, PoolImport, TournamentData } from '../main/tournaments'

// Custom APIs for renderer
const api = {
  getStatus: (): Promise<TrackingStatus> => ipcRenderer.invoke('tracking:get-status'),
  copyText: (text: string): Promise<void> => ipcRenderer.invoke('app:copy-text', text),
  getAppInfo: (): Promise<{ version: string; dataFolder: string }> =>
    ipcRenderer.invoke('app:get-info'),
  openDataFolder: (): Promise<void> => ipcRenderer.invoke('app:open-data-folder'),
  getUpdateState: (): Promise<UpdateState> => ipcRenderer.invoke('updates:get'),
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('updates:check'),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('updates:download'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('updates:install'),
  getBetaUpdates: (): Promise<boolean> => ipcRenderer.invoke('updates:get-beta'),
  setBetaUpdates: (beta: boolean): Promise<void> => ipcRenderer.invoke('updates:set-beta', beta),
  onUpdateState: (listener: (state: UpdateState) => void): (() => void) => {
    const handler = (_: unknown, state: UpdateState): void => listener(state)
    ipcRenderer.on('updates:state', handler)
    return () => ipcRenderer.removeListener('updates:state', handler)
  },
  getFarmingStatus: (): Promise<FarmingStatus> => ipcRenderer.invoke('farming:get-status'),
  getPlayerStars: (mode: string): Promise<[number, number] | null> =>
    ipcRenderer.invoke('farming:get-player-stars', mode),
  importMap: (beatmapId: number, mods: string[], accuracy: number | null): Promise<ImportedMap> =>
    ipcRenderer.invoke('farming:import', beatmapId, mods, accuracy),
  onFarmingStatus: (listener: (status: FarmingStatus) => void): (() => void) => {
    const handler = (_: unknown, status: FarmingStatus): void => listener(status)
    ipcRenderer.on('farming:status', handler)
    return () => ipcRenderer.removeListener('farming:status', handler)
  },
  refreshCatalog: (
    mode: string,
    mods: string[],
    text: string,
    filters: SearchFilters
  ): Promise<void> => ipcRenderer.invoke('farming:refresh', mode, mods, text, filters),
  getSuggestions: (
    mode: string,
    accuracy: number | null,
    mods: string[]
  ): Promise<FarmSuggestion[]> =>
    ipcRenderer.invoke('farming:get-suggestions', mode, accuracy, mods),
  getAccount: (): Promise<AccountStatus> => ipcRenderer.invoke('account:get-status'),
  onAccount: (listener: (status: AccountStatus) => void): (() => void) => {
    const handler = (_: unknown, status: AccountStatus): void => listener(status)
    ipcRenderer.on('account:status', handler)
    return () => ipcRenderer.removeListener('account:status', handler)
  },
  saveCredentials: (credentials: Credentials): Promise<void> =>
    ipcRenderer.invoke('account:save-credentials', credentials),
  login: (): Promise<void> => ipcRenderer.invoke('account:login'),
  logout: (): Promise<void> => ipcRenderer.invoke('account:logout'),
  refreshAccount: (): Promise<void> => ipcRenderer.invoke('account:refresh'),
  getTopScores: (mode: string): Promise<TopScoreRow[]> =>
    ipcRenderer.invoke('account:get-top-scores', mode),
  renameSession: (sessionId: string, name: string): Promise<void> =>
    ipcRenderer.invoke('tracking:rename-session', sessionId, name),
  getAllPlays: (): Promise<RecentPlay[]> => ipcRenderer.invoke('tracking:get-all-plays'),
  getGoals: (sessionId: string | null): Promise<Goal[]> =>
    ipcRenderer.invoke('tracking:get-goals', sessionId),
  addGoal: (goal: NewGoal): Promise<void> => ipcRenderer.invoke('tracking:add-goal', goal),
  removeGoal: (goalId: string): Promise<void> => ipcRenderer.invoke('tracking:remove-goal', goalId),
  getMaps: (mode?: string): Promise<MapResults[]> => ipcRenderer.invoke('tracking:get-maps', mode),
  getMap: (checksum: string): Promise<MapDetail | null> =>
    ipcRenderer.invoke('tracking:get-map', checksum),
  getSessions: (): Promise<SessionSummary[]> => ipcRenderer.invoke('tracking:get-sessions'),
  exportSession: (sessionId: string): Promise<string | null> =>
    ipcRenderer.invoke('tracking:export-session', sessionId),
  getTournaments: (): Promise<Tournament[]> => ipcRenderer.invoke('tournaments:get-all'),
  getTournament: (tournamentId: string): Promise<TournamentData | null> =>
    ipcRenderer.invoke('tournaments:get', tournamentId),
  createTournament: (name: string, mode: string): Promise<string> =>
    ipcRenderer.invoke('tournaments:create', name, mode),
  updateTournament: (tournamentId: string, changes: TournamentUpdate): Promise<void> =>
    ipcRenderer.invoke('tournaments:update', tournamentId, changes),
  deleteTournament: (tournamentId: string): Promise<void> =>
    ipcRenderer.invoke('tournaments:delete', tournamentId),
  addPool: (tournamentId: string, name: string, text: string): Promise<PoolImport> =>
    ipcRenderer.invoke('tournaments:add-pool', tournamentId, name, text),
  deletePool: (poolId: string): Promise<void> =>
    ipcRenderer.invoke('tournaments:delete-pool', poolId),
  importMatch: (tournamentId: string, link: string): Promise<MatchImport> =>
    ipcRenderer.invoke('tournaments:import-match', tournamentId, link),
  deleteMatch: (matchId: string): Promise<void> =>
    ipcRenderer.invoke('tournaments:delete-match', matchId),
  onImportProgress: (listener: (progress: ImportProgress) => void): (() => void) => {
    const handler = (_: unknown, progress: ImportProgress): void => listener(progress)
    ipcRenderer.on('tournaments:progress', handler)
    return () => ipcRenderer.removeListener('tournaments:progress', handler)
  },
  getPlaylists: (): Promise<Playlist[]> => ipcRenderer.invoke('playlists:get'),
  createPlaylist: (name: string): Promise<string> => ipcRenderer.invoke('playlists:create', name),
  renamePlaylist: (playlistId: string, name: string): Promise<void> =>
    ipcRenderer.invoke('playlists:rename', playlistId, name),
  deletePlaylist: (playlistId: string): Promise<void> =>
    ipcRenderer.invoke('playlists:delete', playlistId),
  getPlaylistMaps: (playlistId: string): Promise<PlaylistMap[]> =>
    ipcRenderer.invoke('playlists:get-maps', playlistId),
  addToPlaylist: (playlistId: string, map: PlaylistMapInput): Promise<void> =>
    ipcRenderer.invoke('playlists:add-map', playlistId, map),
  removeFromPlaylist: (playlistId: string, checksum: string): Promise<void> =>
    ipcRenderer.invoke('playlists:remove-map', playlistId, checksum),
  getPlaylistsOfMap: (checksum: string): Promise<string[]> =>
    ipcRenderer.invoke('playlists:of-map', checksum),
  getSessionPlays: (sessionId: string): Promise<RecentPlay[]> =>
    ipcRenderer.invoke('tracking:get-session-plays', sessionId),
  onStatus: (listener: (status: TrackingStatus) => void): (() => void) => {
    const handler = (_: unknown, status: TrackingStatus): void => listener(status)
    ipcRenderer.on('tracking:status', handler)
    return () => ipcRenderer.removeListener('tracking:status', handler)
  },
  onFrame: (listener: (frame: GameFrame) => void): (() => void) => {
    const handler = (_: unknown, frame: GameFrame): void => listener(frame)
    ipcRenderer.on('tracking:frame', handler)
    return () => ipcRenderer.removeListener('tracking:frame', handler)
  }
}

export type Api = typeof api

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
