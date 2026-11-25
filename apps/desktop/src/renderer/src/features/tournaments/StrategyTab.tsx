import {
  planMatch,
  type SlotAdvice,
  type SlotOverview,
  type Verdict
} from '@osu-tracker/recommender'
import type { OpponentComparison, PlayerStanding } from '@osu-tracker/stats'
import type { TournamentData } from '../../../../main/tournaments'
import { DEFAULT_BANS } from './ConfigTab'
import {
  CATEGORY_COLORS,
  opponentLevel,
  percent,
  playerLabel,
  trainedSlots
} from './tournamentView'

const VERDICT_COLORS: Record<Verdict, string> = {
  ahead: 'var(--color-passed)',
  even: 'var(--color-warning)',
  behind: 'var(--color-failed)',
  unknown: 'var(--color-ink-faint)'
}

/** Against the opponent when known, else against the player's own level. */
function verdictLabel(verdict: Verdict, versus: boolean): string {
  switch (verdict) {
    case 'ahead':
      return versus ? 'Avantage' : 'Point fort'
    case 'even':
      return versus ? 'Équilibré' : 'Dans ta moyenne'
    case 'behind':
      return versus ? 'Désavantage' : 'Point faible'
    case 'unknown':
      return 'Pas encore jouée'
  }
}

const ROLES: Record<
  NonNullable<SlotOverview['role']>,
  { mark: string; label: string; color: string }
> = {
  ban: { mark: '✕', label: 'à bannir', color: 'var(--color-failed)' },
  pick: { mark: '★', label: 'à choisir', color: 'var(--color-passed)' },
  'their-pick': { mark: '!', label: 'il risque de la choisir', color: 'var(--color-warning)' }
}

function RoleMark(props: { role: NonNullable<SlotOverview['role']> }): React.JSX.Element {
  const { mark, color } = ROLES[props.role]
  return (
    <span
      aria-hidden
      className="inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold text-on-accent"
      style={{ backgroundColor: color }}
    >
      {mark}
    </span>
  )
}

function SlotBadge(props: { slot: string; category: SlotAdvice['category'] }): React.JSX.Element {
  const color = CATEGORY_COLORS[props.category]
  return (
    <span
      className="w-11 shrink-0 rounded-md py-0.5 text-center text-xs font-bold"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }}
    >
      {props.slot}
    </span>
  )
}

function result(value: { accuracy: number; misses: number }): string {
  return `${percent(value.accuracy, 1)} · ${value.misses.toFixed(1).replace('.0', '')} miss`
}

