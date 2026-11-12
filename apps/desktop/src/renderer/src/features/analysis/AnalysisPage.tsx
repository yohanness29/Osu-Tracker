import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  findWeakSpots,
  MIN_PLAYS,
  sessionProgress,
  type Dimension,
  type SessionPoint
} from '@osu-tracker/stats'
import type { RecentPlay } from '@osu-tracker/storage'
import { LineChart, type ChartPoint } from '../../shared/LineChart'
import { ModeFilter } from '../../shared/ModeFilter'
import { useTracking } from '../../store'

const MAX_MODS = 8
const UNORDERED_DIMENSIONS = ['Mods', 'Style']
const WIDE_DIMENSION = 'BPM'
const COLUMN_SPANS: Record<string, string> = { Mods: 'col-span-2', BPM: 'col-span-3' }
const PERCENT_RANGE: [number, number] = [0, 100]
const ACCURACY_RANGE_STEP = 5

type Metric = 'passRate' | 'accuracy'

const METRICS: { key: Metric; label: string }[] = [
  { key: 'passRate', label: 'Taux de pass' },
  { key: 'accuracy', label: 'Précision' }
]

function toPoints(dimension: Dimension, metric: Metric): ChartPoint[] {
  // Combinations of mods can be numerous: only the most played ones are readable.
  const buckets =
    dimension.title === 'Mods'
      ? dimension.buckets.toSorted((a, b) => b.plays - a.plays).slice(0, MAX_MODS)
      : dimension.buckets

  const wide = dimension.title === WIDE_DIMENSION

  return buckets.flatMap(({ label, passRate, plays, averageAccuracy, averageStars }) => {
    const value = metric === 'passRate' ? passRate : averageAccuracy
    if (value === null) return []

    return [
      {
        // Only the start of each range fits on the axis.
        label: wide ? label.split('–')[0]! : label,
        value,
        title: wide ? `${label} BPM` : label,
        muted: plays < MIN_PLAYS,
        details: [
          `${averageStars.toFixed(2)}★ en moyenne`,
          `${plays} map${plays > 1 ? 's' : ''} terminée${plays > 1 ? 's' : ''}`,
          metric === 'passRate'
            ? averageAccuracy === null
              ? ''
              : `${averageAccuracy.toFixed(2)}% de précision`
            : `${passRate.toFixed(0)}% de pass`
        ].filter(Boolean)
      }
    ]
  })
}

/** Accuracy stays in a narrow band: a full 0 to 100 scale would flatten every difference. */
function accuracyRange(points: ChartPoint[]): [number, number] {
  const lowest = Math.min(...points.map(({ value }) => value))
  const start = Math.floor((lowest - 1) / ACCURACY_RANGE_STEP) * ACCURACY_RANGE_STEP
  return [Math.max(0, start), 100]
}

function SessionChart(props: {
  title: string
  hint?: string
  points: ChartPoint[]
  unit: string
  decimals: number
  reference?: number
}): React.JSX.Element {
  const { title, hint, points, unit, decimals, reference } = props

  return (
    <section className="min-w-0 rounded-xl bg-panel p-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      {points.length < 2 ? (
        <p className="mt-2 text-sm text-ink-soft">Il faut au moins deux sessions.</p>
      ) : (
        <div className="mt-1">
          <LineChart points={points} unit={unit} decimals={decimals} reference={reference} />
        </div>
      )}
    </section>
  )
}

function DimensionCard(props: {
  dimension: Dimension
  metric: Metric
  average: number | null
}): React.JSX.Element {
  const { dimension, metric, average } = props
  const points = useMemo(() => toPoints(dimension, metric), [dimension, metric])
  const range = useMemo(
    () => (metric === 'passRate' ? PERCENT_RANGE : accuracyRange(points)),
    [metric, points]
  )

  return (
    <section
      className={`min-w-0 rounded-xl bg-panel p-3 ${COLUMN_SPANS[props.dimension.title] ?? ''}`}
    >
      <h3 className="mb-1 text-sm font-semibold">{props.dimension.title}</h3>
      <LineChart
        points={points}
        unit="%"
        decimals={metric === 'passRate' ? 0 : 2}
        range={range}
        reference={average}
        bars={UNORDERED_DIMENSIONS.includes(props.dimension.title)}
      />
    </section>
  )
}

