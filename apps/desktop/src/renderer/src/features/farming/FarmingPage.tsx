import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { FarmingStatus, FarmSuggestion } from '../../../../main/farming'
import { CopyMapId } from '../../shared/CopyMapId'
import { Dropdown } from '../../shared/Dropdown'
import { splitMods } from '../../shared/format'
import { MapCover } from '../../shared/MapCover'
import { MapStyle } from '../../shared/MapStyle'
import { onMapContextMenu } from '../../shared/mapMenu'
import { errorMessage, importSummary, parseBeatmapId } from './importMap'
import { RangeSlider } from '../../shared/RangeSlider'
import { groupedStyleOptions } from '../../shared/styleGroups'
import { ModeFilter } from '../../shared/ModeFilter'
import { usePersistentState } from '../../shared/usePersistentState'
import { useTracking } from '../../store'
import { useAccount } from '../profile/useAccount'
import {
  activeCriteriaCount,
  clockRate,
  expandMods,
  LENGTH_RANGES,
  matchesCriteria,
  matchesLength,
  matchesSearch,
  matchesStyles,
  criteriaForPlayer,
  rangeFromSlider,
  type Criterion,
  searchFilters,
  suggestionTags,
  type Criteria,
  type CriterionKey
} from './filters'

const DEFAULT_MODE = 'osu'
const SHOWN_MAPS = 40
const ACCURACIES = [95, 96, 97, 98, 99, 100]
// No mods is an empty string, as in the store.
const MODS_CHOICES = [
  { value: '', label: 'NM' },
  { value: 'HD', label: 'HD' },
  { value: 'HR', label: 'HR' },
  { value: 'DT', label: 'DT' }
]
const IN_GAME_MESSAGE =
  'Recherche et analyse bloquées pendant une partie, pour ne pas gêner tes performances. Elles reprennent dès la fin de la map.'
const IDLE: FarmingStatus = { running: false, done: 0, total: 0, error: null, addedMaps: 0 }

function formatLength(seconds: number): string {
  const rounded = Math.round(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

function SuggestionCard(props: { map: FarmSuggestion; supporter: boolean }): React.JSX.Element {
  const { map, supporter } = props
  const rate = clockRate(map.mods)

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
      className="relative overflow-hidden rounded-xl bg-panel transition-transform hover:scale-[1.01]"
    >
      <MapCover
        beatmapsetId={map.beatmapsetId}
        variant="card"
        className="absolute inset-y-0 right-0 h-full w-2/3"
        fadeIn
      />
      <div className="absolute inset-0 bg-gradient-to-r from-panel from-30% via-panel/60 via-55% to-panel/20" />
      <Link
        to={`/maps/${map.checksum}?mode=${map.mode}`}
        aria-label={`Voir ${map.title}`}
        className="absolute inset-0"
      />
      {/* Clicks go through to the link, except on the buttons. */}
      <div className="pointer-events-none relative on-cover flex items-center gap-4 p-4 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            {map.title} [{map.version}]
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs whitespace-nowrap text-ink-soft tabular-nums">
            <MapStyle style={map.style} tags={suggestionTags(map)} />
            {(splitMods(map.mods).length ? splitMods(map.mods) : ['NM']).map((mod) => (
              <span key={mod} className="rounded bg-panel-raised px-1.5 py-0.5 font-semibold">
                {mod}
              </span>
            ))}
            <span>
              {map.stars.toFixed(2)}★ · AR {map.ar.toFixed(1)}
              {map.od === null ? '' : ` · OD ${map.od.toFixed(1)}`} · {Math.round(map.bpm * rate)}{' '}
              BPM · {formatLength(map.lengthSeconds / rate)}
            </span>
            <CopyMapId beatmapId={map.beatmapId} />
          </div>
        </div>
        {supporter && (
          <a
            href={`osu://b/${map.beatmapId}`}
            target="_blank"
            rel="noreferrer"
            title="Ouvrir dans osu!direct"
            className="shrink-0 rounded-lg bg-panel-raised px-3 py-1.5 text-xs font-semibold hover:text-accent"
          >
            osu!direct
          </a>
        )}
        <div className="w-32 shrink-0 text-right tabular-nums">
          <div className="text-lg font-bold text-accent">+{map.gain.toFixed(1)}pp</div>
          <div className="text-xs text-ink-soft">
            {map.pp.toFixed(0)}pp à {map.accuracy.toFixed(1)}%
          </div>
          <div className="text-xs text-ink-soft">SS {map.ssPp.toFixed(0)}pp</div>
        </div>
      </div>
    </li>
  )
}

function CriteriaPanel(props: {
  criteria: Criteria
  criteriaList: Criterion[]
  playerStars: [number, number] | null
  onChange: (key: CriterionKey, range: [number, number]) => void
}): React.JSX.Element {
  const { playerStars } = props
  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-2">
        {props.criteriaList.map((criterion) => {
          const range = props.criteria[criterion.key]
          return (
            <RangeSlider
              key={criterion.key}
              wide
              label={criterion.label}
              min={criterion.min}
              max={criterion.max}
              step={criterion.step}
              value={[range?.min ?? criterion.min, range?.max ?? criterion.max]}
              onChange={(value) => props.onChange(criterion.key, value)}
              format={criterion.format}
            />
          )
        })}
      </div>
      {playerStars && (
        <p className="mt-2 text-xs text-ink-soft">
          Ton niveau : {playerStars[0].toFixed(1)} à {playerStars[1].toFixed(1)}★ d’après tes top
          plays. Sans filtre d’étoiles, la recherche reste dans cette zone.
        </p>
      )}
    </div>
  )
}

