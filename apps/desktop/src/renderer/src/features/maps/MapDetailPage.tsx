import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import type { MapDetail } from '@osu-tracker/storage'
import { formatDuration, passRate } from '../../shared/format'
import { CopyMapId } from '../../shared/CopyMapId'
import { MapCover } from '../../shared/MapCover'
import { onMapContextMenu } from '../../shared/mapMenu'
import { MapStyle } from '../../shared/MapStyle'
import { settingTags } from '../../shared/mapTags'
import { ModeBadge } from '../../shared/ModeBadge'
import { PlayRow } from '../../shared/PlayRow'
import { ResultBar, ResultLegend } from '../../shared/results'
import { StatTile } from '../../shared/StatTile'
import { useTracking } from '../../store'
import { computeMapStats, type ModsSummary } from './mapStats'

function ModsRow({ summary }: { summary: ModsSummary }): React.JSX.Element {
  return (
    <tr className="border-t border-line">
      <td className="py-2 font-semibold">{summary.mods}</td>
      <td className="py-2">{summary.stars.toFixed(2)}★</td>
      <td className="py-2">
        {summary.passed} / {summary.plays}
      </td>
      <td className="py-2">
        {summary.bestAccuracy === null ? '–' : `${summary.bestAccuracy.toFixed(2)}%`}
      </td>
      <td className="py-2 text-right">
        {summary.bestPp === null ? '–' : `${summary.bestPp.toFixed(0)}pp`}
        {summary.maxPp !== null && (
          <span className="text-ink-soft"> / {summary.maxPp.toFixed(0)}pp</span>
        )}
      </td>
    </tr>
  )
}

