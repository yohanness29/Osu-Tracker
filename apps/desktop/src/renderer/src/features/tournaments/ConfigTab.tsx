import { useState } from 'react'
import { isQualifierPool, type PlayerStanding } from '@osu-tracker/stats'
import type { PoolUpdate, TournamentUpdate } from '@osu-tracker/storage'
import type { TournamentData } from '../../../../main/tournaments'
import { Choices } from '../../shared/Choices'
import { ChallongeField } from './BracketTab'
import { PlayersSection } from './PlayersSection'
import { Dropdown } from '../../shared/Dropdown'
import { Switch } from '../../shared/Switch'
import { formatLabel, playerLabel } from './tournamentView'

export const DEFAULT_BANS = 1
// Matches are won by the first to (best of + 1) / 2 points.
const BEST_OF = [3, 5, 7, 9, 11, 13, 15]
const BANS = [0, 1, 2, 3]
const QUALIFIED_CHOICES = [
  { value: 16, label: '16' },
  { value: 32, label: '32' },
  { value: 64, label: '64' },
  { value: 128, label: '128' },
  { value: null, label: 'Tous' }
]

function Section(props: {
  title: string
  detail?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="rounded-xl bg-panel p-5">
      <h2 className="font-semibold">{props.title}</h2>
      {props.detail && <p className="mt-0.5 text-xs text-ink-soft">{props.detail}</p>}
      <div className="mt-4 space-y-4 text-sm">{props.children}</div>
    </section>
  )
}

function Row(props: {
  label: string
  detail?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium">{props.label}</div>
        {props.detail && <div className="text-xs text-ink-soft">{props.detail}</div>}
      </div>
      <div className="shrink-0">{props.children}</div>
    </div>
  )
}

/** Everything set by hand for the tournament, in one place. */
export function ConfigTab(props: {
  data: TournamentData
  /** Those still in the tournament, by seed. */
  opponents: PlayerStanding[]
  /** Every player met, in or out. */
  standings: PlayerStanding[]
  onChange: () => void
  onDeleted: () => void
}): React.JSX.Element {
  const { data, opponents, onChange } = props
  const { tournament } = data
  const [confirmDelete, setConfirmDelete] = useState(false)
  const update = (changes: TournamentUpdate): void => {
    window.api.updateTournament(tournament.id, changes).then(onChange).catch(console.error)
  }
  const pool = data.pools.find(({ id }) => id === tournament.nextPoolId) ?? data.pools.at(-1)
  // Qualifiers have no format: everyone plays every map.
  const rounds = data.pools.filter((candidate) => !isQualifierPool(candidate))
  const updatePool = (poolId: string, changes: PoolUpdate): void => {
    window.api.updatePool(poolId, changes).then(onChange).catch(console.error)
  }

  return (
    <div className="space-y-4">
      <Section
        title="Rounds"
        detail="Le format et les bans de chaque round. Un nouveau pool reprend ceux du round précédent."
      >
        {rounds.length === 0 ? (
          <p className="text-ink-soft">
            Ajoute les pools dans l’onglet Pools pour régler leur round.
          </p>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-[5rem_1fr_auto] gap-3 px-3 text-xs text-ink-soft">
              <span>Round</span>
              <span>Format</span>
              <span>Bans par joueur</span>
            </div>
            {rounds.map((round) => {
              const bans = round.bans ?? tournament.bans ?? DEFAULT_BANS
              return (
                <div
                  key={round.id}
                  className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 rounded-lg bg-page/40 px-3 py-2"
                >
                  <span className="truncate font-semibold">{round.name}</span>
                  <Dropdown
                    single
                    fill
                    hideLabel
                    label={`Format du round ${round.name}`}
                    placeholder="À choisir"
                    selected={round.bestOf ? [String(round.bestOf)] : []}
                    onChange={([value]) =>
                      updatePool(round.id, { bestOf: value ? Number(value) : null })
                    }
                    options={BEST_OF.map((bestOf) => ({
                      value: String(bestOf),
                      label: formatLabel(bestOf)
                    }))}
                  />
                  <Choices
                    label={`Bans par joueur au round ${round.name}`}
                    value={bans}
                    choices={[...new Set([...BANS, bans])]
                      .toSorted((x, y) => x - y)
                      .map((value) => ({ value, label: String(value) }))}
                    onChange={(value) => updatePool(round.id, { bans: value })}
                  />
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="Règles" detail="Elles servent à savoir qui est encore en lice.">
        <Row label="Qualifiés après les qualifs" detail="Les autres joueurs sont éliminés.">
          <Choices
            label="Qualifiés après les qualifs"
            value={tournament.qualifiedCount}
            choices={QUALIFIED_CHOICES}
            onChange={(qualifiedCount) => update({ qualifiedCount })}
          />
        </Row>
        <Row
          label="Loser bracket"
          detail={
            tournament.loserBracket
              ? 'Un joueur est éliminé à sa deuxième défaite.'
              : 'Un joueur est éliminé dès sa première défaite.'
          }
        >
          <Switch
            label="Loser bracket"
            checked={tournament.loserBracket}
            onChange={(loserBracket) => update({ loserBracket })}
          />
        </Row>
      </Section>

      <Section
        title="Bracket"
        detail="Le lien du tournoi sur Challonge, affiché dans l’onglet Bracket."
      >
        <ChallongeField data={data} onChange={onChange} />
      </Section>

      <PlayersSection
        tournamentId={tournament.id}
        standings={props.standings}
        meId={data.me?.userId ?? null}
        hasBracket={data.bracket !== null}
        onChange={onChange}
      />

      <Section
        title="Prochain match"
        detail="La stratégie est préparée pour ce pool et cet adversaire."
      >
        <Row label="Pool">
          {data.pools.length === 0 ? (
            <span className="text-ink-soft">Ajoute-le dans l’onglet Pools</span>
          ) : (
            <Dropdown
              single
              hideLabel
              label="Pool"
              placeholder={pool?.name ?? 'Aucun'}
              selected={tournament.nextPoolId ? [tournament.nextPoolId] : []}
              onChange={([value]) => update({ nextPoolId: value ?? null })}
              options={data.pools.map(({ id, name }) => ({ value: id, label: name }))}
            />
          )}
        </Row>
        <Row label="Adversaire" detail="Seuls les joueurs encore en lice sont proposés.">
          <Dropdown
            single
            hideLabel
            label="Adversaire"
            placeholder="Aucun"
            selected={tournament.nextOpponentId ? [String(tournament.nextOpponentId)] : []}
            onChange={([value]) => update({ nextOpponentId: value ? Number(value) : null })}
            options={opponents.map((player) => ({
              value: String(player.userId),
              label: playerLabel(player)
            }))}
          />
        </Row>
      </Section>

      <Section title="Supprimer le tournoi">
        <Row
          label="Ses pools et ses matchs importés sont supprimés avec lui."
          detail="Tes parties restent dans l’historique."
        >
          {confirmDelete ? (
            <div className="flex gap-2">
              <button
                onClick={() =>
                  window.api
                    .deleteTournament(tournament.id)
                    .then(props.onDeleted)
                    .catch(console.error)
                }
                className="rounded-lg bg-failed px-3 py-1.5 font-semibold text-on-accent"
              >
                Supprimer
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg bg-panel-raised px-3 py-1.5 hover:bg-line"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg bg-panel-raised px-3 py-1.5 text-ink-soft hover:text-failed"
            >
              Supprimer
            </button>
          )}
        </Row>
      </Section>
    </div>
  )
}
