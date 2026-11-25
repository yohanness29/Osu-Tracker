import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import type { Playlist, PlaylistMapInput } from '@osu-tracker/storage'
import { useAccount } from '../features/profile/useAccount'
import { FloatingMenu } from './FloatingMenu'
import { closeMapMenu, useMapMenu } from './mapMenu'

function PlaylistMenu(props: { map: PlaylistMapInput }): React.JSX.Element {
  const { map } = props
  const navigate = useNavigate()
  const supporter = useAccount()?.user?.supporter ?? false
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [holding, setHolding] = useState<string[]>([])
  const [name, setName] = useState('')
  const [version, setVersion] = useState(0)
  const reload = (): void => setVersion((current) => current + 1)

  useEffect(() => {
    window.api.getPlaylists().then(setPlaylists).catch(console.error)
    window.api.getPlaylistsOfMap(map.beatmapChecksum).then(setHolding).catch(console.error)
  }, [map.beatmapChecksum, version])

  const toggle = async (playlistId: string): Promise<void> => {
    if (holding.includes(playlistId)) {
      await window.api.removeFromPlaylist(playlistId, map.beatmapChecksum)
    } else {
      await window.api.addToPlaylist(playlistId, map)
    }
    reload()
  }

  const create = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!name.trim()) return
    const playlistId = await window.api.createPlaylist(name)
    await window.api.addToPlaylist(playlistId, map)
    setName('')
    reload()
  }

  return (
    <>
      <div className="truncate px-3 pt-1.5 pb-1 text-xs font-semibold text-ink-soft">
        {map.title} [{map.version}]
      </div>
      <button
        type="button"
        onClick={() => {
          navigate(`/maps/${map.beatmapChecksum}?mode=${map.mode}`)
          closeMapMenu()
        }}
        className="w-full rounded-md px-3 py-1.5 text-left text-ink hover:bg-line"
      >
        Voir la map
      </button>
      <button
        type="button"
        onClick={() => {
          window.api.copyText(String(map.beatmapId)).catch(console.error)
          closeMapMenu()
        }}
        className="w-full rounded-md px-3 py-1.5 text-left text-ink hover:bg-line"
      >
        Copier l’ID ({map.beatmapId})
      </button>
      {map.beatmapId > 0 && (
        <button
          type="button"
          onClick={() => {
            // osu!direct downloads in game for supporters only; others get the page of the map.
            window.open(
              supporter
                ? `osu://b/${map.beatmapId}`
                : `https://osu.ppy.sh/beatmapsets/${map.beatmapsetId}#${map.mode}/${map.beatmapId}`
            )
            closeMapMenu()
          }}
          className="w-full rounded-md px-3 py-1.5 text-left text-ink hover:bg-line"
        >
          {supporter ? 'Télécharger avec osu!direct' : 'Télécharger sur le site osu!'}
        </button>
      )}

      <div className="mt-1 border-t border-line px-3 pt-2 pb-1 text-xs font-semibold text-ink-soft">
        Ajouter à une playlist
      </div>
      {playlists.length === 0 && (
        <p className="px-3 py-1.5 text-ink-soft">Aucune playlist pour l’instant.</p>
      )}
      {playlists.map((playlist) => {
        const inside = holding.includes(playlist.id)
        return (
          <button
            key={playlist.id}
            type="button"
            aria-pressed={inside}
            onClick={() => toggle(playlist.id).catch(console.error)}
            className={`mt-0.5 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left ${
              inside ? 'bg-accent font-semibold text-on-accent' : 'text-ink hover:bg-line'
            }`}
          >
            <span aria-hidden>{inside ? '✓' : '+'}</span>
            <span className="min-w-0 flex-1 truncate">{playlist.name}</span>
            <span className={`text-xs ${inside ? '' : 'text-ink-soft'}`}>{playlist.maps}</span>
          </button>
        )
      })}
      <form onSubmit={create} className="mt-1 flex gap-1 border-t border-line pt-1">
        <input
          value={name}
          aria-label="Nom de la nouvelle playlist"
          placeholder="Nouvelle playlist…"
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1 rounded-md bg-panel px-2 py-1.5 text-ink"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-md bg-panel px-2 font-semibold hover:text-accent disabled:opacity-50"
        >
          Créer
        </button>
      </form>
    </>
  )
}

/** The menu opened by a right click on a map, anywhere in the app. Rendered once. */
export function MapContextMenu(): React.JSX.Element | null {
  const target = useMapMenu((state) => state.target)
  if (!target) return null

  return (
    <FloatingMenu
      key={`${target.map.beatmapChecksum}-${target.x}-${target.y}`}
      x={target.x}
      y={target.y}
      onClose={closeMapMenu}
    >
      <PlaylistMenu map={target.map} />
    </FloatingMenu>
  )
}