/** Every slot at a glance: green where the player leads, red where they trail. */
function PoolOverview(props: { overview: SlotOverview[]; versus: boolean }): React.JSX.Element {
  const { overview, versus } = props
  return (
    <section className="rounded-xl bg-panel p-4">
      <h3 className="font-semibold">Le pool en un coup d’œil</h3>
      {/* Room above the chips for their role badges. */}
      <div className="mt-4 flex flex-wrap gap-x-2.5 gap-y-3.5">
        {overview.map((entry) => {
          const mod = CATEGORY_COLORS[entry.category]
          const verdict = VERDICT_COLORS[entry.verdict]
          const role = entry.role ? ROLES[entry.role] : null
          return (
            <div
              key={entry.slot}
              title={`${entry.title} · ${verdictLabel(entry.verdict, versus)}${
                role ? ` · ${role.label}` : ''
              }`}
              className="relative flex w-28 flex-col items-center gap-1 rounded-lg border-2 px-1.5 pt-2 pb-1.5"
              style={{
                borderColor: `color-mix(in srgb, ${mod} 55%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${mod} 16%, transparent)`
              }}
            >
              {entry.role && (
                <span className="absolute -top-2 -right-2">
                  <RoleMark role={entry.role} />
                </span>
              )}
              <span className="text-base font-extrabold" style={{ color: mod }}>
                {entry.slot}
              </span>
              <span
                className="w-full rounded-md px-1 py-0.5 text-center text-[11px] font-semibold"
                style={{
                  color: verdict,
                  backgroundColor: `color-mix(in srgb, ${verdict} 18%, transparent)`
                }}
              >
                {verdictLabel(entry.verdict, versus)}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
        {(['ban', 'pick', 'their-pick'] as const).map((role) => (
          <span key={role} className="flex items-center gap-1.5">
            <RoleMark role={role} />
            {ROLES[role].label}
          </span>
        ))}
        <span>·</span>
        {versus
          ? 'Comparé à ce qu’il a montré dans ses matchs importés.'
          : 'Sans adversaire, chaque map est comparée à ton niveau habituel.'}
      </p>
    </section>
  )
}

function AdviceStep(props: {
  step: number
  title: string
  note: string
  advice: SlotAdvice[]
  versus: boolean
  opponentName: string
}): React.JSX.Element {
  const { advice, versus } = props
  return (
    <section className="rounded-xl bg-panel p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-panel-raised text-sm">
          {props.step}
        </span>
        {props.title}
      </h3>
      <p className="mt-1 text-xs text-ink-soft">{props.note}</p>
      {advice.length === 0 && <p className="mt-3 text-sm text-ink-soft">Rien à signaler.</p>}
      <ol className="mt-3 space-y-2">
        {advice.map((entry) => (
          <li key={entry.slot} className="rounded-lg bg-page/40 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <SlotBadge slot={entry.slot} category={entry.category} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium" title={entry.title}>
                {entry.title}
              </span>
            </div>
            <span
              className="mt-2 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
              style={{
                color: VERDICT_COLORS[entry.verdict],
                backgroundColor: `color-mix(in srgb, ${VERDICT_COLORS[entry.verdict]} 16%, transparent)`
              }}
            >
              {verdictLabel(entry.verdict, versus)}
            </span>
            <dl className="mt-1.5 space-y-0.5 text-xs tabular-nums">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Toi</dt>
                <dd>{entry.mine ? result(entry.mine) : '–'}</dd>
              </div>
              {versus && (
                <div className="flex justify-between gap-3">
                  <dt className="min-w-0 truncate text-ink-soft">{props.opponentName}</dt>
                  <dd className="shrink-0">{entry.theirs ? result(entry.theirs) : '–'}</dd>
                </div>
              )}
            </dl>
            {entry.backup && (
              <div className="mt-1.5 border-t border-line pt-1.5 text-xs text-ink-soft">
                Si elle est bannie : <span className="font-semibold text-ink">{entry.backup}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The plan of the next match: the pool at a glance, then bans and picks. */
export function StrategyTab(props: {
  data: TournamentData
  /** Those still in the tournament, by seed. */
  opponents: PlayerStanding[]
  comparison: OpponentComparison | null
  onConfigure: () => void
}): React.JSX.Element {
  const { data, opponents, comparison, onConfigure } = props
  const { tournament } = data

  const pool =
    data.pools.find(({ id }) => id === tournament.nextPoolId) ?? data.pools.at(-1) ?? null
  if (!pool) {
    return (
      <p className="text-ink-soft">
        Ajoute le pool du match dans l’onglet Pools pour préparer tes bans et tes picks.
      </p>
    )
  }

  const slots = trainedSlots(pool, data.plays)
  const bans = pool.bans ?? tournament.bans ?? DEFAULT_BANS
  const level = opponentLevel(comparison)
  const plan = planMatch(slots, level, bans)
  const opponent = opponents.find(({ userId }) => userId === tournament.nextOpponentId)
  const versus = level !== null
  const opponentName = opponent?.username ?? 'Lui'
  const format = pool.bestOf ? `FT${(pool.bestOf + 1) / 2}` : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-panel px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-ink-soft">Prochain match</div>
          <div className="font-semibold">
            {opponent ? `Contre ${playerLabel(opponent)}` : 'Adversaire non choisi'}
            <span className="font-normal text-ink-soft">
              {' '}
              · {pool.name}
              {format && ` · ${format}`} · {bans} ban{bans > 1 ? 's' : ''}
            </span>
          </div>
          {!versus && (
            <div className="mt-0.5 text-xs text-ink-soft">
              {opponent
                ? `Aucun match importé de ${opponent.username} : les maps sont comparées à ton niveau habituel.`
                : 'Choisis ton adversaire pour comparer chaque map à son niveau.'}
            </div>
          )}
        </div>
        <button
          onClick={onConfigure}
          className="rounded-lg bg-panel-raised px-3 py-1.5 text-sm hover:bg-line"
        >
          Modifier
        </button>
      </div>

      {plan.overview.every(({ verdict }) => verdict === 'unknown') && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <span className="font-semibold">Tu n’as encore terminé aucune map de ce pool.</span> Le
          plan ne repose que sur le niveau de ton adversaire : joue chaque map une ou deux fois avec
          ses mods pour des conseils fiables.
        </p>
      )}

      <PoolOverview overview={plan.overview} versus={versus} />

      {/* Side by side when they fit, one under the other in a narrow window. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(17rem,1fr))] items-start gap-3">
        <AdviceStep
          step={1}
          title={bans > 1 ? 'Tes bans' : 'Ta ban'}
          note="Les maps où tu risques le plus de perdre."
          advice={plan.bans}
          versus={versus}
          opponentName={opponentName}
        />
        <AdviceStep
          step={2}
          title="Tes picks, dans l’ordre"
          note="Les maps où tu as le plus d’avance."
          advice={plan.picks}
          versus={versus}
          opponentName={opponentName}
        />
        <AdviceStep
          step={3}
          title={versus ? 'Ses picks probables' : 'Les maps à craindre'}
          note="Prépare-toi à les jouer pour limiter l’écart."
          advice={plan.theirPicks}
          versus={versus}
          opponentName={opponentName}
        />
      </div>
      <p className="text-xs text-ink-faint">
        « Toi » : ta moyenne récente sur la map.
        {versus && ` « ${opponentName} » : sa moyenne dans ce mod, dans ses matchs importés.`} Le
        tiebreak n’est jamais banni ni choisi.
      </p>
    </div>
  )
}
