import { useState } from 'react'
import { compareOpponent, type MatchRound, type PlayerStanding } from '@osu-tracker/stats'
import type { TournamentData } from '../../../../main/tournaments'
import { Dropdown } from '../../shared/Dropdown'
import { CATEGORY_COLORS, percent, playerLabel } from './tournamentView'

type Result = { accuracy: number; misses: number } | null

function result(value: Result): string {
  if (!value) return '–'
  return `${percent(value.accuracy)} · ${value.misses.toFixed(1).replace('.0', '')} miss`
}

/** Who did better over a mod: the higher accuracy, the fewer misses when they are close. */
function better(mine: Result, theirs: Result): 'me' | 'them' | null {
  if (!mine || !theirs) return null
  if (Math.abs(mine.accuracy - theirs.accuracy) >= 0.05) {
    return mine.accuracy > theirs.accuracy ? 'me' : 'them'
  }
  if (mine.misses === theirs.misses) return null
  return mine.misses < theirs.misses ? 'me' : 'them'
}

/** −19 % when the player's scores are 81 % of the opponent's, +3 % when above. */
function formatGap(ratio: number): string {
  const gap = Math.round((ratio - 1) * 100)
  return gap === 0 ? '≈ égal' : `${gap > 0 ? '+' : '−'}${Math.abs(gap)} %`
}

