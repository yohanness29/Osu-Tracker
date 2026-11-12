import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const workspacePackages = [
  '@osu-tracker/collector',
  '@osu-tracker/osu-api',
  '@osu-tracker/pp',
  '@osu-tracker/recommender',
  '@osu-tracker/shared',
  '@osu-tracker/stats',
  '@osu-tracker/storage',
  '@osu-tracker/tracker'
]

export default defineConfig({
  main: {
    build: {
      // Workspace packages ship TypeScript sources, so they must be bundled.
      externalizeDeps: { exclude: workspacePackages }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
