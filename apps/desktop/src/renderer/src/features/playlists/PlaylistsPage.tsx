import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { Playlist, PlaylistMap } from '@osu-tracker/storage'
import { CopyMapId } from '../../shared/CopyMapId'
import { MapCover } from '../../shared/MapCover'
import { onMapContextMenu } from '../../shared/mapMenu'
import { MapStyle } from '../../shared/MapStyle'
import { ModeBadge } from '../../shared/ModeBadge'
import { useAccount } from '../profile/useAccount'

function PlaylistMapCard(props: {
  map: PlaylistMap
  supporter: boolean
  onRemove: () => void
}): React.JSX.Element {
  const { map, supporter, onRemove } = props
  const details = [
    map.stars !== null && `${map.stars.toFixed(2)}★`,
    map.plays === 0
      ? 'jamais jouée'
      : `${map.passed} pass sur ${map.plays} essai${map.plays > 1 ? 's' : ''}`
  ].filter(Boolean)

  return (
    <li
      onContextMenu={onMapContextMenu(map)}
      className="relative overflow-hidden rounded-xl bg-panel transition-transform hover:scale-[1.01]"
    >
      <MapCover
        beatmapsetId={map.beatmapsetId}
        variant="card"
        className="absolute inset-y-0 right-0 h-full w-2/3"
        fadeIn
      />
      <div className="absolute inset-0 bg-gradient-to-r from-panel from-30% via-panel/60 via-55% to-panel/20" />
      <Link
        to={`/maps/${map.beatmapChecksum}?mode=${map.mode}`}
        aria-label={`Voir ${map.title}`}
        className="absolute inset-0"
      />
      {/* Clicks go through to the link, except on the buttons. */}
      <div className="pointer-events-none relative on-cover flex items-center gap-4 p-4 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            {map.title} [{map.version}]
          </div>
          <div className="truncate text-xs text-ink-soft">
            {map.artist} · par {map.mapper}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs whitespace-nowrap text-ink-soft tabular-nums">
            <ModeBadge mode={map.mode} />
            <MapStyle style={map.style} tags={map.tags} />
            <span>{details.join(' · ')}</span>
            <CopyMapId beatmapId={map.beatmapId} />
          </div>
        </div>
        {supporter && (
          <a
            href={`osu://b/${map.beatmapId}`}
            target="_blank"
            rel="noreferrer"
            title="Ouvrir dans osu!direct"
            className="shrink-0 rounded-lg bg-panel-raised px-3 py-1.5 text-xs font-semibold hover:text-accent"
          >
            osu!direct
          </a>
        )}
        <button
          type="button"
          onClick={onRemove}
          title="Retirer de la playlist"
          aria-label={`Retirer ${map.title} de la playlist`}
          className="shrink-0 rounded-lg bg-panel-raised px-3 py-1.5 text-xs text-ink-soft hover:text-failed"
        >
          Retirer
        </button>
      </div>
    </li>
  )
}

