import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { MapResults } from '@osu-tracker/storage'
import { mapName, passRate } from '../../shared/format'
import { Dropdown } from '../../shared/Dropdown'
import { MapCover } from '../../shared/MapCover'
import { MapStyle } from '../../shared/MapStyle'
import { onMapContextMenu } from '../../shared/mapMenu'
import { RangeSlider } from '../../shared/RangeSlider'
import { usePersistentState } from '../../shared/usePersistentState'
import { ModeBadge } from '../../shared/ModeBadge'
import { ModeFilter } from '../../shared/ModeFilter'
import { ResultBar, ResultLegend } from '../../shared/results'
import { useTracking } from '../../store'
import {
  filterMaps,
  MODS_CHOICES,
  NO_FILTERS,
  RESULT_CHOICES,
  SORT_CHOICES,
  sortMaps,
  starsBounds,
  styleChoices,
  type MapFilters
} from './mapFilters'

// Enough to find a map, without slowing the page down on a long history.
const SHOWN_MAPS = 100

function MapCard({ map }: { map: MapResults }): React.JSX.Element {
  const rate = passRate(map.passed, map.failed)

  return (
    <li
      onContextMenu={onMapContextMenu({
        beatmapChecksum: map.checksum,
        mode: map.mode,
        beatmapId: map.beatmapId,
        beatmapsetId: map.beatmapsetId,
        title: map.title,
        artist: map.artist,
        version: map.version,
        mapper: map.mapper
      })}
    >
      <Link
        to={`/maps/${map.checksum}?mode=${map.mode}`}
        className="relative block overflow-hidden rounded-xl bg-panel transition-transform hover:scale-[1.01]"
      >
        <MapCover
          beatmapsetId={map.beatmapsetId}
          variant="card"
          className="absolute inset-y-0 right-0 h-full w-2/3"
          fadeIn
        />
        <div className="absolute inset-0 bg-gradient-to-r from-panel from-30% via-panel/60 via-55% to-panel/20" />
        <div className="relative on-cover p-4">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <span className="flex min-w-0 items-center gap-2">
              <ModeBadge mode={map.mode} />
              <span className="truncate font-semibold">{mapName(map)}</span>
            </span>
            {rate !== null && (
              <span className="shrink-0 text-sm font-semibold tabular-nums">{rate}%</span>
            )}
          </div>
          {(map.style || map.tags.length > 0) && (
            <div className="-mt-1 mb-3 flex items-center gap-2 text-xs">
              <MapStyle style={map.style} tags={map.tags} />
            </div>
          )}
          <ResultBar counts={map} />
          <div className="mt-3">
            <ResultLegend counts={map} />
          </div>
        </div>
      </Link>
    </li>
  )
}

export function MapsPage(): React.JSX.Element {
  const status = useTracking((state) => state.status)
  const results = status?.totalResults
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode')
  const [maps, setMaps] = useState<MapResults[]>([])
  const [filters, setFilters] = usePersistentState<MapFilters>('maps-filters', NO_FILTERS)
  const [sort, setSort] = usePersistentState('maps-sort', 'recent')
  const update = (changes: Partial<MapFilters>): void => setFilters({ ...filters, ...changes })
  const filtering = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)

  const [lowestStars, highestStars] = starsBounds(maps)
  // A handle at an end of the slider sets no bound: maps added later stay visible.
  const setStars = ([low, high]: [number, number]): void =>
    update({
      stars: { min: low > lowestStars ? low : null, max: high < highestStars ? high : null }
    })

  const found = useMemo(() => sortMaps(filterMaps(maps, filters), sort), [maps, filters, sort])

  useEffect(() => {
    window.api.getMaps(mode ?? undefined).then(setMaps)
  }, [mode, results])

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Maps</h1>
          <p className="mt-1 text-ink-soft">Tes résultats sur toutes les maps que tu as jouées.</p>
        </div>
        <ModeFilter mode={mode} onChange={(key) => setParams(key ? { mode: key } : {})} />
      </div>

      {maps.length > 0 && (
        <>
          <input
            type="search"
            value={filters.search}
            aria-label="Rechercher une map"
            placeholder="Rechercher un titre, un artiste, un mapper, une difficulté, un ID…"
            onChange={(event) => update({ search: event.target.value })}
            className="mt-5 w-full rounded-lg bg-panel px-4 py-2.5 text-sm text-ink"
          />
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Dropdown
              label="Style"
              placeholder="Tous"
              selected={filters.styles}
              onChange={(styles) => update({ styles })}
              options={styleChoices(maps)}
            />
            <Dropdown
              label="Résultat"
              placeholder="Tous"
              selected={filters.results}
              onChange={(results) => update({ results })}
              options={RESULT_CHOICES}
            />
            <Dropdown
              label="Mods joués"
              placeholder="Tous"
              selected={filters.mods}
              onChange={(mods) => update({ mods })}
              options={MODS_CHOICES}
            />
            <RangeSlider
              label="Étoiles"
              min={lowestStars}
              max={highestStars}
              step={0.1}
              value={[filters.stars.min ?? lowestStars, filters.stars.max ?? highestStars]}
              onChange={setStars}
              format={(stars) => `${stars.toFixed(1)}★`}
            />
            <Dropdown
              single
              label="Tri"
              placeholder="Récentes"
              selected={[sort]}
              onChange={([value]) => setSort(value ?? 'recent')}
              options={SORT_CHOICES}
            />
            {filtering && (
              <button
                onClick={() => setFilters(NO_FILTERS)}
                className="text-sm text-ink-soft hover:text-ink"
              >
                Effacer les filtres
              </button>
            )}
            <span className="ml-auto text-sm text-ink-soft tabular-nums">
              {found.length} map{found.length > 1 ? 's' : ''}
              {found.length > SHOWN_MAPS && ` · ${SHOWN_MAPS} affichées`}
            </span>
          </div>
        </>
      )}

      {status && !mode && (
        <section className="mt-5 rounded-xl bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Depuis le début</h2>
          <ResultBar counts={status.totalResults} />
          <div className="mt-3">
            <ResultLegend counts={status.totalResults} />
          </div>
        </section>
      )}

      {maps.length === 0 && <p className="mt-8 text-ink-soft">Aucune map jouée dans ce mode.</p>}
      {maps.length > 0 && found.length === 0 && (
        <p className="mt-8 text-ink-soft">Aucune map ne correspond à ces filtres.</p>
      )}

      <ul className="mt-4 space-y-2">
        {found.slice(0, SHOWN_MAPS).map((map) => (
          <MapCard key={`${map.checksum}-${map.mode}`} map={map} />
        ))}
      </ul>
    </div>
  )
}