function NeverPlayed({ map }: { map: MapDetail }): React.JSX.Element {
  return (
    <section className="mt-3 rounded-xl bg-panel p-4">
      <h2 className="font-semibold">Tu n’as encore jamais joué cette map.</h2>
      {map.analyses.length > 0 && (
        <table className="mt-3 w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-ink-soft">
              <th className="pb-2 font-medium">Mods</th>
              <th className="pb-2 font-medium">Étoiles</th>
              <th className="pb-2 text-right font-medium">pp si SS</th>
            </tr>
          </thead>
          <tbody>
            {map.analyses.map(({ mods, stars, ssPp }) => (
              <tr key={mods} className="border-t border-line">
                <td className="py-2 font-semibold">{mods || 'NM'}</td>
                <td className="py-2">{stars.toFixed(2)}★</td>
                <td className="py-2 text-right">{ssPp.toFixed(0)}pp</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

/** The style for the mode shown, or the one of the original mode of the map. */
function MapStyleLine({
  map,
  mode
}: {
  map: MapDetail
  mode: string | null
}): React.JSX.Element | null {
  const found = map.styles.find((entry) => entry.mode === mode) ?? map.styles[0]
  if (!found) return null

  const tags = [
    ...found.tags,
    ...settingTags({ mode: found.mode, lengthSeconds: map.lengthMs / 1000 })
  ]
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <MapStyle style={found.style} tags={tags} limit={Infinity} />
    </div>
  )
}

function MapHeader({ map, mode }: { map: MapDetail; mode: string | null }): React.JSX.Element {
  return (
    <header
      onContextMenu={onMapContextMenu({
        beatmapChecksum: map.checksum,
        mode: mode ?? map.styles[0]?.mode ?? map.plays[0]?.mode ?? 'osu',
        beatmapId: map.beatmapId,
        beatmapsetId: map.beatmapsetId,
        title: map.title,
        artist: map.artist,
        version: map.version,
        mapper: map.mapper
      })}
      className="relative overflow-hidden rounded-xl bg-panel"
    >
      <MapCover
        beatmapsetId={map.beatmapsetId}
        variant="card"
        className="absolute inset-0 size-full"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-page via-page/45 to-page/5" />
      <div className="relative on-cover flex min-h-48 flex-col justify-end p-6">
        {mode && (
          <div className="mb-2">
            <ModeBadge mode={mode} />
          </div>
        )}
        <h1 className="truncate text-3xl font-bold">{map.title || `Beatmap #${map.beatmapId}`}</h1>
        <p className="mt-1 truncate text-ink-soft">
          {map.artist}
          {map.version && ` · ${map.version} · par ${map.mapper}`}
        </p>
        <p className="mt-1 text-xs text-ink-soft tabular-nums">
          {formatDuration(map.lengthMs)}
          {map.maxCombo > 0 && ` · combo max ${map.maxCombo}x`} ·{' '}
          <a
            href={`https://osu.ppy.sh/b/${map.beatmapId}`}
            target="_blank"
            rel="noreferrer"
            className="text-ink underline hover:text-accent"
          >
            Voir sur osu!
          </a>
        </p>
        <MapStyleLine map={map} mode={mode} />
        <div className="mt-2">
          <CopyMapId beatmapId={map.beatmapId} />
        </div>
      </div>
    </header>
  )
}

export function MapDetailPage(): React.JSX.Element {
  const { checksum = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const mode = params.get('mode')
  const results = useTracking((state) => state.status?.totalResults)
  const [map, setMap] = useState<MapDetail | null | undefined>(undefined)

  useEffect(() => {
    window.api.getMap(checksum).then(setMap)
  }, [checksum, results])

  const plays = map?.plays.filter((play) => !mode || play.mode === mode) ?? []
  const stats = map ? computeMapStats(plays) : null
  const rate = stats ? passRate(stats.counts.passed, stats.counts.failed) : null

  return (
    <div className="h-full overflow-y-auto p-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-3 inline-block text-sm text-ink-soft hover:text-ink"
      >
        ← Retour
      </button>

      {map === null && <p className="text-ink-soft">Cette map n’est pas dans l’historique.</p>}

      {map && stats && (
        <>
          <MapHeader map={map} mode={mode} />

          {plays.length === 0 && <NeverPlayed map={map} />}

          {plays.length > 0 && (
            <>
              <div className="mt-3 grid grid-cols-4 gap-3">
                <StatTile
                  label="Plays"
                  value={String(plays.length)}
                  hint={rate === null ? undefined : `${rate}% de pass`}
                />
                <StatTile
                  label="Meilleur pp"
                  value={stats.bestPp === null ? '–' : `${stats.bestPp.toFixed(0)}pp`}
                  hint="sur les pass"
                />
                <StatTile
                  label="Meilleure précision"
                  value={stats.bestAccuracy === null ? '–' : `${stats.bestAccuracy.toFixed(2)}%`}
                  hint="sur les pass"
                />
                <StatTile
                  label="Sans mods"
                  value={plays[0]?.noModMaxPp == null ? '–' : `${plays[0].noModMaxPp.toFixed(0)}pp`}
                  hint="pp pour un SS"
                />
              </div>

              <section className="mt-3 rounded-xl bg-panel p-4">
                <ResultBar counts={stats.counts} />
                <div className="mt-3">
                  <ResultLegend counts={stats.counts} />
                </div>
              </section>

              <section className="mt-3 rounded-xl bg-panel p-4">
                <h2 className="text-sm font-semibold">Par mods</h2>
                <table className="mt-2 w-full text-sm tabular-nums">
                  <thead>
                    <tr className="text-left text-xs text-ink-soft">
                      <th className="pb-2 font-medium">Mods</th>
                      <th className="pb-2 font-medium">Étoiles</th>
                      <th className="pb-2 font-medium">Pass / plays</th>
                      <th className="pb-2 font-medium">Meilleure précision</th>
                      <th className="pb-2 text-right font-medium">Meilleur pp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byMods.map((summary) => (
                      <ModsRow key={summary.mods} summary={summary} />
                    ))}
                  </tbody>
                </table>
              </section>

              <h2 className="mt-6 mb-2 text-sm font-semibold text-ink-soft">Tous les plays</h2>
              <ul className="space-y-2">
                {plays.map((play) => (
                  <PlayRow key={play.id} play={play} dated />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
