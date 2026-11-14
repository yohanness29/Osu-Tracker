import { app, clipboard, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { Credentials } from '@osu-tracker/osu-api'
import type { SearchFilters } from '@osu-tracker/recommender'
import type { NewGoal, PlaylistMapInput, TournamentUpdate } from '@osu-tracker/storage'
import {
  getAccountStatus,
  getTopScores,
  login,
  logout,
  saveCredentials,
  syncAccount
} from './account'
import { setupAppData } from './app-data'
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateState,
  installUpdate,
  setupUpdates
} from './updates'
import {
  addPool,
  createTournament,
  deleteMatch,
  deletePool,
  deleteTournament,
  getTournament,
  getTournaments,
  importMatch,
  updateTournament
} from './tournaments'
import {
  getFarmingStatus,
  getPlayerStars,
  getSuggestions,
  importMap,
  refreshCatalog
} from './farming'
import icon from '../../resources/icon.png?asset'
import {
  addGoal,
  addToPlaylist,
  createPlaylist,
  exportSession,
  deletePlaylist,
  getPlaylistMaps,
  getPlaylists,
  getPlaylistsOfMap,
  removeFromPlaylist,
  renamePlaylist,
  getAllPlays,
  getGoals,
  getMapDetail,
  getMaps,
  getSessionPlays,
  getSessions,
  getTrackingStatus,
  removeGoal,
  renameSession,
  startTracking,
  stopTracking
} from './tracking'

setupAppData()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    title: 'Osu!tracker',
    backgroundColor: '#14121a',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.osutracker.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('app:copy-text', (_, text: string) => clipboard.writeText(text))
  ipcMain.handle('app:get-info', () => ({
    version: app.getVersion(),
    dataFolder: app.getPath('userData')
  }))
  ipcMain.handle('updates:get', () => getUpdateState())
  ipcMain.handle('updates:check', () => checkForUpdates())
  ipcMain.handle('updates:download', () => downloadUpdate())
  ipcMain.handle('updates:install', () => installUpdate())
  ipcMain.handle('app:open-data-folder', async () => {
    const failure = await shell.openPath(app.getPath('userData'))
    if (failure) throw new Error(failure)
  })
  ipcMain.handle('tracking:get-status', () => getTrackingStatus())
  ipcMain.handle('farming:get-status', () => getFarmingStatus())
  ipcMain.handle('farming:get-player-stars', (_, mode: string) => getPlayerStars(mode))
  ipcMain.handle(
    'farming:import',
    (_, beatmapId: number, mods: string[], accuracy: number | null) =>
      importMap(beatmapId, mods, accuracy)
  )
  ipcMain.handle(
    'farming:refresh',
    (_, mode: string, mods: string[], text: string, filters: SearchFilters) =>
      refreshCatalog(mode, mods, text, filters)
  )
  ipcMain.handle(
    'farming:get-suggestions',
    (_, mode: string, accuracy: number | null, mods: string[]) =>
      getSuggestions(mode, accuracy, mods)
  )
  ipcMain.handle('account:get-status', () => getAccountStatus())
  ipcMain.handle('account:save-credentials', (_, credentials: Credentials) =>
    saveCredentials(credentials)
  )
  ipcMain.handle('account:login', () => login())
  ipcMain.handle('account:logout', () => logout())
  ipcMain.handle('account:refresh', () => syncAccount(0))
  ipcMain.handle('account:get-top-scores', (_, mode: string) => getTopScores(mode))
  ipcMain.handle('tracking:get-sessions', () => getSessions())
  ipcMain.handle('tracking:export-session', (_, sessionId: string) => exportSession(sessionId))
  ipcMain.handle('tournaments:get-all', () => getTournaments())
  ipcMain.handle('tournaments:get', (_, tournamentId: string) => getTournament(tournamentId))
  ipcMain.handle('tournaments:create', (_, name: string, mode: string) =>
    createTournament(name, mode)
  )
  ipcMain.handle('tournaments:update', (_, tournamentId: string, changes: TournamentUpdate) =>
    updateTournament(tournamentId, changes)
  )
  ipcMain.handle('tournaments:delete', (_, tournamentId: string) => deleteTournament(tournamentId))
  ipcMain.handle('tournaments:add-pool', (_, tournamentId: string, name: string, text: string) =>
    addPool(tournamentId, name, text)
  )
  ipcMain.handle('tournaments:delete-pool', (_, poolId: string) => deletePool(poolId))
  ipcMain.handle('tournaments:import-match', (_, tournamentId: string, link: string) =>
    importMatch(tournamentId, link)
  )
  ipcMain.handle('tournaments:delete-match', (_, matchId: string) => deleteMatch(matchId))
  ipcMain.handle('playlists:get', () => getPlaylists())
  ipcMain.handle('playlists:create', (_, name: string) => createPlaylist(name))
  ipcMain.handle('playlists:rename', (_, playlistId: string, name: string) =>
    renamePlaylist(playlistId, name)
  )
  ipcMain.handle('playlists:delete', (_, playlistId: string) => deletePlaylist(playlistId))
  ipcMain.handle('playlists:get-maps', (_, playlistId: string) => getPlaylistMaps(playlistId))
  ipcMain.handle('playlists:add-map', (_, playlistId: string, map: PlaylistMapInput) =>
    addToPlaylist(playlistId, map)
  )
  ipcMain.handle('playlists:remove-map', (_, playlistId: string, checksum: string) =>
    removeFromPlaylist(playlistId, checksum)
  )
  ipcMain.handle('playlists:of-map', (_, checksum: string) => getPlaylistsOfMap(checksum))
  ipcMain.handle('tracking:rename-session', (_, sessionId: string, name: string) =>
    renameSession(sessionId, name)
  )
  ipcMain.handle('tracking:get-all-plays', () => getAllPlays())
  ipcMain.handle('tracking:get-goals', (_, sessionId: string | null) => getGoals(sessionId))
  ipcMain.handle('tracking:add-goal', (_, goal: NewGoal) => addGoal(goal))
  ipcMain.handle('tracking:remove-goal', (_, goalId: string) => removeGoal(goalId))
  ipcMain.handle('tracking:get-maps', (_, mode?: string) => getMaps(mode))
  ipcMain.handle('tracking:get-map', (_, checksum: string) => getMapDetail(checksum))
  ipcMain.handle('tracking:get-session-plays', (_, sessionId: string) => getSessionPlays(sessionId))

  startTracking()
  app.once('before-quit', stopTracking)
  // Once loaded, the native pp calculator hangs any normal exit. Everything is saved by now.
  app.once('will-quit', () => process.kill(process.pid, 'SIGKILL'))

  // Verification mode: prints the status after tosu had time to connect, then quits.
  if (process.argv.includes('--self-test')) {
    setTimeout(() => {
      console.log(JSON.stringify(getTrackingStatus(), null, 2))
      app.quit()
    }, 4000)
  }

  createWindow()
  setupUpdates()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
