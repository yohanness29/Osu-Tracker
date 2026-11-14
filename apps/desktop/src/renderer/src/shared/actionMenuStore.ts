import { create } from 'zustand'

export type MenuAction = { label: string; run: () => void | Promise<void> }

type ActionMenuState = {
  /** What was right-clicked offers these actions: null while the menu is closed. */
  target: { actions: MenuAction[]; x: number; y: number } | null
  /** A short message about the result of an action, shown for a moment. */
  notice: { text: string; id: number } | null
}

export const useActionMenu = create<ActionMenuState>(() => ({ target: null, notice: null }))

export function closeActionMenu(): void {
  useActionMenu.setState({ target: null })
}

export function onActionMenu(actions: MenuAction[]): (event: React.MouseEvent) => void {
  return (event) => {
    event.preventDefault()
    useActionMenu.setState({ target: { actions, x: event.clientX, y: event.clientY } })
  }
}

export function notify(text: string): void {
  useActionMenu.setState({ notice: { text, id: Date.now() } })
}
