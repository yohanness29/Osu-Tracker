import { useState } from 'react'
import type { RecentPlay, SessionSummary } from '@osu-tracker/storage'
import { formatDuration, formatTiming, passRate } from '../../shared/format'
import { GoalsPanel } from '../goals/GoalsPanel'
import { PlayRow } from '../../shared/PlayRow'
import { ResultBar, ResultLegend } from '../../shared/results'
import { StatTile } from '../../shared/StatTile'
import { useTracking } from '../../store'
import { SessionAnalysis } from './SessionAnalysis'
import { computeStats, groupAttempts, type ModeShare, type Share } from './sessions'
import { useSessionPlays } from './useSessions'
import { notify, onActionMenu } from '../../shared/actionMenu'
import { errorMessage } from '../../shared/errors'
import { sessionActions } from './sessionActions'

const MAX_NAME_LENGTH = 60

function ShareList({ title, shares }: { title: string; shares: Share[] }): React.JSX.Element {
  return (
    <div>
      <div className="text-xs font-medium text-ink-soft">{title}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">
        {shares.length === 0
          ? '–'
          : shares.map(({ label, percent }) => `${label} ${percent}%`).join(' · ')}
      </div>
    </div>
  )
}

function ModeShares({ modes }: { modes: ModeShare[] }): React.JSX.Element {
  return (
    <div>
      <div className="text-xs font-medium text-ink-soft">Répartition des modes</div>
      <ul className="mt-2 space-y-2">
        {modes.map(({ key, label, percent, maps }) => (
          <li key={key} className="flex items-center gap-3 text-sm tabular-nums">
            <span className={`w-12 shrink-0 font-semibold ${maps ? '' : 'text-ink-faint'}`}>
              {label}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-panel-raised">
              <div className="h-full rounded bg-accent" style={{ width: `${percent}%` }} />
            </div>
            <span className={`w-10 shrink-0 text-right ${maps ? '' : 'text-ink-faint'}`}>
              {percent}%
            </span>
            <span className="w-16 shrink-0 text-right text-xs text-ink-soft">
              {maps} map{maps > 1 ? 's' : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** While the session is running, the gain comes from the live profile. */
function ppGain(session: SessionSummary, livePp: number | null): number | null {
  // Sessions recorded before the fix have no usable end value.
  const endPp = session.endPp || (session.endedAt ? null : livePp)
  return endPp ? endPp - session.startPp : null
}

function formatGain(gain: number | null): string {
  if (gain === null) return '–'
  return `${gain >= 0 ? '+' : ''}${gain.toFixed(0)}pp`
}

function SessionStatsPanel(props: {
  session: SessionSummary
  plays: RecentPlay[]
}): React.JSX.Element {
  const { session, plays } = props
  const livePp = useTracking((state) => state.frame?.profile.pp ?? null)
  const gain = ppGain(session, livePp)
  const stats = computeStats(plays)
  const rate = passRate(session.passed, session.failed)

  return (
    <div className="mb-4">
      <div className="grid grid-cols-4 gap-3">
        <StatTile label="Temps de jeu" value={formatDuration(session.playTimeMs)} />
        <StatTile
          label="Plays"
          value={String(session.plays)}
          hint={rate === null ? undefined : `${rate}% de pass`}
        />
        <StatTile
          label="Précision moyenne"
          value={stats.averageAccuracy === null ? '–' : `${stats.averageAccuracy.toFixed(2)}%`}
          hint="sur les pass"
        />
        <StatTile
          label="Gain"
          value={formatGain(gain)}
          hint={stats.bestPp === null ? undefined : `meilleur play ${stats.bestPp.toFixed(0)}pp`}
        />
      </div>

      <div className="mt-3 rounded-xl bg-panel p-4">
        <ResultBar counts={session} />
        <div className="mt-3">
          <ResultLegend counts={session} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-6 border-t border-line pt-4">
          <ModeShares modes={stats.modes} />
          <div className="space-y-4">
            <ShareList title="Mods" shares={stats.mods} />
            <div>
              <div className="text-xs font-medium text-ink-soft">Notes imparfaites</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {stats.n100} × 100 · {stats.n50} × 50 · {stats.misses} miss
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-ink-soft">Timing moyen</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {stats.hitError === null ? '–' : formatTiming(stats.hitError)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-ink-soft">Moyennes jouées</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {stats.averageStars === null || stats.averageAr === null
                  ? '–'
                  : `${stats.averageStars.toFixed(2)}★ · AR ${stats.averageAr.toFixed(1)}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SessionAnalysis actions={plays.toReversed()} />

      <div className="mt-3 rounded-xl bg-panel p-4">
        <GoalsPanel sessionId={session.id} plays={plays} ppGain={gain} />
      </div>
    </div>
  )
}

function SessionName(props: {
  session: SessionSummary
  date: string
  onRenamed: () => void
}): React.JSX.Element {
  const { session, date, onRenamed } = props
  const [draft, setDraft] = useState<string | null>(null)

  const save = (): void => {
    if (draft === null) return
    setDraft(null)
    window.api.renameSession(session.id, draft).then(onRenamed)
  }

  if (draft !== null) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <input
          autoFocus
          value={draft}
          maxLength={MAX_NAME_LENGTH}
          placeholder={date}
          aria-label="Nom de la session"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setDraft(null)
          }}
          className="mt-1 w-full rounded-lg bg-panel px-2 py-1 text-3xl font-bold outline-1 outline-accent"
        />
      </form>
    )
  }

  return (
    <div
      className="mt-1 flex items-center gap-2"
      onContextMenu={onActionMenu(sessionActions(session.id))}
    >
      <h2 className={`truncate text-3xl font-bold ${session.name ? '' : 'first-letter:uppercase'}`}>
        {session.name ?? date}
      </h2>
      <button
        onClick={() => setDraft(session.name ?? '')}
        aria-label="Renommer la session"
        title="Renommer la session"
        className="shrink-0 rounded-md px-2 py-1 text-ink-soft hover:bg-panel-raised hover:text-ink"
      >
        ✎
      </button>
      <button
        onClick={() => {
          const [exportAction] = sessionActions(session.id)
          Promise.resolve(exportAction!.run()).catch((error: unknown) =>
            notify(errorMessage(error))
          )
        }}
        title="Exporter la session en JSON"
        className="shrink-0 rounded-md px-2 py-1 text-sm text-ink-soft hover:bg-panel-raised hover:text-ink"
      >
        Exporter
      </button>
    </div>
  )
}

export function SessionDetail(props: {
  session: SessionSummary
  onRenamed: () => void
}): React.JSX.Element {
  const { session, onRenamed } = props
  const plays = useSessionPlays(session.id)
  const [statsOpen, setStatsOpen] = useState(false)
  const attempts = groupAttempts(plays)
  const date = new Date(session.startedAt).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold tracking-wide text-accent uppercase">Session</div>
          <SessionName session={session} date={date} onRenamed={onRenamed} />
          <p className="mt-1 text-ink-soft tabular-nums">
            {session.name && (
              <span className="inline-block first-letter:uppercase">{date}&nbsp;·&nbsp;</span>
            )}
            {attempts.length} map{attempts.length > 1 ? 's' : ''}
            {!session.endedAt && ' · en cours'}
          </p>
        </div>
        <button
          onClick={() => setStatsOpen(!statsOpen)}
          aria-expanded={statsOpen}
          className="shrink-0 rounded-lg bg-panel px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-panel-raised hover:text-ink"
        >
          {statsOpen ? 'Masquer les stats' : 'Voir les stats'}
        </button>
      </div>

      <div className="mt-5">
        {statsOpen && <SessionStatsPanel session={session} plays={plays} />}
        <ul className="space-y-2">
          {attempts.map(({ play, retries }, index) => (
            <PlayRow
              key={play.id}
              play={play}
              retries={retries}
              position={attempts.length - index}
              linked
            />
          ))}
        </ul>
      </div>
    </div>
  )
}
