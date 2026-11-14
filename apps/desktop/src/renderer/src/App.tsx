import { useCallback, useEffect, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import { AnalysisPage } from './features/analysis/AnalysisPage'
import { FarmingPage } from './features/farming/FarmingPage'
import { HistoryPage } from './features/history/HistoryPage'
import { LivePage } from './features/live/LivePage'
import { MapDetailPage } from './features/maps/MapDetailPage'
import { MapsPage } from './features/maps/MapsPage'
import { PlaylistsPage } from './features/playlists/PlaylistsPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TournamentsPage } from './features/tournaments/TournamentsPage'
import type { TosuLaunch } from '../../main/tosu-process'
import { ActionMenu } from './shared/ActionMenu'
import { FloatingMenu } from './shared/FloatingMenu'
import { MapContextMenu } from './shared/MapContextMenu'
import { NavIcon } from './shared/NavIcon'
import { usePersistentState } from './shared/usePersistentState'
import { useUpdateState } from './shared/useUpdateState'
import { connectTracking, useTracking } from './store'

const PAGES = [
  { path: '/', label: 'En direct', icon: 'live' },
  { path: '/history', label: 'Historique', icon: 'history' },
  { path: '/maps', label: 'Maps', icon: 'maps' },
  { path: '/analysis', label: 'Analyse', icon: 'analysis' },
  { path: '/farming', label: 'Suggestions', icon: 'suggestions' },
  { path: '/playlists', label: 'Playlists', icon: 'playlists' },
  { path: '/tournaments', label: 'Tournois', icon: 'tournaments' }
]

const ACCOUNT_PAGES = [
  { path: '/profile', label: 'Mon profil', icon: 'profile' },
  { path: '/settings', label: 'Paramètres', icon: 'settings' }
]

/** The player's card: a click opens the menu of their profile and the settings. */
function ProfileCard(props: { folded: boolean }): React.JSX.Element {
  const { folded } = props
  const profile = useTracking((state) => state.frame?.profile)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const active = ACCOUNT_PAGES.some(({ path }) => pathname.startsWith(path))

  // One element in the sidebar: the menu opening must not change its spacing.
  return (
    <div>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        title={folded ? (profile?.name ?? 'Mon profil') : undefined}
        onClick={(event) => {
          if (menu) return setMenu(null)
          // Beside the card, on its right, level with its bottom.
          const { right, bottom } = event.currentTarget.getBoundingClientRect()
          setMenu({ x: right + 8, y: bottom })
        }}
        className={`flex w-full items-center rounded-xl text-left transition-colors hover:bg-line ${
          folded ? 'justify-center p-1.5' : 'gap-3 p-3'
        } ${active || menu ? 'bg-line' : 'bg-panel-raised'}`}
      >
        {profile?.name ? (
          <>
            <img
              src={`https://a.ppy.sh/${profile.id}`}
              alt=""
              className={`${folded ? 'size-8' : 'size-10'} rounded-lg`}
            />
            {!folded && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{profile.name}</div>
                <div className="text-xs text-ink-soft tabular-nums">
                  {Math.round(profile.pp).toLocaleString('fr-FR')}pp · #
                  {profile.globalRank.toLocaleString('fr-FR')}
                </div>
              </div>
            )}
          </>
        ) : folded ? (
          <NavIcon name="profile" className="size-5" />
        ) : (
          <span className="flex-1 text-sm font-semibold">Mon profil</span>
        )}
        {!folded && <span className="text-xs text-ink-soft">{menu ? '◂' : '▸'}</span>}
      </button>
      {menu && (
        <FloatingMenu x={menu.x} y={menu.y} onClose={closeMenu} className="w-48">
          {ACCOUNT_PAGES.map(({ path, label, icon }) => (
            <button
              key={path}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null)
                navigate(path)
              }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-line ${
                pathname.startsWith(path) ? 'font-semibold text-ink' : 'text-ink-soft'
              }`}
            >
              <NavIcon name={icon} className="size-4" />
              {label}
            </button>
          ))}
        </FloatingMenu>
      )}
    </div>
  )
}

const LAUNCH_MESSAGES: Partial<Record<TosuLaunch, string>> = {
  installing: 'installation de tosu…',
  internal: 'démarrage de tosu…',
  unsupported: 'tosu non disponible sur ce système',
  failed: 'tosu n’a pas pu démarrer'
}

function ConnectionStatus(props: { folded: boolean }): React.JSX.Element {
  const connected = useTracking((state) => state.status?.connected ?? false)
  const launch = useTracking((state) => state.status?.tosu ?? 'pending')
  const message = connected ? 'tosu connecté' : (LAUNCH_MESSAGES[launch] ?? 'tosu non connecté')

  return (
    <div
      title={props.folded ? message : undefined}
      className={`flex items-center gap-2 px-1 text-xs text-ink-soft ${props.folded ? 'justify-center' : ''}`}
    >
      <span className={`size-2 shrink-0 rounded-full ${connected ? 'bg-passed' : 'bg-failed'}`} />
      {!props.folded && message}
    </div>
  )
}

/** Shown when a new version is out: it leads to the settings, where it installs. */
function UpdateNotice(props: { folded: boolean }): React.JSX.Element | null {
  const state = useUpdateState()
  if (state.status !== 'available' && state.status !== 'ready') return null
  const label =
    state.status === 'ready'
      ? `Version ${state.version} prête`
      : `Version ${state.version} disponible`
  return (
    <NavLink
      to="/settings"
      title={props.folded ? label : undefined}
      className={`flex items-center gap-2 rounded-lg bg-accent/15 py-2 text-xs font-semibold text-accent hover:bg-accent/25 ${
        props.folded ? 'justify-center' : 'px-3'
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden
        className="size-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 15V4M5.5 8.5 10 4l4.5 4.5M4 17h12" />
      </svg>
      {!props.folded && label}
    </NavLink>
  )
}

function Sidebar(): React.JSX.Element {
  const [folded, setFolded] = usePersistentState('sidebar-folded', false)

  return (
    <aside
      className={`flex shrink-0 flex-col gap-1 bg-panel transition-[width] ${
        folded ? 'w-20 p-2' : 'w-56 p-4'
      }`}
    >
      <div
        className={`mb-6 flex items-center pt-2 text-lg font-extrabold ${
          folded ? 'justify-between gap-1 pl-1' : 'gap-2 px-2'
        }`}
      >
        <span className="rounded-md bg-accent px-1.5 py-0.5 text-xs font-extrabold text-page">
          O!tr
        </span>
        {!folded && <span className="flex-1">Osu!tracker</span>}
        <button
          type="button"
          onClick={() => setFolded(!folded)}
          title={folded ? 'Déplier le menu' : 'Replier le menu'}
          aria-label={folded ? 'Déplier le menu' : 'Replier le menu'}
          aria-expanded={!folded}
          className="rounded-md p-1 text-ink-soft hover:bg-panel-raised hover:text-ink"
        >
          <svg
            viewBox="0 0 20 20"
            aria-hidden
            className={`size-4 transition-transform ${folded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.5 5 7.5 10l5 5" />
          </svg>
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {PAGES.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            title={folded ? label : undefined}
            aria-label={folded ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors ${
                folded ? 'justify-center' : 'px-3'
              } ${isActive ? 'bg-panel-raised text-ink' : 'text-ink-soft hover:text-ink'}`
            }
          >
            <NavIcon name={icon} className="size-5 shrink-0" />
            {!folded && label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-3">
        <UpdateNotice folded={folded} />
        <ConnectionStatus folded={folded} />
        <ProfileCard folded={folded} />
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
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/farming" element={<FarmingPage />} />
            <Route path="/maps" element={<MapsPage />} />
            <Route path="/maps/:checksum" element={<MapDetailPage />} />
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/playlists/:playlistId" element={<PlaylistsPage />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournaments/:tournamentId" element={<TournamentsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