/** The name, which turns into a field to rename the playlist. */
function PlaylistTitle(props: {
  playlist: Playlist
  onRename: (name: string) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState<string | null>(null)

  if (editing !== null) {
    const commit = (): void => {
      if (editing.trim()) props.onRename(editing)
      setEditing(null)
    }
    return (
      <input
        autoFocus
        value={editing}
        aria-label="Nom de la playlist"
        onChange={(event) => setEditing(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') setEditing(null)
        }}
        className="w-full rounded-lg bg-panel px-2 text-3xl font-bold"
      />
    )
  }

  return (
    <button
      type="button"
      title="Renommer"
      onClick={() => setEditing(props.playlist.name)}
      className="max-w-full truncate rounded-lg text-left text-3xl font-bold hover:text-accent"
    >
      {props.playlist.name}
    </button>
  )
}

export function PlaylistsPage(): React.JSX.Element {
  const { playlistId } = useParams()
  const navigate = useNavigate()
  const account = useAccount()
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null)
  // Kept with the playlist they belong to: another one shows nothing until its maps arrive.
  const [loaded, setLoaded] = useState<{ playlistId: string; maps: PlaylistMap[] } | null>(null)
  const [version, setVersion] = useState(0)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const selected = playlists?.find((playlist) => playlist.id === playlistId) ?? null
  const maps = loaded && loaded.playlistId === playlistId ? loaded.maps : []
  const reload = (): void => setVersion((current) => current + 1)

  useEffect(() => {
    window.api.getPlaylists().then(setPlaylists).catch(console.error)
    if (!playlistId) return
    window.api
      .getPlaylistMaps(playlistId)
      .then((found) => setLoaded({ playlistId, maps: found }))
      .catch(console.error)
  }, [playlistId, version])

  // Without a playlist chosen, the latest one opens.
  useEffect(() => {
    if (!playlistId && playlists && playlists.length > 0) {
      navigate(`/playlists/${playlists[0]!.id}`, { replace: true })
    }
  }, [playlistId, playlists, navigate])

  const create = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!name.trim()) return
    const id = await window.api.createPlaylist(name)
    setName('')
    navigate(`/playlists/${id}`)
  }

  const remove = async (): Promise<void> => {
    if (!selected) return
    await window.api.deletePlaylist(selected.id)
    setConfirmDelete(false)
    navigate('/playlists')
    reload()
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line p-4">
        <h2 className="mb-2 px-2 text-sm font-semibold text-ink-soft">Mes playlists</h2>
        {playlists?.map((playlist) => (
          <Link
            key={playlist.id}
            to={`/playlists/${playlist.id}`}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              playlist.id === playlistId ? 'bg-panel-raised font-semibold' : 'hover:bg-panel'
            }`}
          >
            <span className="min-w-0 flex-1 truncate">{playlist.name}</span>
            <span className="text-xs text-ink-soft tabular-nums">{playlist.maps}</span>
          </Link>
        ))}
        <form onSubmit={create} className="mt-2 flex gap-1">
          <input
            value={name}
            aria-label="Nom de la nouvelle playlist"
            placeholder="Nouvelle playlist…"
            onChange={(event) => setName(event.target.value)}
            className="min-w-0 flex-1 rounded-lg bg-panel px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            +
          </button>
        </form>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-8">
        {playlists?.length === 0 && (
          <div>
            <h1 className="text-3xl font-bold">Playlists</h1>
            <p className="mt-2 text-ink-soft">
              Regroupe des maps comme tu veux pour les retrouver facilement. Crée une playlist à
              gauche, puis ajoute des maps d’un clic droit sur n’importe quelle map de l’app.
            </p>
          </div>
        )}

        {selected && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <PlaylistTitle
                  playlist={selected}
                  onRename={(newName) =>
                    window.api.renamePlaylist(selected.id, newName).then(reload)
                  }
                />
                <p className="mt-1 text-ink-soft">
                  {selected.maps} map{selected.maps > 1 ? 's' : ''} · clique sur le nom pour le
                  modifier
                </p>
              </div>
              {confirmDelete ? (
                <div className="flex shrink-0 items-center gap-2 text-sm">
                  <span>Supprimer cette playlist ?</span>
                  <button
                    onClick={() => remove().catch(console.error)}
                    className="rounded-lg bg-failed px-3 py-1.5 font-semibold text-on-accent"
                  >
                    Supprimer
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg px-3 py-1.5 text-ink-soft hover:text-ink"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:text-failed"
                >
                  Supprimer la playlist
                </button>
              )}
            </div>

            {maps.length === 0 && (
              <p className="mt-6 text-ink-soft">
                Cette playlist est vide. Ajoute des maps d’un clic droit sur n’importe quelle map de
                l’app.
              </p>
            )}
            <ul className="mt-6 space-y-2">
              {maps.map((map) => (
                <PlaylistMapCard
                  key={map.beatmapChecksum}
                  map={map}
                  supporter={account?.user?.supporter ?? false}
                  onRemove={() =>
                    window.api
                      .removeFromPlaylist(selected.id, map.beatmapChecksum)
                      .then(reload)
                      .catch(console.error)
                  }
                />
              ))}
            </ul>
          </>
        )}

        {playlistId && playlists && !selected && (
          <p className="text-ink-soft">Cette playlist n’existe plus.</p>
        )}
      </div>
    </div>
  )
}
