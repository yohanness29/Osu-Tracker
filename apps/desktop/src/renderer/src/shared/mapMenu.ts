import { create } from 'zustand'
import type { PlaylistMapInput } from '@osu-tracker/storage'

type MapMenuState = {
  /** The map right-clicked, and where: null while the menu is closed. */
  target: { map: PlaylistMapInput; x: number; y: number } | null
}

export const useMapMenu = create<MapMenuState>(() => ({ target: null }))

export function closeMapMenu(): void {
  useMapMenu.setState({ target: null })
}

/**
 * Right-click handler for anything showing a map: opens the menu to add it to playlists.
 * Without a map, as for a score whose map is not known, the usual menu stays.
 */
export function onMapContextMenu(
  map: PlaylistMapInput | null
): ((event: React.MouseEvent) => void) | undefined {
  if (!map || !map.beatmapChecksum) return undefined
  return (event) => {
    event.preventDefault()
    useMapMenu.setState({ target: { map, x: event.clientX, y: event.clientY } })
  }
}
