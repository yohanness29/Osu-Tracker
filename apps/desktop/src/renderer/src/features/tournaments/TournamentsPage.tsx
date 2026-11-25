import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { matchRounds, tournamentStandings } from '@osu-tracker/stats'
import type { Placement } from '@osu-tracker/stats'
import type { Tournament, TournamentUpdate } from '@osu-tracker/storage'
import type { TournamentData, TournamentSummary } from '../../../../main/tournaments'
import { Modal } from '../../shared/Modal'
import { ModeIcon } from '../../shared/ModeIcon'
import { textMatches } from '../../shared/search'
import { MODES, modeLabel } from '../../shared/modes'
import { useTracking } from '../../store'
import { BracketTab } from './BracketTab'
import { ConfigTab } from './ConfigTab'
import { PoolsTab } from './PoolsTab'
import { ResultsTab } from './ResultsTab'
import { ScoutingTab } from './ScoutingTab'
import { StrategyTab } from './StrategyTab'
import { comparisonWith, opponentChoices } from './tournamentView'

const TABS = [
  { key: 'config', label: 'Configuration' },
  { key: 'pools', label: 'Pools' },
  { key: 'scouting', label: 'Scouting' },
  { key: 'strategy', label: 'Stratégie' },
  { key: 'results', label: 'Résultats' },
  { key: 'bracket', label: 'Bracket' }
] as const
type TabKey = (typeof TABS)[number]['key']

function isTab(key: string | null): key is TabKey {
  return TABS.some((tab) => tab.key === key)
}

