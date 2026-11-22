import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/desktop/src/renderer/**/*.test.ts',
      // The rest of the main process needs Electron.
      'apps/desktop/src/main/versions.test.ts'
    ]
  }
})
