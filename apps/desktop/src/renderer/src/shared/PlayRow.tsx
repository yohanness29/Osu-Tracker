import { Link } from 'react-router'
import type { RecentPlay } from '@osu-tracker/storage'
import { CopyMapId } from './CopyMapId'
import { formatDay, formatTime, formatTiming, mapName, splitMods } from './format'
import { MapCover } from './MapCover'
import { onMapContextMenu } from './mapMenu'
import { MapStyle } from './MapStyle'
import { settingTags } from './mapTags'
import { clockRate } from './mods'
import { ModeBadge } from './ModeBadge'
import { ResultBadge } from './results'

function PpCell({ play }: { play: RecentPlay }): React.JSX.Element {
  const share = play.maxPp ? Math.min(1, play.pp / play.maxPp) : null

  return (
    <div className="w-36 shrink-0">
      <div className="flex items-baseline justify-end gap-1 tabular-nums">
        <span className="font-bold">{play.pp.toFixed(0)}</span>
        <span className="text-xs text-ink-soft">
          {play.maxPp === null ? 'pp' : `/ ${play.maxPp.toFixed(0)}pp`}
        </span>
      </div>
      {share !== null && (
        <div className="mt-1 h-1 overflow-hidden rounded bg-panel-raised">
          <div className="h-full rounded bg-accent" style={{ width: `${share * 100}%` }} />
        </div>
      )}
      {play.noModMaxPp !== null && (
        <div className="mt-1 text-right text-xs text-ink-soft tabular-nums">
          sans mods {play.noModMaxPp.toFixed(0)}pp
        </div>
      )}
    </div>
  )
}

// tosu gives the AR with the mods, but not the other settings.
function playTags(play: RecentPlay): string[] {
  const lengthSeconds = play.lengthMs / 1000 / clockRate(play.mods)
  return [...play.tags, ...settingTags({ mode: play.mode, ar: play.ar, lengthSeconds })]
}

export function PlayRow(props: {
  play: RecentPlay
  /** Rank of the action in its session. */
  position?: number
  /** Shows when the play happened, for lists that mix sessions. */
  dated?: boolean
  /** Opens the page of the map. */
  linked?: boolean
  /** Tries of the map grouped in this row. */
  retries?: number
}): React.JSX.Element {
  const { play, position, dated, linked, retries = 0 } = props
  const context = [
    dated && `${formatDay(play.endedAt)} · ${formatTime(play.endedAt)}`,
    `${play.stars.toFixed(2)}★`,
    retries > 0 && `${retries} retry`,
    play.netGain !== null && play.netGain > 0 && `+${play.netGain.toFixed(1)}pp sur ton profil`,
    play.partial && 'partie incomplète'
  ].filter(Boolean)
  const hits = [
    `${play.n100} × 100`,
    `${play.n50} × 50`,
    `${play.misses} miss`,
    play.hitError !== null && formatTiming(play.hitError)
  ].filter(Boolean)

  const card = (
    <>
      <MapCover
        beatmapsetId={play.beatmapsetId}
        variant="card"
        className="absolute inset-y-0 right-0 h-full w-2/3"
        fadeIn
      />
      <div className="absolute inset-0 bg-gradient-to-r from-panel from-30% via-panel/60 via-55% to-panel/20" />
      <div className="relative on-cover flex items-center gap-3 p-4">
        {position !== undefined && (
          <span className="w-6 shrink-0 text-right text-sm text-ink-soft tabular-nums">
            {position}
          </span>
        )}
        <ResultBadge result={play.result} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{mapName(play)}</div>
          <div className="mt-1 flex items-center gap-2 text-xs whitespace-nowrap text-ink-soft tabular-nums">
            <ModeBadge mode={play.mode} />
            <MapStyle style={play.style} tags={playTags(play)} />
            <span>{context.join(' · ')}</span>
            <CopyMapId beatmapId={play.beatmapId} />
            <div className="flex items-center gap-1">
              {splitMods(play.mods).map((mod) => (
                <span
                  key={mod}
                  className="rounded bg-panel-raised px-1.5 py-0.5 text-xs font-semibold text-ink-soft"
                >
                  {mod}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-0.5 truncate text-xs text-ink-soft tabular-nums">
            {hits.join(' · ')}
          </div>
        </div>
        <div className="w-16 shrink-0 text-right text-sm tabular-nums">
          {play.accuracy.toFixed(2)}%
        </div>
        <PpCell play={play} />
      </div>
    </>
  )

  const cardClass = 'relative block overflow-hidden rounded-xl bg-panel'

  return (
    <li
      onContextMenu={onMapContextMenu({
        beatmapChecksum: play.beatmapChecksum,
        mode: play.mode,
        beatmapId: play.beatmapId,
        beatmapsetId: play.beatmapsetId,
        title: play.title,
        artist: play.artist,
        version: play.version,
        mapper: play.mapper
      })}
    >
      {linked ? (
        <Link
          to={`/maps/${play.beatmapChecksum}?mode=${play.mode}`}
          className={`${cardClass} transition-transform hover:scale-[1.01]`}
        >
          {card}
        </Link>
      ) : (
        <div className={cardClass}>{card}</div>
      )}
    </li>
  )
}