export function AnalysisPage(): React.JSX.Element {
  const results = useTracking((state) => state.status?.totalResults)
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode')
  const metric: Metric = params.get('metric') === 'accuracy' ? 'accuracy' : 'passRate'
  const setParam = (key: string, value: string | null): void =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  const [allPlays, setPlays] = useState<RecentPlay[]>([])
  const plays = useMemo(
    () => (mode ? allPlays.filter((play) => play.mode === mode) : allPlays),
    [allPlays, mode]
  )

  useEffect(() => {
    window.api.getAllPlays().then(setPlays)
  }, [results])

  const spots = useMemo(() => findWeakSpots(plays), [plays])
  const progress = useMemo(() => sessionProgress(plays), [plays])
  const toChart = (value: (point: SessionPoint) => number | null): ChartPoint[] =>
    progress.flatMap((point) => {
      const measure = value(point)
      if (measure === null) return []
      const day = new Date(point.startedAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short'
      })
      return [{ label: day, value: measure, title: `${day} · ${point.passes} pass` }]
    })

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analyse</h1>
          <p className="mt-1 text-ink-soft">
            {spots.overallPassRate === null
              ? 'Termine quelques maps pour voir ton analyse.'
              : `${spots.overallPassRate.toFixed(0)}% de pass sur ${spots.finishedPlays} maps terminées.`}
          </p>
        </div>
        <ModeFilter mode={mode} onChange={(key) => setParam('mode', key)} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <SessionChart
          title="Précision par session"
          points={toChart(({ accuracy }) => accuracy)}
          unit="%"
          decimals={2}
        />
        <SessionChart
          title="100 et 50 par session"
          points={toChart(({ imperfectShare }) => imperfectShare)}
          unit="%"
          decimals={1}
        />
        <SessionChart
          title="Timing par session"
          hint="Sous 0 : en avance. Au-dessus : en retard."
          points={toChart(({ hitError }) => hitError)}
          unit=" ms"
          decimals={1}
          reference={0}
        />
      </div>

      <h2 className="mt-6 mb-2 text-lg font-bold">Points faibles</h2>
      {spots.weakest.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Aucun point faible net pour l’instant. Une tranche doit compter au moins 5 maps terminées
          et passer 15 points sous ton niveau habituel aux mêmes étoiles.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-3">
          {spots.weakest.slice(0, 3).map((spot) => (
            <li key={`${spot.dimension}-${spot.label}`} className="rounded-xl bg-panel p-4">
              <div className="text-xs font-medium text-ink-soft">{spot.dimension}</div>
              <div className="mt-1 text-xl font-bold">{spot.label}</div>
              <div className="mt-1 text-sm text-ink-soft tabular-nums">
                {spot.passRate.toFixed(0)}% de pass à {spot.averageStars.toFixed(1)}★,{' '}
                {spot.gap.toFixed(0)} points sous ton niveau habituel à ces étoiles ({spot.plays}{' '}
                maps)
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">Par type de map</h2>
        <div className="flex gap-1 rounded-lg bg-panel p-1">
          {METRICS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setParam('metric', key === 'passRate' ? null : key)}
              aria-pressed={metric === key}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                metric === key ? 'bg-panel-raised text-ink' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 mb-2 text-sm text-ink-soft">
        {metric === 'accuracy' && 'Précision moyenne sur les pass. '}La ligne pointillée marque ta
        moyenne. Survole une valeur pour voir ses étoiles moyennes. Les valeurs foncées comptent
        moins de {MIN_PLAYS} maps, donc elles sont peu fiables.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {spots.dimensions
          .filter(({ buckets }) => buckets.length > 0)
          .map((dimension) => (
            <DimensionCard
              key={dimension.title}
              dimension={dimension}
              metric={metric}
              average={metric === 'passRate' ? spots.overallPassRate : spots.overallAccuracy}
            />
          ))}
      </div>
    </div>
  )
}