/** The window to start following a tournament: its name and its mode. */
function CreateDialog(props: {
  onCreated: (id: string) => void
  onClose: () => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [mode, setMode] = useState('taiko')

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!name.trim()) return
    const id = await window.api.createTournament(name, mode)
    props.onCreated(id)
  }

  return (
    <Modal title="Créer un suivi de tournoi" onClose={props.onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Nom du tournoi</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="BTT10, OWC 2026…"
            className="mt-1.5 w-full rounded-lg bg-panel-raised px-3 py-2 text-sm"
          />
        </label>
        <div>
          <span className="text-sm font-medium">Mode</span>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Mode">
            {MODES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={mode === key}
                onClick={() => setMode(key)}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 py-2.5 text-xs ${
                  mode === key
                    ? 'border-accent bg-accent/10 font-semibold text-accent'
                    : 'border-transparent bg-panel-raised text-ink-soft hover:text-ink'
                }`}
              >
                <ModeIcon mode={key} className="size-5" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-soft">
          Tu pourras ensuite régler son format, ajouter ses pools et importer ses matchs.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg px-4 py-2 text-sm text-ink-soft hover:bg-panel-raised hover:text-ink"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            Créer
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** The name, which turns into a field to rename the tournament. */
function TournamentTitle(props: {
  tournament: Tournament
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
        aria-label="Nom du tournoi"
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
      onClick={() => setEditing(props.tournament.name)}
      className="max-w-full truncate text-left text-3xl font-bold hover:text-accent"
    >
      {props.tournament.name}
    </button>
  )
}

function TournamentView(props: {
  tournamentId: string
  onDeleted: () => void
  /** Imports and settings change the placement shown in the list. */
  onChange: () => void
}): React.JSX.Element {
  const { tournamentId } = props
  const [params, setParams] = useSearchParams()
  const asked = params.get('tab')
  const [loaded, setData] = useState<TournamentData | null | undefined>(undefined)
  const [version, setVersion] = useState(0)
  // New plays change the training shown.
  const results = useTracking((state) => state.status?.totalResults)
  const reload = (): void => {
    setVersion((current) => current + 1)
    props.onChange()
  }

  useEffect(() => {
    window.api.getTournament(tournamentId).then(setData).catch(console.error)
  }, [tournamentId, version, results])

  if (loaded === undefined) return <div />
  if (loaded === null) return <p className="text-ink-soft">Ce tournoi n’existe plus.</p>

  const { tournament } = loaded
  // Each match tied to its round, its warm-ups left out of every analysis.
  const rounds = matchRounds(loaded.matches, loaded.pools)
  const data = { ...loaded, matches: rounds.flatMap((round) => round.matches) }
  const comparison = comparisonWith(data, tournament.nextOpponentId)
  const standings = tournamentStandings(data.matches, tournament, loaded.bracket, loaded.manual)
  const opponents = opponentChoices(standings, data.me?.userId ?? null, tournament.nextOpponentId)
  // Without a tab asked, the strategy once there is a pool to plan with, else the settings.
  const tab: TabKey = isTab(asked) ? asked : data.pools.length > 0 ? 'strategy' : 'config'
  const update = (changes: TournamentUpdate): void => {
    window.api.updateTournament(tournament.id, changes).then(reload).catch(console.error)
  }
  const me = standings.find(({ userId }) => userId === data.me?.userId)
  const left = standings.filter(({ eliminated }) => !eliminated).length

  return (
    <div>
      <TournamentTitle tournament={tournament} onRename={(name) => update({ name })} />
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-ink-soft">
        <ModeIcon mode={tournament.mode} />
        {modeLabel(tournament.mode)}
        {me?.seed != null && (
          <>
            {' '}
            · seed <span className="font-semibold text-ink">#{me.seed}</span>
            {me.eliminated ? ' · éliminé' : me.losses > 0 ? ' · en loser bracket' : ''}
          </>
        )}
        {standings.some(({ seed }) => seed !== null) && (
          <>
            {' '}
            · {left} joueur{left > 1 ? 's' : ''} en lice
          </>
        )}
      </p>

      <div className="mt-5 mb-5 flex gap-1 border-b border-line">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setParams({ tab: key })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === key
                ? 'border-accent font-semibold text-ink'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'config' && (
        <ConfigTab
          data={data}
          opponents={opponents}
          standings={standings}
          onChange={reload}
          onDeleted={props.onDeleted}
        />
      )}
      {tab === 'pools' && <PoolsTab data={data} onChange={reload} />}
      {tab === 'scouting' && (
        <ScoutingTab
          data={data}
          rounds={rounds}
          opponents={opponents}
          onOpponentChange={(nextOpponentId) => update({ nextOpponentId })}
        />
      )}
      {tab === 'strategy' && (
        <StrategyTab
          data={data}
          opponents={opponents}
          comparison={comparison}
          onConfigure={() => setParams({ tab: 'config' })}
        />
      )}
      {tab === 'bracket' && <BracketTab data={data} onChange={reload} />}
      {tab === 'results' && (
        <ResultsTab data={data} rounds={rounds} standings={standings} onChange={reload} />
      )}
    </div>
  )
}

/** The label, its meaning and its color: gold for a win, green while still in. */
function describePlacement(
  placement: Placement
): { label: string; title: string; color: string } | null {
  switch (placement.kind) {
    case 'unknown':
      return null
    case 'dnq':
      return {
        label: 'DNQ',
        title: 'Non qualifié après les qualifs',
        color: 'var(--color-ink-faint)'
      }
    case 'alive':
      return { label: 'En lice', title: 'Encore dans le tournoi', color: 'var(--color-passed)' }
    case 'placed': {
      const { high, low } = placement
      if (high === 1)
        return { label: '1', title: 'Vainqueur du tournoi', color: 'var(--color-warning)' }
      if (high === 2) return { label: '2', title: 'Finaliste', color: 'var(--color-ink-soft)' }
      return {
        label: `${high}-${low}`,
        title: `Éliminé, entre la ${low}e et la ${high}e place`,
        color: 'var(--color-ink-soft)'
      }
    }
  }
}

function PlacementBadge(props: { placement: Placement }): React.JSX.Element | null {
  const shown = describePlacement(props.placement)
  if (!shown) return null
  return (
    <span
      title={shown.title}
      className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
      style={{
        color: shown.color,
        backgroundColor: `color-mix(in srgb, ${shown.color} 16%, transparent)`
      }}
    >
      {shown.label}
    </span>
  )
}

export function TournamentsPage(): React.JSX.Element {
  const { tournamentId } = useParams()
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<TournamentSummary[] | null>(null)
  const [version, setVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const shown = tournaments?.filter(({ name }) => textMatches(name, search))

  useEffect(() => {
    window.api.getTournaments().then(setTournaments).catch(console.error)
  }, [version, tournamentId])

  // Without a tournament chosen, the latest one opens.
  useEffect(() => {
    if (!tournamentId && tournaments && tournaments.length > 0) {
      navigate(`/tournaments/${tournaments[0]!.id}`, { replace: true })
    }
  }, [tournamentId, tournaments, navigate])

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line p-4">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mb-4 w-full rounded-lg bg-accent py-2 text-sm font-semibold text-on-accent hover:opacity-90"
        >
          + Créer un suivi de tournoi
        </button>
        {creating && (
          <CreateDialog
            onClose={() => setCreating(false)}
            onCreated={(id) => {
              setCreating(false)
              navigate(`/tournaments/${id}`)
            }}
          />
        )}
        <h2 className="mb-2 px-2 text-sm font-semibold text-ink-soft">Mes tournois</h2>
        {tournaments && tournaments.length > 0 && (
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un tournoi…"
            aria-label="Rechercher un tournoi"
            className="mb-2 w-full rounded-lg bg-panel px-3 py-1.5 text-sm"
          />
        )}
        {shown?.length === 0 && (
          <p className="px-2 text-sm text-ink-soft">Aucun tournoi ne correspond.</p>
        )}
        {shown?.map((tournament) => (
          <Link
            key={tournament.id}
            to={`/tournaments/${tournament.id}`}
            title={modeLabel(tournament.mode)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              tournament.id === tournamentId ? 'bg-panel-raised font-semibold' : 'hover:bg-panel'
            }`}
          >
            <ModeIcon mode={tournament.mode} className="size-4 shrink-0 text-ink-soft" />
            <span className="min-w-0 flex-1 truncate">{tournament.name}</span>
            <PlacementBadge placement={tournament.placement} />
          </Link>
        ))}
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-8">
        {tournaments?.length === 0 && (
          <div>
            <h1 className="text-3xl font-bold">Tournois</h1>
            <p className="mt-2 max-w-2xl text-ink-soft">
              Prépare tes tournois : crée un suivi avec le bouton à gauche, règle son format, ajoute
              ses pools pour suivre ton entraînement map par map, importe ses matchs pour observer
              tes adversaires, puis prépare tes bans et tes picks.
            </p>
          </div>
        )}
        {tournamentId && (
          <TournamentView
            key={tournamentId}
            tournamentId={tournamentId}
            onChange={() => setVersion((current) => current + 1)}
            onDeleted={() => {
              setVersion((current) => current + 1)
              navigate('/tournaments')
            }}
          />
        )}
      </div>
    </div>
  )
}
