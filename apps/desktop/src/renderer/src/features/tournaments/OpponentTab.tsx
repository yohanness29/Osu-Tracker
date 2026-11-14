import { useState } from 'react'
import { compareOpponent, type MatchRound, type PlayerStanding } from '@osu-tracker/stats'
import type { TournamentData } from '../../../../main/tournaments'
import { Dropdown } from '../../shared/Dropdown'
import { CATEGORY_COLORS, percent, playerLabel } from './tournamentView'

function result(value: { accuracy: number; misses: number } | null, digits = 2): string {
  if (!value) return '–'
  return `${percent(value.accuracy, digits)} · ${value.misses.toFixed(1).replace('.0', '')} miss`
}

export function OpponentTab(props: {
  data: TournamentData
  rounds: MatchRound[]
  /** Those still in the tournament, by seed. */
  opponents: PlayerStanding[]
  opponentId: number | null
  onOpponentChange: (userId: number | null) => void
}): React.JSX.Element {
  const { data, rounds, opponents: players, opponentId } = props
  // A round key: the id of its pool, '' for the matches out of every pool.
  const [roundKey, setRoundKey] = useState<string | null>(null)
  if (!data.me) {
    return (
      <p className="text-ink-soft">
        Relie ton compte osu! dans le profil : l’app a besoin de savoir qui tu es pour te comparer à
        un adversaire.
      </p>
    )
  }

  if (data.matches.length === 0) {
    return (
      <p className="text-ink-soft">
        Importe d’abord des matchs dans l’onglet Matchs : tes qualifs et celles de ton adversaire,
        ou un match contre lui.
      </p>
    )
  }

  const roundOf = (round: MatchRound): string => round.pool?.id ?? ''
  const round = rounds.find((candidate) => roundOf(candidate) === roundKey)
  const matches = round ? round.matches : data.matches
  const comparison =
    opponentId === null ? null : compareOpponent(matches, data.me.userId, opponentId)

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <Dropdown
          single
          label="Adversaire"
          placeholder="Choisis un joueur"
          selected={opponentId === null ? [] : [String(opponentId)]}
          onChange={([value]) => props.onOpponentChange(value ? Number(value) : null)}
          options={players.map((player) => ({
            value: String(player.userId),
            label: `${playerLabel(player)} (${player.games} map${player.games > 1 ? 's' : ''})`
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
      </div>
      {comparison && comparison.maps.length === 0 && (
        <p className="mt-5 text-ink-soft">Aucun de vous deux n’a joué dans ce round.</p>
      )}

      {comparison && comparison.maps.length > 0 && (
        <>
          <table className="mt-5 w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-xs text-ink-soft">
                <th className="pb-2 font-medium">Mods</th>
                <th className="pb-2 font-medium">Toi</th>
                <th className="pb-2 font-medium">Lui</th>
                <th className="pb-2 font-medium">Maps en commun</th>
                <th className="pb-2 text-right font-medium">Ton score / le sien</th>
              </tr>
            </thead>
            <tbody>
              {comparison.categories.map((category) => {
                const ratio = category.scoreRatio
                return (
                  <tr key={category.category} className="border-t border-line">
                    <td
                      className="py-2 font-bold"
                      style={{ color: CATEGORY_COLORS[category.category] }}
                    >
                      {category.category}
                    </td>
                    <td className="py-2">{result(category.mine)}</td>
                    <td className="py-2">{result(category.theirs)}</td>
                    <td className="py-2">{category.common}</td>
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
                    >
                      {ratio === null ? '–' : `${Math.round(ratio * 100)} %`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <h3 className="mt-6 font-semibold">Map par map</h3>
          <ul className="mt-2 space-y-1 text-sm tabular-nums">
            {comparison.maps.map((map) => (
              <li
                key={`${map.beatmapId}-${map.category}`}
                className="flex items-center gap-3 rounded-lg bg-panel px-3 py-2"
              >
                <span
                  className="w-8 text-xs font-bold"
                  style={{ color: CATEGORY_COLORS[map.category] }}
                >
                  {map.category}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {map.title} [{map.version}]
                </span>
                <span className="w-44 text-right">{result(map.mine)}</span>
                <span className="w-44 text-right text-ink-soft">{result(map.theirs)}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-ink-soft">
            Attention : en qualifs, chaque joueur ne fait qu’une tentative par map. Un mauvais score
            peut n’être qu’une mauvaise partie, pas une vraie faiblesse. Plus tu importes de matchs,
            plus la comparaison est fiable.
          </p>
        </>
      )}
    </div>
  )
}
