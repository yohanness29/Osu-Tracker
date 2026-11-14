import { planMatch, planWarmup, type SlotAdvice } from '@osu-tracker/recommender'
import type { OpponentComparison, PlayerStanding } from '@osu-tracker/stats'
import type { TournamentUpdate } from '@osu-tracker/storage'
import type { TournamentData } from '../../../../main/tournaments'
import { Dropdown } from '../../shared/Dropdown'
import { opponentLevel, playerLabel, trainedSlots } from './tournamentView'

const DEFAULT_BANS = 1

function NumberField(props: {
  label: string
  value: number | null
  placeholder: string
  onChange: (value: number | null) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 rounded-md bg-panel px-3 py-1.5 text-sm">
      <span className="text-ink-soft">{props.label}</span>
      <input
        type="number"
        min={0}
        max={13}
        value={props.value ?? ''}
        placeholder={props.placeholder}
        onChange={(event) =>
          props.onChange(event.target.value === '' ? null : Number(event.target.value))
        }
        className="w-14 rounded bg-panel-raised px-2 py-0.5 tabular-nums"
      />
    </label>
  )
}

function AdviceList(props: {
  title: string
  advice: SlotAdvice[]
  note?: string
  color: string
}): React.JSX.Element {
  return (
    <section className="rounded-xl bg-panel p-4">
      <h3 className="font-semibold" style={{ color: props.color }}>
        {props.title}
      </h3>
      {props.note && <p className="mt-1 text-xs text-ink-soft">{props.note}</p>}
      <ol className="mt-2 space-y-2 text-sm">
        {props.advice.map((entry, index) => (
          <li key={entry.slot} className="flex gap-3">
            <span className="w-4 shrink-0 text-ink-soft tabular-nums">{index + 1}.</span>
            <div className="min-w-0">
              <div>
                <span className="font-bold">{entry.slot}</span> {entry.title}
                {entry.backup && (
                  <span className="text-ink-soft"> · si bannie → {entry.backup}</span>
                )}
              </div>
              <div className="text-xs text-ink-soft">{entry.reason}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function PrepTab(props: {
  data: TournamentData
  /** Those still in the tournament, by seed. */
  opponents: PlayerStanding[]
  comparison: OpponentComparison | null
  onChange: () => void
}): React.JSX.Element {
  const { data, opponents: players, comparison, onChange } = props
  const { tournament } = data
  const update = (changes: TournamentUpdate): void => {
    window.api.updateTournament(tournament.id, changes).then(onChange).catch(console.error)
  }

  const pool =
    data.pools.find(({ id }) => id === tournament.nextPoolId) ?? data.pools.at(-1) ?? null
  const slots = pool ? trainedSlots(pool, data.plays) : []
  const bans = tournament.bans ?? DEFAULT_BANS
  const plan = pool ? planMatch(slots, opponentLevel(comparison), bans) : null
  const warmup = planWarmup(slots)
  const opponentName = players.find(({ userId }) => userId === tournament.nextOpponentId)?.username

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <NumberField
          label="Bans par joueur"
          value={tournament.bans}
          placeholder={String(DEFAULT_BANS)}
          onChange={(value) => update({ bans: value })}
        />
        <NumberField
          label="Best of"
          value={tournament.bestOf}
          placeholder="9"
          onChange={(value) => update({ bestOf: value })}
        />
        <Dropdown
          single
          label="Pool du match"
          placeholder={pool?.name ?? 'Aucun'}
          selected={tournament.nextPoolId ? [tournament.nextPoolId] : []}
          onChange={([value]) => update({ nextPoolId: value ?? null })}
          options={data.pools.map(({ id, name }) => ({ value: id, label: name }))}
        />
        <Dropdown
          single
          label="Adversaire"
          placeholder="Aucun"
          selected={tournament.nextOpponentId ? [String(tournament.nextOpponentId)] : []}
          onChange={([value]) => update({ nextOpponentId: value ? Number(value) : null })}
          options={players.map((player) => ({
            value: String(player.userId),
            label: playerLabel(player)
          }))}
        />
      </div>

      {!pool && (
        <p className="mt-6 text-ink-soft">
          Ajoute le pool du match dans l’onglet Pools pour préparer tes bans et tes choix.
        </p>
      )}

      {plan && (
        <>
          <p className="mt-4 text-sm text-ink-soft">
            {comparison && opponentName
              ? `Le plan compare ton entraînement sur ${pool!.name} au niveau de ${opponentName} dans ses matchs importés.`
              : 'Sans adversaire choisi, le plan compare les maps à ton propre niveau : choisis-le pour un plan plus précis.'}{' '}
            Le tiebreak n’est jamais banni ni choisi.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <AdviceList
              title={bans > 1 ? 'Tes bans' : 'Ta ban'}
              advice={plan.bans}
              note="Là où tu risques de perdre le plus : un score bas, ou des résultats instables."
              color="var(--color-failed)"
            />
            <AdviceList
              title="Tes choix, dans l’ordre"
              advice={plan.picks}
              note="Là où tu as le plus d’avance, avec une map de secours si elle est bannie."
              color="var(--color-passed)"
            />
            <AdviceList
              title="Ce qu’il risque de choisir"
              advice={plan.theirPicks}
              note="Là où il a le plus d’avance sur toi : prépare-toi à les jouer pour limiter l’écart."
              color="#ffd166"
            />
          </div>
        </>
      )}

      {warmup.length > 0 && (
        <section className="mt-6 max-w-xl rounded-xl bg-panel p-4">
          <h3 className="font-semibold">Échauffement</h3>
          <p className="mt-1 text-xs text-ink-soft">
            Après 10 minutes de maps faciles. Chaque map une seule fois : si l’une se passe mal,
            passe à la suivante.
          </p>
          <ol className="mt-2 space-y-1.5 text-sm">
            {warmup.map((entry) => (
              <li key={entry.slot}>
                <span className="font-bold">{entry.slot}</span> {entry.title}
                <div className="text-xs text-ink-soft">{entry.why}</div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
