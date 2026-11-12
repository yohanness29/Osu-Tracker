import { useState } from 'react'
import type { TrackingStatus } from '../../../../main/tracking'
import type { GameFrame } from '@osu-tracker/shared'
import { CopyMapId } from '../../shared/CopyMapId'
import { onMapContextMenu } from '../../shared/mapMenu'
import { GoalsPanel } from '../goals/GoalsPanel'
import { useSessionPlays, useSessions } from '../history/useSessions'
import { formatTiming, passRate, splitMods } from '../../shared/format'
import { ResultBar, ResultLegend } from '../../shared/results'
import { StatTile } from '../../shared/StatTile'
import { useTracking } from '../../store'

const STATE_LABELS: Record<string, string> = {
  play: 'En jeu',
  resultScreen: 'Résultats',
  selectPlay: 'Sélection de map',
  menu: 'Menu'
}

function MapBackground({ frame, url }: { frame: GameFrame; url: string }): React.JSX.Element {
  const [failed, setFailed] = useState(false)

  return (
    <>
      {!failed && (
        <img
          src={`${url}?map=${frame.beatmap.checksum}`}
          alt=""
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full scale-105 object-cover opacity-65 blur-sm"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-page via-page/45 to-page/5" />
    </>
  )
}

function MapHeader({ frame }: { frame: GameFrame }): React.JSX.Element {
  const { beatmap, play, state } = frame
  const stats = [
    ['★', beatmap.stars.toFixed(2)],
    ['AR', beatmap.ar.toFixed(1)],
    ['CS', beatmap.cs.toFixed(1)],
    ['OD', beatmap.od.toFixed(1)],
    ['HP', beatmap.hp.toFixed(1)],
    ['BPM', beatmap.bpm.toFixed(0)]
  ]

  return (
    <header
      onContextMenu={onMapContextMenu(
        beatmap.id > 0
          ? {
              beatmapChecksum: beatmap.checksum,
              mode: play.mode,
              beatmapId: beatmap.id,
              beatmapsetId: beatmap.setId,
              title: beatmap.title,
              artist: beatmap.artist,
              version: beatmap.version,
              mapper: beatmap.mapper
            }
          : null
      )}
    >
      <div className="text-xs font-semibold tracking-wide text-accent uppercase">
        {STATE_LABELS[state] ?? state}
      </div>
      <h1 className="mt-2 truncate text-4xl font-bold">
        {beatmap.title || `Beatmap #${beatmap.id}`}
      </h1>
      <p className="mt-1 truncate text-ink-soft">
        {beatmap.artist}
        {beatmap.version && ` · ${beatmap.version} · par ${beatmap.mapper}`}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {splitMods(play.mods).map((mod) => (
          <span key={mod} className="rounded-md bg-accent px-2 py-1 text-xs font-bold text-page">
            {mod}
          </span>
        ))}
        {stats.map(([label, value]) => (
          <span key={label} className="rounded-md bg-panel/80 px-2 py-1 text-xs tabular-nums">
            <span className="text-ink-soft">{label}</span> {value}
          </span>
        ))}
        <CopyMapId beatmapId={beatmap.id} />
      </div>
    </header>
  )
}

function PpMeter({ frame }: { frame: GameFrame }): React.JSX.Element {
  const { beatmap, play } = frame
  const progress = Math.min(1, Math.max(0, beatmap.liveTime / beatmap.lastObjectTime))
  const fcLost = play.hits.misses > 0 || play.sliderBreaks > 0

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-8xl leading-none font-extrabold tabular-nums">
          {play.pp.toFixed(0)}
        </span>
        <span className="text-2xl font-semibold text-ink-soft">pp</span>
        {fcLost && (
          <span className="ml-6 text-4xl font-bold text-accent tabular-nums">
            {play.ppFc.toFixed(0)}pp <span className="text-lg font-semibold">si FC</span>
          </span>
        )}
      </div>
      <div className="mt-3 flex gap-6 text-sm text-ink-soft tabular-nums">
        {!fcLost && (
          <span>
            FC <span className="font-semibold text-ink">{play.ppFc.toFixed(0)}pp</span>
          </span>
        )}
        {beatmap.maxPp !== null && (
          <span>
            SS <span className="font-semibold text-ink">{beatmap.maxPp.toFixed(0)}pp</span>
          </span>
        )}
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded bg-panel-raised">
        <div
          className="h-full rounded bg-accent transition-[width] duration-200"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}

function MapPp({ frame }: { frame: GameFrame }): React.JSX.Element | null {
  const { ppByAccuracy } = frame.beatmap
  const best = ppByAccuracy[0]
  if (!best) return null

  const mods = splitMods(frame.play.mods).join(' ') || 'sans mods'

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-8xl leading-none font-extrabold tabular-nums">
          {best.pp.toFixed(0)}
        </span>
        <span className="text-2xl font-semibold text-ink-soft">pp</span>
        <span className="ml-3 text-lg text-ink-soft">pour un SS, {mods}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {ppByAccuracy.slice(1).map(({ accuracy, pp }) => (
          <StatTile key={accuracy} label={`À ${accuracy}%`} value={`${pp.toFixed(0)}pp`} />
        ))}
      </div>
    </div>
  )
}

function ResultPanel({ frame }: { frame: GameFrame }): React.JSX.Element | null {
  const { results, play, beatmap } = frame
  const sessionId = useTracking((state) => state.status?.sessionId ?? null)
  const [latest] = useSessionPlays(sessionId)
  if (results.score === 0) return null

  // The results of an older score can be opened from the song selection.
  const netGain = latest?.score === results.score ? latest.netGain : null
  // tosu does not recalculate the pp of the results when a map is played again.
  const { pp, ppFc } = play
  const fullCombo = results.hits.misses === 0 && results.maxCombo === beatmap.maxCombo

  return (
    <div>
      <div className="flex items-baseline gap-5">
        <span className="text-8xl leading-none font-extrabold">{results.rank}</span>
        <span className="text-6xl leading-none font-extrabold tabular-nums">{pp.toFixed(0)}</span>
        <span className="text-2xl font-semibold text-ink-soft">pp</span>
        {!fullCombo && (
          <span className="ml-3 text-3xl font-bold text-accent tabular-nums">
            {ppFc.toFixed(0)}pp <span className="text-lg font-semibold">si FC</span>
          </span>
        )}
        {netGain !== null && (
          <span className="ml-auto text-2xl font-bold tabular-nums">
            +{netGain.toFixed(1)}pp{' '}
            <span className="text-sm font-medium text-ink-soft">profil</span>
          </span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        <StatTile
          label="Précision"
          value={`${results.accuracy.toFixed(2)}%`}
          hint={play.hitError === null ? undefined : formatTiming(play.hitError)}
        />
        <StatTile
          label="Combo"
          value={`${results.maxCombo}x`}
          hint={fullCombo ? 'Full combo' : `sur ${beatmap.maxCombo}x`}
        />
        <StatTile
          label="Notes"
          value={`${results.hits.misses} miss`}
          hint={`${results.hits.n100} × 100 · ${results.hits.n50} × 50`}
        />
        <StatTile
          label="Score"
          value={results.score.toLocaleString('fr-FR')}
          hint={`UR ${play.unstableRate.toFixed(0)}`}
        />
      </div>
    </div>
  )
}

function PlayStats({ frame }: { frame: GameFrame }): React.JSX.Element {
  const { play } = frame
  return (
    <div className="grid grid-cols-4 gap-3">
      <StatTile
        label="Précision"
        value={`${play.accuracy.toFixed(2)}%`}
        hint={play.hitError === null ? undefined : formatTiming(play.hitError)}
      />
      <StatTile
        label="Combo"
        value={`${play.combo}x`}
        hint={`max ${play.maxCombo}x / ${frame.beatmap.maxCombo}x`}
      />
      <StatTile
        label="Misses"
        value={String(play.hits.misses)}
        hint={`${play.sliderBreaks} slider break${play.sliderBreaks > 1 ? 's' : ''}`}
      />
      <StatTile
        label="Unstable rate"
        value={play.unstableRate.toFixed(0)}
        hint={`${play.hits.n100} × 100 · ${play.hits.n50} × 50`}
      />
    </div>
  )
}

function SessionSummary(): React.JSX.Element | null {
  const status = useTracking((state) => state.status)
  const livePp = useTracking((state) => state.frame?.profile.pp ?? null)
  const { sessions } = useSessions()
  const plays = useSessionPlays(status?.sessionId ?? null)
  if (!status) return null

  const session = sessions?.find(({ id }) => id === status.sessionId)
  const ppGain = session && livePp ? livePp - session.startPp : null

  const { passed, failed } = status.sessionResults
  const rate = passRate(passed, failed)

  return (
    <div className="rounded-xl bg-panel/80 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-semibold">
          {status.sessionId ? 'Session en cours' : 'Aucune session en cours'}
        </span>
        {rate !== null && (
          <span className="text-sm text-ink-soft tabular-nums">{rate}% de pass</span>
        )}
      </div>
      <ResultBar counts={status.sessionResults} />
      <div className="mt-3">
        <ResultLegend counts={status.sessionResults} />
      </div>
      <div className="mt-3 border-t border-line pt-3">
        <GoalsPanel sessionId={status.sessionId} plays={plays} ppGain={ppGain} />
      </div>
    </div>
  )
}

/** tosu only sends data once osu! is open: until then, says what is missing. */
function waitingMessage(status: TrackingStatus | null): { title: string; detail: string } {
  if (status?.connected) {
    return { title: 'En attente d’osu!', detail: 'Lance osu! pour voir ta partie ici.' }
  }
  switch (status?.tosu) {
    case 'installing':
      return {
        title: 'Installation de tosu…',
        detail: 'Premier lancement : l’app télécharge tosu, qui lit les données d’osu!.'
      }
    case 'failed':
    case 'unsupported':
      return {
        title: 'tosu n’a pas pu démarrer',
        detail: 'Lance tosu toi-même : l’app s’y connectera automatiquement.'
      }
    default:
      return {
        title: 'Démarrage de tosu…',
        detail: 'Ta partie s’affichera ici dès qu’osu! sera lancé.'
      }
  }
}

export function LivePage(): React.JSX.Element {
  const frame = useTracking((state) => state.frame)
  const status = useTracking((state) => state.status)

  if (!frame || !status) {
    const { title, detail } = waitingMessage(status)
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-ink-soft">{detail}</p>
      </div>
    )
  }

  const playing = frame.state === 'play'

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <MapBackground key={frame.beatmap.checksum} frame={frame} url={status.backgroundUrl} />
      <div className="relative flex min-h-0 flex-1 flex-col justify-between gap-6 overflow-y-auto p-8">
        <MapHeader frame={frame} />
        <div className="space-y-4">
          {playing && <PpMeter frame={frame} />}
          {playing && <PlayStats frame={frame} />}
          {frame.state === 'selectPlay' && <MapPp frame={frame} />}
          {frame.state === 'resultScreen' && <ResultPanel frame={frame} />}
          <SessionSummary />
        </div>
      </div>
    </div>
  )
}
