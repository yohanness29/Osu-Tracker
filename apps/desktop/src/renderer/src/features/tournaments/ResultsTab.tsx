import { useState } from 'react'
import {
  categoryOfMods,
  headToHead,
  playersMet,
  reviewMatch,
  type LossReason,
  type MatchRound,
  type MatchReview,
  type PlayerStanding
} from '@osu-tracker/stats'
import type { TournamentMatch } from '@osu-tracker/storage'
import type { TournamentData } from '../../../../main/tournaments'
import { Dropdown } from '../../shared/Dropdown'
import { errorMessage } from '../../shared/errors'
import { CATEGORY_COLORS, percent, playerLabel } from './tournamentView'

const LOSS_REASONS: Record<LossReason, string> = {
  combo: 'perdue au combo, malgré une meilleure précision',
  misses: 'perdue sur les misses',
  accuracy: 'perdue sur la précision'
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** A lobby of several players, like qualifiers: every score, map by map. */
function LobbyTable(props: {
  match: TournamentMatch
  meId: number | null
  highlightId: number | null
}): React.JSX.Element {
  const { match, meId, highlightId } = props
  const players = [
    ...new Map(match.scores.map(({ userId, username }) => [userId, username])).entries()
  ]
  const games = [...Map.groupBy(match.scores, ({ gameId }) => gameId).values()]
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-xs text-ink-soft">
            <th className="pb-1 font-medium">Map</th>
            {players.map(([userId, username]) => (
              <th
                key={userId}
                className={`pb-1 pl-3 text-right font-medium ${
                  userId === highlightId || userId === meId ? 'text-ink' : ''
                }`}
              >
                {userId === meId ? 'Toi' : username}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {games.map((scores) => {
            const first = scores[0]!
            const top = Math.max(...scores.map(({ score }) => score))
            const category = categoryOfMods(first.mods)
            return (
              <tr key={first.gameId} className="border-t border-line">
                <td className="max-w-64 truncate py-1.5 pr-3">
                  <span
                    className="mr-2 text-xs font-bold"
                    style={{ color: CATEGORY_COLORS[category] }}
                  >
                    {category}
                  </span>
                  {first.title}
                </td>
                {players.map(([userId]) => {
                  const own = scores.find((score) => score.userId === userId)
                  return (
                    <td
                      key={userId}
                      title={own ? `${percent(own.accuracy)} · ${own.misses} miss` : undefined}
                      className={`py-1.5 pl-3 text-right ${
                        own?.score === top ? 'font-semibold text-passed' : ''
                      } ${userId === highlightId || userId === meId ? '' : 'text-ink-soft'}`}
                    >
                      {own ? own.score.toLocaleString('fr-FR') : '–'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MatchCard(props: {
  match: TournamentMatch
  meId: number | null
  highlightId: number | null
  onDelete: () => void
}): React.JSX.Element {
  const { match, meId } = props
  const [open, setOpen] = useState(false)
  const played = meId !== null && match.scores.some(({ userId }) => userId === meId)
  const others = meId === null ? [] : playersMet([match], meId)
  // A head-to-head match: the player's own, or one between two others. Lobbies have no score.
  const duel = ((): { left: string; review: MatchReview } | null => {
    if (played && others.length === 1) {
      const review = reviewMatch(match, meId!)
      return review && { left: 'Toi', review }
    }
    if (played) return null
    const between = headToHead(match)
    return between && { left: between.player.username, review: between.review }
  })()
  const review = duel?.review ?? null
  const games = new Set(match.scores.map(({ gameId }) => gameId)).size

  return (
    <li className="rounded-xl bg-panel p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 gap-2">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? 'Replier le match' : 'Déplier le match'}
            className="text-ink-soft hover:text-ink"
          >
            {open ? '▾' : '▸'}
          </button>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="block max-w-full truncate text-left font-semibold hover:text-accent"
            >
              {match.name}
            </button>
            <div className="text-xs text-ink-soft">
              {formatDate(match.startedAt)} · {games} map{games > 1 ? 's' : ''} ·{' '}
              <a
                href={`https://osu.ppy.sh/community/matches/${match.osuMatchId}`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-accent"
              >
                voir sur osu!
              </a>
            </div>
          </div>
        </div>
        {review && played && (
          <span
            className={`shrink-0 rounded-lg px-3 py-1 text-sm font-bold ${
              review.wins > review.losses ? 'bg-passed text-on-accent' : 'bg-panel-raised'
            }`}
          >
            {review.wins} – {review.losses} contre {review.opponent.username}
          </span>
        )}
        {duel && !played && (
          <span className="shrink-0 rounded-lg bg-panel-raised px-3 py-1 text-sm tabular-nums">
            <span className={duel.review.wins > duel.review.losses ? 'font-bold' : 'text-ink-soft'}>
              {duel.left} {duel.review.wins}
            </span>{' '}
            –{' '}
            <span className={duel.review.losses > duel.review.wins ? 'font-bold' : 'text-ink-soft'}>
              {duel.review.losses} {duel.review.opponent.username}
            </span>
          </span>
        )}
        {/* Only on an opened match: fewer buttons in the list. */}
        {open && (
          <button
            onClick={props.onDelete}
            className="shrink-0 text-xs text-ink-soft hover:text-failed"
          >
            Retirer
          </button>
        )}
      </div>

      {open && duel && review && (
        <table className="mt-3 w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-ink-soft">
              <th className="pb-1 font-medium">Map</th>
              <th className="pb-1 font-medium">{duel.left}</th>
              <th className="pb-1 font-medium">{review.opponent.username}</th>
              <th className="pb-1 text-right font-medium">Écart</th>
            </tr>
          </thead>
          <tbody>
            {review.games.map((game) => (
              <tr key={game.gameId} className="border-t border-line align-top">
                <td className="py-1.5 pr-3">
                  <span
                    className="mr-2 text-xs font-bold"
                    style={{ color: CATEGORY_COLORS[game.category] }}
                  >
                    {game.category}
                  </span>
                  {game.title}
                  {played && !game.won && game.lossReason && (
                    <div className="text-xs text-ink-soft">{LOSS_REASONS[game.lossReason]}</div>
                  )}
                </td>
                <td className="py-1.5 pr-3">
                  {percent(game.mine.accuracy)} · {game.mine.misses} miss
                </td>
                <td className="py-1.5 pr-3">
                  {percent(game.theirs.accuracy)} · {game.theirs.misses} miss
                </td>
                <td
                  className={`py-1.5 text-right font-semibold ${
                    !played ? '' : game.won ? 'text-passed' : 'text-failed'
                  }`}
                >
                  {game.gap > 0 ? '+' : ''}
                  {game.gap.toLocaleString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && !duel && <LobbyTable match={match} meId={meId} highlightId={props.highlightId} />}
    </li>
  )
}

/** One round, folded when it holds many lobbies, like qualifiers. */
function RoundSection(props: {
  round: MatchRound
  meId: number | null
  highlightId: number | null
  onChange: () => void
}): React.JSX.Element {
  const { round, meId, onChange } = props
  const played = (match: TournamentMatch): boolean =>
    meId !== null && match.scores.some(({ userId }) => userId === meId)
  // Opened when filtered on a player, or when short or holding the player's matches.
  const [open, setOpen] = useState(
    props.highlightId !== null || round.matches.length <= 3 || round.matches.some(played)
  )
  const matches = round.matches.toSorted((a, b) => b.startedAt - a.startedAt)
  const count = round.matches.length

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-baseline gap-3 border-b border-line pb-1 text-left"
      >
        <span className="text-ink-soft">{open ? '▾' : '▸'}</span>
        <h3 className="text-lg font-semibold">{round.pool?.name ?? 'Hors pools'}</h3>
        <span className="text-sm text-ink-soft">
          {count} match{count > 1 ? 's' : ''}
        </span>
      </button>
      {!round.pool && open && (
        <p className="mt-2 text-xs text-ink-soft">
          Aucun pool ajouté ne correspond à ces matchs : ajoute leur pool pour les ranger dans leur
          round.
        </p>
      )}
      {open && (
        <ul className="mt-3 space-y-3">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              meId={meId}
              highlightId={props.highlightId}
              onDelete={() => window.api.deleteMatch(match.id).then(onChange).catch(console.error)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/** The matches played: imported by their link, by round, newest first. */
export function ResultsTab(props: {
  data: TournamentData
  rounds: MatchRound[]
  /** Every player met, by seed. */
  standings: PlayerStanding[]
  onChange: () => void
}): React.JSX.Element {
  const { data, rounds, standings, onChange } = props
  const meId = data.me?.userId ?? null
  const [playerId, setPlayerId] = useState<number | null>(null)
  const shown = rounds.flatMap((round) => {
    if (playerId === null) return [round]
    const matches = round.matches.filter(({ scores }) =>
      scores.some(({ userId }) => userId === playerId)
    )
    return matches.length > 0 ? [{ ...round, matches }] : []
  })
  const players = standings.toSorted(
    (a, b) => Number(b.userId === meId) - Number(a.userId === meId)
  )
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const result = await window.api.importMatch(data.tournament.id, link)
      setMessage(
        `${result.name} importé : ${result.games} map${result.games > 1 ? 's' : ''}` +
          (result.warmups > 0
            ? `, ${result.warmups} échauffement${result.warmups > 1 ? 's' : ''} ignoré${result.warmups > 1 ? 's' : ''}.`
            : '.')
      )
      setLink('')
      onChange()
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={submit} className="flex min-w-80 flex-1 gap-2">
          <input
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="Lien d’un match à importer : https://osu.ppy.sh/community/matches/…"
            aria-label="Lien du match"
            title="Les qualifs, tes matchs et ceux des autres joueurs. Les maps d’échauffement sont ignorées."
            className="min-w-0 flex-1 rounded-lg bg-panel px-4 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !link.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60"
          >
            {busy ? 'Import…' : 'Importer'}
          </button>
        </form>
        {players.length > 0 && (
          <Dropdown
            single
            label="Joueur"
            placeholder="Tous"
            selected={playerId === null ? [] : [String(playerId)]}
            onChange={([value]) => setPlayerId(value ? Number(value) : null)}
            options={players.map((player) => ({
              value: String(player.userId),
              label:
                player.userId === meId
                  ? `Toi${player.seed === null ? '' : ` (#${player.seed})`}`
                  : playerLabel(player)
            }))}
          />
        )}
      </div>
      {message && <p className="mt-2 text-sm">{message}</p>}
      {!data.me && (
        <p className="mt-3 text-sm">
          Relie ton compte osu! dans le profil pour que l’app retrouve tes scores dans les matchs.
        </p>
      )}
      {data.matches.length === 0 && (
        <p className="mt-5 text-ink-soft">
          Aucun match importé. Colle le lien d’un match pour l’ajouter : les qualifs, tes matchs et
          ceux des autres joueurs. Chacun est rangé dans le round de son pool.
        </p>
      )}

      {shown.map((round) => (
        <RoundSection
          key={`${round.pool?.id ?? ''}-${playerId ?? ''}`}
          round={round}
          meId={meId}
          highlightId={playerId}
          onChange={onChange}
        />
      ))}
    </div>
  )
}
