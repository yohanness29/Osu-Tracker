import { useState } from 'react'
import type { PlayerStanding } from '@osu-tracker/stats'
import { playerLabel } from './tournamentView'

const SOURCES: Record<PlayerStanding['decidedBy'], string> = {
  hand: 'à la main',
  bracket: 'bracket',
  matches: 'matchs importés'
}

/**
 * Every player met, in or out: what the bracket or the matches say, which a click turns into a
 * choice by hand. For brackets kept elsewhere than on Challonge, or forfeits nothing shows.
 */
export function PlayersSection(props: {
  tournamentId: string
  standings: PlayerStanding[]
  meId: number | null
  hasBracket: boolean
  onChange: () => void
}): React.JSX.Element {
  const { standings, meId } = props
  const [open, setOpen] = useState(false)
  const left = standings.filter(({ eliminated }) => !eliminated).length
  const setStatus = (userId: number, eliminated: boolean | null): void => {
    window.api
      .setPlayerStatus(props.tournamentId, userId, eliminated)
      .then(props.onChange)
      .catch(console.error)
  }

  return (
    <section className="rounded-xl bg-panel p-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className="mt-0.5 text-ink-soft">{open ? '▾' : '▸'}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">
            Joueurs{' '}
            <span className="font-normal text-ink-soft">
              · {left} en lice sur {standings.length}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            {props.hasBracket
              ? 'Le bracket Challonge dit qui est éliminé. Clique sur un statut pour le corriger à la main.'
              : 'Sans bracket Challonge, les éliminations viennent des matchs importés : un forfait n’y apparaît pas. Clique sur un statut pour le changer à la main.'}
          </p>
        </div>
      </button>

      {open && (
        <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-1.5 text-sm">
          {standings.map((player) => (
            <li
              key={player.userId}
              className="flex items-center gap-2 rounded-lg bg-page/40 px-3 py-1.5"
            >
              <span
                className={`min-w-0 flex-1 truncate ${player.eliminated ? 'text-ink-soft line-through' : ''}`}
              >
                {player.userId === meId ? `${playerLabel(player)} (toi)` : playerLabel(player)}
              </span>
              <button
                type="button"
                onClick={() => setStatus(player.userId, !player.eliminated)}
                title={`Décidé par : ${SOURCES[player.decidedBy]}. Clique pour le marquer ${
                  player.eliminated ? 'en lice' : 'éliminé'
                }.`}
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                  player.eliminated
                    ? 'bg-failed/15 text-failed hover:bg-failed/25'
                    : 'bg-passed/15 text-passed hover:bg-passed/25'
                }`}
              >
                {player.eliminated ? 'Éliminé' : 'En lice'}
              </button>
              {player.decidedBy === 'hand' && (
                <button
                  type="button"
                  onClick={() => setStatus(player.userId, null)}
                  title="Oublier ce choix : le bracket ou les matchs décident de nouveau"
                  aria-label={`Oublier le choix fait pour ${player.username}`}
                  className="shrink-0 rounded px-1 text-xs text-ink-soft hover:text-ink"
                >
                  ↺
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
