import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const APP_NAME = 'Osu!tracker'
const DATA_FOLDER = 'osu-tracker'
const PREVIOUS_DATA_FOLDER = 'desktop'
const DATABASE_FILES = ['osu-tracker.sqlite', 'osu-tracker.sqlite-wal', 'osu-tracker.sqlite-shm']

/** Must run before the app is ready. The previous folder is kept as a backup. */
export function setupAppData(): void {
  app.setName(APP_NAME)
  if (app.commandLine.hasSwitch('user-data-dir')) return

  const dataPath = join(app.getPath('appData'), DATA_FOLDER)
  const previousPath = join(app.getPath('appData'), PREVIOUS_DATA_FOLDER)
  app.setPath('userData', dataPath)

  const hasDatabase = existsSync(join(dataPath, DATABASE_FILES[0]!))
  if (hasDatabase || !existsSync(join(previousPath, DATABASE_FILES[0]!))) return

  mkdirSync(dataPath, { recursive: true })
  for (const file of DATABASE_FILES) {
    if (existsSync(join(previousPath, file))) {
      copyFileSync(join(previousPath, file), join(dataPath, file))
    }
  }
}