/** Why nothing is shown, when maps match the filters but would add nothing. */
function emptyMessage(matching: FarmSuggestion[], accuracy: string | undefined): string {
  if (matching.length === 0) return 'Aucune map pour ces filtres.'

  const target = accuracy ? `à ${accuracy}%` : 'à ta précision habituelle'
  const unreachable = matching.filter(({ excluded }) => excluded === 'unreachable').length
  const reasons = [
    unreachable > 0 &&
      `${unreachable} dépasse${unreachable > 1 ? 'raient' : 'rait'} de loin ton meilleur score`,
    matching.length - unreachable > 0 &&
      `${matching.length - unreachable === 1 ? 'une ne battrait' : `${matching.length - unreachable} ne battraient`} pas tes top plays`
  ].filter(Boolean)
  const count = matching.length === 1 ? '1 map correspond' : `${matching.length} maps correspondent`
  return `${count} à tes filtres, mais aucune ne rapporterait de pp ${target} : ${reasons.join(', ')}. Essaie une autre précision, d’autres mods ou élargis tes filtres.`
}

type ImportResult = { message: string; link?: string }

/**
 * Adds a map chosen by the player, by its id or a link to it. Folded into a button beside
 * the search until needed.
 */
function ImportPanel(props: {
  disabled: boolean
  mods: string[]
  accuracy: number | null
  onResult: (result: ImportResult | null) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const beatmapId = parseBeatmapId(text)

  const close = (): void => {
    setOpen(false)
    setText('')
    props.onResult(null)
  }

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (beatmapId === null) {
      props.onResult({
        message: 'Donne l’identifiant de la difficulté, ou un lien osu! vers elle.'
      })
      return
    }
    setImporting(true)
    try {
      const imported = await window.api.importMap(beatmapId, props.mods, props.accuracy)
      props.onResult({
        message: importSummary(imported),
        link: `/maps/${imported.checksum}?mode=${imported.mode}`
      })
      setText('')
    } catch (error) {
      props.onResult({ message: errorMessage(error) })
    } finally {
      setImporting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg bg-panel px-4 text-sm font-semibold text-ink-soft hover:text-ink"
      >
        Importer une map
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex shrink-0 items-center gap-2">
      <input
        autoFocus
        value={text}
        aria-label="Identifiant ou lien de la map à importer"
        placeholder="Identifiant ou lien osu!"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && close()}
        className="h-full w-64 rounded-lg bg-panel px-4 text-sm text-ink"
      />
      <button
        type="submit"
        disabled={props.disabled || importing || text.trim() === ''}
        title={props.disabled ? IN_GAME_MESSAGE : undefined}
        className="h-full rounded-lg bg-panel px-4 text-sm font-semibold hover:bg-panel-raised disabled:opacity-60"
      >
        {importing ? 'Import…' : 'Importer'}
      </button>
      <button
        type="button"
        onClick={close}
        aria-label="Fermer l’import"
        className="h-full px-1 text-ink-soft hover:text-ink"
      >
        ✕
      </button>
    </form>
  )
}

