import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { matchRounds, tournamentStandings } from '@osu-tracker/stats'
import type { Tournament } from '@osu-tracker/storage'
import type { TournamentData } from '../../../../main/tournaments'
import { ModeIcon } from '../../shared/ModeIcon'
import { MODES, modeLabel } from '../../shared/modes'
import { useTracking } from '../../store'
import { MatchesTab } from './MatchesTab'
import { OpponentTab } from './OpponentTab'
import { PoolsTab } from './PoolsTab'
import { PrepTab } from './PrepTab'
import { FormatSettings } from './FormatSettings'
import { comparisonWith, opponentChoices } from './tournamentView'

const TABS = [
  { key: 'pools', label: 'Pools' },
  { key: 'opponent', label: 'Adversaire' },
  { key: 'prep', label: 'Préparation' },
  { key: 'matches', label: 'Matchs' }
]

function CreateForm(props: { onCreated: (id: string) => void }): React.JSX.Element {
  const [name, setName] = useState('')
  const [mode, setMode] = useState('taiko')

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (!name.trim()) return
    const id = await window.api.createTournament(name, mode)
    setName('')
    props.onCreated(id)
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-1 border-b border-line pb-4">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nouveau tournoi…"
        aria-label="Nom du tournoi"
        className="w-full rounded-lg bg-panel px-3 py-2 text-sm"
      />
      <div className="flex gap-1">
        {MODES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={mode === key}
            onClick={() => setMode(key)}
            className={`flex flex-1 items-center justify-center rounded-lg py-2 ${
              mode === key ? 'bg-panel-raised text-accent' : 'bg-panel text-ink-soft hover:text-ink'
            }`}
          >
            <ModeIcon mode={key} />
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={!name.trim()}
        className="w-full rounded-lg bg-accent py-2 text-sm font-semibold text-page disabled:opacity-50"
      >
        Créer le tournoi
      </button>
    </form>
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

function TournamentView(props: { tournamentId: string; onDeleted: () => void }): React.JSX.Element {
  const { tournamentId } = props
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'pools'
  const [loaded, setData] = useState<TournamentData | null | undefined>(undefined)
  const [version, setVersion] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // New plays change the training shown.
  const results = useTracking((state) => state.status?.totalResults)
  const reload = (): void => setVersion((current) => current + 1)

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
  const standings = tournamentStandings(data.matches, tournament)
  const opponents = opponentChoices(standings, data.me?.userId ?? null, tournament.nextOpponentId)

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <TournamentTitle
            tournament={tournament}
            onRename={(name) =>
              window.api.updateTournament(tournament.id, { name }).then(reload).catch(console.error)
            }
          />
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-ink-soft">
            <ModeIcon mode={tournament.mode} />
            {modeLabel(tournament.mode)} · {data.pools.length} pool
            {data.pools.length > 1 ? 's' : ''} · {data.matches.length} match
            {data.matches.length > 1 ? 's' : ''} importé
            {data.matches.length > 1 ? 's' : ''}
          </p>
          <FormatSettings
            tournament={tournament}
            standings={standings}
            meId={data.me?.userId ?? null}
            onChange={reload}
          />
        </div>
        {confirmDelete ? (
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <span>Supprimer ce tournoi, ses pools et ses matchs ?</span>
            <button
              onClick={() =>
                window.api
                  .deleteTournament(tournament.id)
                  .then(props.onDeleted)
                  .catch(console.error)
              }
              className="rounded-lg bg-failed px-3 py-1.5 font-semibold text-page"
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
            Supprimer le tournoi
          </button>
        )}
      </div>

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

      {tab === 'pools' && <PoolsTab data={data} onChange={reload} />}
      {tab === 'opponent' && (
        <OpponentTab
          data={data}
          rounds={rounds}
          opponents={opponents}
          opponentId={tournament.nextOpponentId}
          onOpponentChange={(nextOpponentId) =>
            window.api
              .updateTournament(tournament.id, { nextOpponentId })
              .then(reload)
              .catch(console.error)
          }
        />
      )}
      {tab === 'prep' && (
        <PrepTab data={data} opponents={opponents} comparison={comparison} onChange={reload} />
      )}
      {tab === 'matches' && (
        <MatchesTab data={data} rounds={rounds} standings={standings} onChange={reload} />
      )}
    </div>
  )
}

export function TournamentsPage(): React.JSX.Element {
  const { tournamentId } = useParams()
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null)
  const [version, setVersion] = useState(0)

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
        <CreateForm onCreated={(id) => navigate(`/tournaments/${id}`)} />
        <h2 className="mb-2 px-2 text-sm font-semibold text-ink-soft">Mes tournois</h2>
        {tournaments?.map((tournament) => (
          <Link
            key={tournament.id}
            to={`/tournaments/${tournament.id}`}
            title={modeLabel(tournament.mode)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              tournament.id === tournamentId ? 'bg-panel-raised font-semibold' : 'hover:bg-panel'
            }`}
          >
            <ModeIcon mode={tournament.mode} className="size-4 shrink-0 text-ink-soft" />
            <span className="truncate">{tournament.name}</span>
          </Link>
        ))}
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-8">
        {tournaments?.length === 0 && (
          <div>
            <h1 className="text-3xl font-bold">Tournois</h1>
            <p className="mt-2 max-w-2xl text-ink-soft">
              Prépare tes tournois : crée-en un à gauche, ajoute ses pools pour suivre ton
              entraînement map par map, importe les matchs (tes qualifs, celles de tes adversaires)
              pour te comparer à eux, puis prépare tes bans, tes choix et ton échauffement.
            </p>
          </div>
        )}
        {tournamentId && (
          <TournamentView
            key={tournamentId}
            tournamentId={tournamentId}
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
