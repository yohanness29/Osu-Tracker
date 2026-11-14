import type { PlayerStanding } from '@osu-tracker/stats'
import type { Tournament, TournamentUpdate } from '@osu-tracker/storage'

const QUALIFIED_CHOICES = [
  { value: 16, label: '16' },
  { value: 32, label: '32' },
  { value: 64, label: '64' },
  { value: 128, label: '128' },
  { value: null, label: 'Tous' }
]

/** How the tournament runs: who the qualifiers keep, and whether a loss is final. */
export function FormatSettings(props: {
  tournament: Tournament
  standings: PlayerStanding[]
  meId: number | null
  onChange: () => void
}): React.JSX.Element {
  const { tournament, standings, meId } = props
  const update = (changes: TournamentUpdate): void => {
    window.api.updateTournament(tournament.id, changes).then(props.onChange).catch(console.error)
  }
  const me = standings.find(({ userId }) => userId === meId)
  const seeded = standings.some(({ seed }) => seed !== null)
  const left = standings.filter(({ eliminated }) => !eliminated).length

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      <div className="flex items-center gap-2 rounded-md bg-panel py-1 pr-1 pl-3">
        <span className="text-ink-soft">Qualifiés après les qualifs</span>
        <div className="flex gap-0.5" role="radiogroup" aria-label="Qualifiés après les qualifs">
          {QUALIFIED_CHOICES.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={tournament.qualifiedCount === value}
              onClick={() => update({ qualifiedCount: value })}
              className={`rounded px-2 py-0.5 tabular-nums ${
                tournament.qualifiedCount === value
                  ? 'bg-accent font-semibold text-page'
                  : 'text-ink-soft hover:bg-panel-raised hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 rounded-md bg-panel px-3 py-1.5">
        <input
          type="checkbox"
          checked={tournament.loserBracket}
          onChange={(event) => update({ loserBracket: event.target.checked })}
          className="accent-accent"
        />
        <span>Loser bracket</span>
      </label>
      {seeded && (
        <span className="text-ink-soft">
          {me?.seed != null && (
            <>
              Ton seed : <span className="font-semibold text-ink">{me.seed}</span>
              {me.eliminated ? ' · éliminé' : me.losses > 0 ? ' · en loser bracket' : ''} ·{' '}
            </>
          )}
          {left} joueur{left > 1 ? 's' : ''} encore en lice
        </span>
      )}
    </div>
  )
}