export function FarmingPage(): React.JSX.Element {
  const account = useAccount()
  const liveMode = useTracking((state) => state.frame?.play.mode)
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode') ?? liveMode ?? account?.user?.mode ?? DEFAULT_MODE

  const inGame = useTracking((state) => state.frame?.state === 'play')
  const [status, setStatus] = useState(IDLE)
  const [suggestions, setSuggestions] = useState<FarmSuggestion[]>([])
  const [accuracy, setAccuracy] = usePersistentState<string[]>('farming-accuracy', [])
  const [modsChoice, setModsChoice] = usePersistentState<string[]>('farming-mods', [])
  const wantedMods = useMemo(() => expandMods(modsChoice), [modsChoice])
  const [styles, setStyles] = usePersistentState<string[]>('farming-styles', [])
  const [lengths, setLengths] = usePersistentState<string[]>('farming-lengths', [])
  const [search, setSearch] = usePersistentState('farming-search', '')
  const [criteria, setCriteria] = usePersistentState<Criteria>('farming-criteria', {})
  const [criteriaOpen, setCriteriaOpen] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const activeCriteria = activeCriteriaCount(criteria)

  const [playerStars, setPlayerStars] = useState<[number, number] | null>(null)
  const criteriaList = useMemo(() => criteriaForPlayer(playerStars), [playerStars])

  useEffect(() => {
    window.api.getPlayerStars(mode).then(setPlayerStars)
  }, [mode, account?.syncing])

  const updateCriterion = (key: CriterionKey, value: [number, number]): void => {
    const criterion = criteriaList.find((entry) => entry.key === key)!
    setCriteria({ ...criteria, [key]: rangeFromSlider(criterion, value) })
  }

  useEffect(() => {
    window.api.getFarmingStatus().then(setStatus)
    return window.api.onFarmingStatus(setStatus)
  }, [])

  // The list grows while maps are analyzed.
  useEffect(() => {
    window.api
      .getSuggestions(mode, accuracy[0] ? Number(accuracy[0]) : null, wantedMods)
      .then(setSuggestions)
  }, [mode, accuracy, wantedMods, status.done, status.running, status.addedMaps, account?.syncing])

  // Maps giving no pp stay in the list only to explain why nothing is shown.
  const matching = useMemo(
    () =>
      suggestions
        .filter((map) => matchesStyles(map, styles))
        .filter((map) => matchesLength(map, lengths))
        .filter((map) => matchesCriteria(map, criteria))
        .filter((map) => matchesSearch(map, search)),
    [suggestions, styles, lengths, criteria, search]
  )
  const shown = useMemo(() => {
    const seen = new Set<number>()
    return matching
      .filter((map) => map.excluded === null)
      .filter((map) => !seen.has(map.beatmapId) && Boolean(seen.add(map.beatmapId)))
      .slice(0, SHOWN_MAPS)
  }, [matching])

  const buttonLabel = status.running
    ? inGame
      ? `Analyse en pause ${status.done} / ${status.total || '…'}`
      : `Analyse ${status.done} / ${status.total || '…'}`
    : inGame
      ? 'Bloqué pendant la partie'
      : 'Chercher des maps'

  const styleOptions = groupedStyleOptions(
    suggestions.flatMap((map) => [...(map.style ? [map.style] : []), ...suggestionTags(map)])
  )

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Suggestions</h1>
          <p className="mt-1 text-ink-soft">
            Des maps à ton niveau, et celles qui feraient monter tes pp.
          </p>
        </div>
        <ModeFilter
          mode={mode}
          onChange={(key) => key && setParams({ mode: key })}
          withAll={false}
        />
      </div>

      {account && !account.user ? (
        <p className="mt-6 text-ink-soft">
          Les suggestions partent de tes top plays :{' '}
          <Link to="/profile" className="text-ink underline hover:text-accent">
            relie ton compte osu!
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-stretch gap-2">
            <input
              type="search"
              value={search}
              aria-label="Rechercher une map"
              placeholder="Rechercher un titre, un artiste, un mapper, une difficulté, un ID…"
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-0 flex-1 rounded-lg bg-panel px-4 py-2.5 text-sm text-ink"
            />
            <ImportPanel
              disabled={inGame || status.running}
              mods={wantedMods}
              accuracy={accuracy[0] ? Number(accuracy[0]) : null}
              onResult={setImportResult}
            />
          </div>
          {importResult && (
            <p className="mt-2 text-sm">
              {importResult.message}
              {importResult.link && (
                <>
                  {' '}
                  <Link
                    to={importResult.link}
                    className="text-ink-soft underline hover:text-accent"
                  >
                    Voir la map
                  </Link>
                </>
              )}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              disabled={status.running || inGame}
              title={inGame ? IN_GAME_MESSAGE : undefined}
              onClick={() =>
                window.api.refreshCatalog(
                  mode,
                  wantedMods,
                  search.trim(),
                  searchFilters(criteria, lengths)
                )
              }
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60"
            >
              {buttonLabel}
            </button>
            <Dropdown
              single
              label="Précision"
              placeholder="La mienne"
              selected={accuracy}
              onChange={setAccuracy}
              options={ACCURACIES.map((value) => ({ value: String(value), label: `${value}%` }))}
            />
            <Dropdown
              label="Mods"
              placeholder="Mes mods"
              selected={modsChoice}
              onChange={setModsChoice}
              options={MODS_CHOICES}
            />
            <Dropdown
              label="Style"
              placeholder="Tous"
              selected={styles}
              onChange={setStyles}
              options={styleOptions}
            />
            <Dropdown
              label="Durée"
              placeholder="Toutes"
              selected={lengths}
              onChange={setLengths}
              options={LENGTH_RANGES}
            />
            <button
              onClick={() => setCriteriaOpen(!criteriaOpen)}
              aria-expanded={criteriaOpen}
              className="rounded-md bg-panel px-3 py-1.5 text-sm text-ink hover:bg-panel-raised"
            >
              Critères{activeCriteria > 0 ? ` (${activeCriteria})` : ''}
            </button>
          </div>

          {criteriaOpen && (
            <CriteriaPanel
              criteria={criteria}
              criteriaList={criteriaList}
              playerStars={playerStars}
              onChange={updateCriterion}
            />
          )}

          {status.error && <p className="mt-4 text-sm font-medium">{status.error}</p>}
          {inGame && <p className="mt-3 text-sm font-medium">{IN_GAME_MESSAGE}</p>}
          {status.running && !inGame && (
            <p className="mt-3 text-sm text-ink-soft">La liste se remplit au fur et à mesure.</p>
          )}
          {shown.length === 0 && !status.running && (
            <p className="mt-6 text-ink-soft">
              {suggestions.length === 0
                ? 'Lance une recherche pour trouver des maps à ton niveau avec ces mods.'
                : emptyMessage(
                    matching.filter(
                      (map, index) =>
                        matching.findIndex(({ beatmapId }) => beatmapId === map.beatmapId) === index
                    ),
                    accuracy[0]
                  )}
            </p>
          )}

          <ul className="mt-4 space-y-2">
            {shown.map((map) => (
              <SuggestionCard
                key={map.beatmapId}
                map={map}
                supporter={account?.user?.supporter ?? false}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
