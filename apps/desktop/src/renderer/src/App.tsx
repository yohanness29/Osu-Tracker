import { useEffect } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router'
import { AnalysisPage } from './features/analysis/AnalysisPage'
import { FarmingPage } from './features/farming/FarmingPage'
import { HistoryPage } from './features/history/HistoryPage'
import { LivePage } from './features/live/LivePage'
import { MapDetailPage } from './features/maps/MapDetailPage'
import { MapsPage } from './features/maps/MapsPage'
import { PlaylistsPage } from './features/playlists/PlaylistsPage'
import { ProfilePage } from './features/profile/ProfilePage'
import type { TosuLaunch } from '../../main/tosu-process'
import { ActionMenu } from './shared/ActionMenu'
import { MapContextMenu } from './shared/MapContextMenu'
import { connectTracking, useTracking } from './store'

const PAGES = [
  { path: '/', label: 'En direct' },
  { path: '/history', label: 'Historique' },
  { path: '/maps', label: 'Maps' },
  { path: '/analysis', label: 'Analyse' },
  { path: '/farming', label: 'Suggestions' },
  { path: '/playlists', label: 'Playlists' }
]

function ProfileCard(): React.JSX.Element {
  const profile = useTracking((state) => state.frame?.profile)

  return (
    <NavLink
      to="/profile"
      title="Voir mon profil"
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-line ${
          isActive ? 'bg-line' : 'bg-panel-raised'
        }`
      }
    >
      {profile?.name ? (
        <>
          <img src={`https://a.ppy.sh/${profile.id}`} alt="" className="size-10 rounded-lg" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{profile.name}</div>
            <div className="text-xs text-ink-soft tabular-nums">
              {Math.round(profile.pp).toLocaleString('fr-FR')}pp · #
              {profile.globalRank.toLocaleString('fr-FR')}
            </div>
          </div>
        </>
      ) : (
        <span className="text-sm font-semibold">Mon profil</span>
      )}
    </NavLink>
  )
}

const LAUNCH_MESSAGES: Partial<Record<TosuLaunch, string>> = {
  installing: 'installation de tosu…',
  internal: 'démarrage de tosu…',
  unsupported: 'tosu non disponible sur ce système',
  failed: 'tosu n’a pas pu démarrer'
}

function ConnectionStatus(): React.JSX.Element {
  const connected = useTracking((state) => state.status?.connected ?? false)
  const launch = useTracking((state) => state.status?.tosu ?? 'pending')
  const message = connected ? 'tosu connecté' : (LAUNCH_MESSAGES[launch] ?? 'tosu non connecté')

  return (
    <div className="flex items-center gap-2 px-1 text-xs text-ink-soft">
      <span className={`size-2 rounded-full ${connected ? 'bg-passed' : 'bg-failed'}`} />
      {message}
    </div>
  )
}

function Sidebar(): React.JSX.Element {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 bg-panel p-4">
      <div className="mb-6 flex items-center gap-2 px-2 pt-2 text-lg font-extrabold">
        <span className="rounded-md bg-accent px-1.5 py-0.5 text-xs font-extrabold text-page">
          O!tr
        </span>
        Osu!tracker
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {PAGES.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-panel-raised text-ink' : 'text-ink-soft hover:text-ink'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-3">
        <ConnectionStatus />
        <ProfileCard />
      </div>
    </aside>
  )
}

function App(): React.JSX.Element {
  useEffect(() => connectTracking(), [])

  return (
    <HashRouter>
      <div className="flex h-full">
        <Sidebar />
        <MapContextMenu />
        <ActionMenu />
        <main className="min-w-0 flex-1">
          <Routes>
            <Route path="/" element={<LivePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/farming" element={<FarmingPage />} />
            <Route path="/maps" element={<MapsPage />} />
            <Route path="/maps/:checksum" element={<MapDetailPage />} />
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/playlists/:playlistId" element={<PlaylistsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