function ResultCell(props: { value: Result; ahead: boolean }): React.JSX.Element {
  return (
    <td className={`py-2 pr-3 ${props.ahead ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
      {result(props.value)}
    </td>
  )
}

/** A player of the tournament next to the player: by mods, then map by map. */
export function ScoutingTab(props: {
  data: TournamentData
  rounds: MatchRound[]
  /** Those still in the tournament, by seed. */
  opponents: PlayerStanding[]
  onOpponentChange: (userId: number) => void
}): React.JSX.Element {
  const { data, rounds, opponents } = props
  const nextOpponentId = data.tournament.nextOpponentId
  // Any player can be looked at without becoming the next opponent.
  const [playerId, setPlayerId] = useState<number | null>(nextOpponentId)
  // A round key: the id of its pool, '' for the matches out of every pool.
  const [roundKey, setRoundKey] = useState<string | null>(null)

  if (!data.me) {
    return (
      <p className="text-ink-soft">
        Relie ton compte osu! dans le profil : l’app a besoin de savoir qui tu es pour te comparer
        aux autres joueurs.
      </p>
    )
  }
  if (data.matches.length === 0) {
    return (
      <p className="text-ink-soft">
        Importe d’abord des matchs dans l’onglet Résultats : les qualifs, et les matchs des joueurs
        à observer.
      </p>
    )
  }

  const roundOf = (round: MatchRound): string => round.pool?.id ?? ''
  const round = rounds.find((candidate) => roundOf(candidate) === roundKey)
  const comparison =
    playerId === null
      ? null
      : compareOpponent(round ? round.matches : data.matches, data.me.userId, playerId)
  const player = opponents.find(({ userId }) => userId === playerId)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Dropdown
          single
          label="Joueur"
          placeholder="Choisis un joueur"
          selected={playerId === null ? [] : [String(playerId)]}
          onChange={([value]) => setPlayerId(value ? Number(value) : null)}
          options={opponents.map((candidate) => ({
            value: String(candidate.userId),
            label:
              candidate.userId === nextOpponentId
                ? `${playerLabel(candidate)} ★`
                : playerLabel(candidate)
          }))}
        />
        {rounds.length > 1 && (
          <Dropdown
            single
            label="Round"
            placeholder="Tous"
            selected={round ? [roundOf(round)] : []}
            onChange={([value]) => setRoundKey(value ?? null)}
            options={rounds.map((candidate) => ({
              value: roundOf(candidate),
              label: candidate.pool?.name ?? 'Hors pools'
            }))}
          />
        )}
        {playerId !== null && playerId === nextOpponentId && (
          <span className="rounded-md bg-accent/15 px-2 py-1 text-xs font-semibold text-accent">
            ★ Ton prochain adversaire
          </span>
        )}
        {playerId !== null && playerId !== nextOpponentId && (
          <button
            onClick={() => props.onOpponentChange(playerId)}
            className="rounded-lg bg-panel px-3 py-1.5 text-sm hover:bg-panel-raised"
          >
            En faire mon prochain adversaire
          </button>
        )}
      </div>

      {playerId === null && (
        <p className="mt-5 text-ink-soft">
          Choisis un joueur pour comparer vos scores, mod par mod et map par map.
        </p>
      )}
      {comparison && comparison.maps.length === 0 && (
        <p className="mt-5 text-ink-soft">
          {round ? 'Aucun de vous deux n’a joué dans ce round.' : 'Aucun score à comparer.'}
        </p>
      )}

      {comparison && comparison.maps.length > 0 && (
        <>
          <h3 className="mt-6 font-semibold">Par mod</h3>
          <table className="mt-2 w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-ink-soft">
                <th className="pb-2 font-medium">Mod</th>
                <th className="pb-2 font-medium">Toi</th>
                <th className="pb-2 font-medium">{player?.username ?? 'Lui'}</th>
                <th
                  className="pb-2 text-right font-medium"
                  title="Ton score comparé au sien, en moyenne, sur les maps que vous avez jouées tous les deux"
                >
                  Écart de score
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.categories.map((category) => {
                const ratio = category.scoreRatio
                const ahead = better(category.mine, category.theirs)
                return (
                  <tr key={category.category} className="border-t border-line">
                    <td
                      className="py-2 font-bold"
                      style={{ color: CATEGORY_COLORS[category.category] }}
                    >
                      {category.category}
                    </td>
                    <ResultCell value={category.mine} ahead={ahead === 'me'} />
                    <ResultCell value={category.theirs} ahead={ahead === 'them'} />
                    <td
                      className={`py-2 text-right font-semibold ${
                        ratio === null
                          ? ''
                          : ratio >= 1
                            ? 'text-passed'
                            : ratio < 0.9
                              ? 'text-failed'
                              : ''
                      }`}
                      title={
                        ratio === null
                          ? 'Aucune map jouée par vous deux'
                          : `${formatGap(ratio)} en moyenne sur ${category.common} map${category.common > 1 ? 's' : ''} jouée${category.common > 1 ? 's' : ''} par vous deux`
                      }
                    >
                      {ratio === null ? '–' : formatGap(ratio)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <h3 className="mt-6 font-semibold">Map par map</h3>
          <table className="mt-2 w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-ink-soft">
                <th className="pb-2 font-medium">Map</th>
                <th className="w-44 pb-2 font-medium">Toi</th>
                <th className="w-44 pb-2 font-medium">{player?.username ?? 'Lui'}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.maps.map((map) => {
                // On a map, the score decides who wins it.
                const ahead =
                  map.mine && map.theirs && map.mine.score !== map.theirs.score
                    ? map.mine.score > map.theirs.score
                      ? 'me'
                      : 'them'
                    : null
                return (
                  <tr key={`${map.beatmapId}-${map.category}`} className="border-t border-line">
                    <td className="max-w-0 truncate py-2 pr-3">
                      <span
                        className="mr-2 text-xs font-bold"
                        style={{ color: CATEGORY_COLORS[map.category] }}
                      >
                        {map.category}
                      </span>
                      {map.title}
                    </td>
                    <ResultCell value={map.mine} ahead={ahead === 'me'} />
                    <ResultCell value={map.theirs} ahead={ahead === 'them'} />
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-faint">
            En gras, le meilleur des deux : à la précision par mod, au score sur chaque map. En
            qualifs, chacun ne joue qu’une ou deux fois chaque map : un mauvais score peut n’être
            qu’une mauvaise partie.
          </p>
        </>
      )}
    </div>
  )
}
