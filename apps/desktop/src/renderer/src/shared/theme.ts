import { create } from 'zustand'

export type ThemeChoice = 'system' | 'dark' | 'light'
export type Theme = 'dark' | 'light'

// Apart from the saved filters: resetting them keeps the theme.
const KEY = 'osu-tracker-theme'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system'
  } catch {
    return 'system'
  }
}

function resolve(choice: ThemeChoice): Theme {
  if (choice !== 'system') return choice
  return darkQuery.matches ? 'dark' : 'light'
}

type ThemeState = { choice: ThemeChoice; theme: Theme }

export const useTheme = create<ThemeState>(() => {
  const choice = readChoice()
  return { choice, theme: resolve(choice) }
})

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // Without storage, the choice lasts until the app closes.
  }
  useTheme.setState({ choice, theme: resolve(choice) })
}

/** Run before the first render, so that the app never shows in the wrong colors. */
export function setupTheme(): void {
  apply(useTheme.getState().theme)
  useTheme.subscribe(({ theme }) => apply(theme))
  // Following the system: its changes apply at once.
  darkQuery.addEventListener('change', () => {
    const { choice } = useTheme.getState()
    if (choice === 'system') useTheme.setState({ theme: resolve(choice) })
  })
}

/** The value of a color of main.css, for what cannot read CSS, like canvas charts. */
export function themeColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
}
