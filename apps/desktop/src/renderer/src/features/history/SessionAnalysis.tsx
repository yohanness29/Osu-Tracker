import { useMemo } from 'react'
import { detectFatigue, type Fatigue } from '@osu-tracker/stats'
import type { RecentPlay } from '@osu-tracker/storage'
import { formatDuration, mapName } from '../../shared/format'
import { LineChart, type ChartPoint } from '../../shared/LineChart'

const HARDER_MAPS_STARS = 0.5

function fatigueText(fatigue: Fatigue): string {
  if (fatigue.status === 'insufficient') {
    return `Encore ${fatigue.playsNeeded} map${fatigue.playsNeeded > 1 ? 's' : ''} d’au moins 30 s pour analyser ta fatigue.`
  }

  const accuracy = Math.abs(fatigue.accuracyChange).toFixed(1)
  const later = formatDuration(fatigue.lateFromMs)

  if (fatigue.status === 'declining') {
    const harder =
      fatigue.starsChange >= HARDER_MAPS_STARS
        ? ` Tes maps étaient aussi plus dures en fin de session (+${fatigue.starsChange.toFixed(1)}★), ce qui peut l’expliquer.`
        : ''
    return `Tes performances baissent en fin de session, après ${later} : ${fatigue.accuracyChange < 0 ? `-${accuracy} points de précision` : `UR +${fatigue.unstableRateChange.toFixed(0)}`}.${harder}`
  }
  if (fatigue.status === 'improving')
    return `Tu montes en puissance : +${accuracy} points de précision en fin de session.`
  return 'Tes performances restent stables sur la session.'
}

function toPoints(plays: RecentPlay[], value: (play: RecentPlay) => number): ChartPoint[] {
  return plays.map((play, index) => ({
    label: String(index + 1),
    value: value(play),
    title: mapName(play)
  }))
}

function ChartCard(props: {
  title: string
  points: ChartPoint[]
  unit: string
  decimals: number
}): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-xl bg-panel p-4">
      <h3 className="mb-2 text-sm font-semibold">{props.title}</h3>
      {props.points.length < 2 ? (
        <p className="text-sm text-ink-soft">Pas encore assez de maps terminées.</p>
      ) : (
        <LineChart points={props.points} unit={props.unit} decimals={props.decimals} />
      )}
    </div>
  )
}

/** \`actions\` are in the order of the session. */
export function SessionAnalysis({ actions }: { actions: RecentPlay[] }): React.JSX.Element {
  const finished = useMemo(
    () => actions.filter(({ result }) => result === 'passed' || result === 'failed'),
    [actions]
  )
  const accuracy = useMemo(() => toPoints(finished, (play) => play.accuracy), [finished])
  const unstableRate = useMemo(
    () =>
      toPoints(
        finished.filter((play) => play.unstableRate > 0),
        (play) => play.unstableRate
      ),
    [finished]
  )

  return (
    <div className="mt-3">
      <p className="rounded-xl bg-panel p-4 text-sm font-medium">
        {fatigueText(detectFatigue(actions))}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <ChartCard title="Précision par map" points={accuracy} unit="%" decimals={2} />
        <ChartCard title="Unstable rate par map" points={unstableRate} unit="" decimals={0} />
      </div>
    </div>
  )
}
