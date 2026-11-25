import { useCallback, useEffect, useState } from 'react'
import { goalProgress } from '@osu-tracker/stats'
import type { Goal, GoalType, RecentPlay } from '@osu-tracker/storage'
import { Dropdown } from '../../shared/Dropdown'

const GOAL_TYPES: { type: GoalType; label: string; target: number }[] = [
  { type: 'pp_gain', label: 'Gagner des pp', target: 20 },
  { type: 'passes', label: 'Passer des maps', target: 5 },
  { type: 'full_combos', label: 'Faire des FC', target: 3 },
  { type: 'accuracy', label: 'Précision moyenne', target: 97 }
]

function goalLabel({ type, target, minStars }: Goal): string {
  switch (type) {
    case 'pp_gain':
      return `Gagner ${target}pp`
    case 'passes':
      return `Passer ${target} map${target > 1 ? 's' : ''}`
    case 'full_combos':
      return `${target} FC${minStars ? ` à ${minStars}★ et plus` : ''}`
    case 'accuracy':
      return `${target}% de précision moyenne`
  }
}

function formatValue(type: GoalType, value: number | null): string {
  if (value === null) return '–'
  if (type === 'accuracy') return `${value.toFixed(2)}%`
  if (type === 'pp_gain') return `${value.toFixed(0)}pp`
  return String(value)
}

function GoalRow(props: {
  goal: Goal
  plays: RecentPlay[]
  ppGain: number | null
  onRemove: () => void
}): React.JSX.Element {
  const { goal, plays, ppGain, onRemove } = props
  const { current, target, done } = goalProgress(goal, plays, ppGain)
  const share = current === null ? 0 : Math.max(0, Math.min(1, current / target))

  return (
    <li className="flex items-center gap-3 text-sm">
      <span aria-hidden className={done ? 'text-passed' : 'text-ink-faint'}>
        {done ? '✓' : '○'}
      </span>
      <span className="w-52 shrink-0 truncate font-medium">{goalLabel(goal)}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded bg-panel-raised">
        <div
          className={`h-full rounded ${done ? 'bg-passed' : 'bg-accent'}`}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-xs text-ink-soft tabular-nums">
        {done ? 'Atteint' : formatValue(goal.type, current)}
      </span>
      <button
        onClick={onRemove}
        aria-label={`Retirer l’objectif : ${goalLabel(goal)}`}
        className="shrink-0 rounded px-1 text-ink-faint hover:text-ink"
      >
        ✕
      </button>
    </li>
  )
}

function GoalForm(props: {
  sessionId: string | null
  onAdded: () => void
  onCancel: () => void
}): React.JSX.Element {
  const [type, setType] = useState<GoalType>('pp_gain')
  const [target, setTarget] = useState(20)
  const [minStars, setMinStars] = useState(6)
  const inputClass = 'rounded-md bg-panel-raised px-2 py-1 text-sm text-ink'

  const changeType = (next: GoalType): void => {
    setType(next)
    setTarget(GOAL_TYPES.find((goal) => goal.type === next)!.target)
  }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    if (!(target > 0)) return

    window.api
      .addGoal({
        sessionId: props.sessionId,
        type,
        target,
        minStars: type === 'full_combos' ? minStars : null
      })
      .then(props.onAdded)
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2">
      <Dropdown
        single
        required
        hideLabel
        label="Type d’objectif"
        placeholder="Type d’objectif"
        selected={[type]}
        onChange={([value]) => value && changeType(value as GoalType)}
        options={GOAL_TYPES.map((goal) => ({ value: goal.type, label: goal.label }))}
      />
      <input
        type="number"
        min={0}
        step="any"
        value={target}
        aria-label="Valeur à atteindre"
        onChange={(event) => setTarget(event.target.valueAsNumber)}
        className={`w-20 ${inputClass}`}
      />
      {type === 'full_combos' && (
        <label className="flex items-center gap-1 text-sm text-ink-soft">
          à
          <input
            type="number"
            min={0}
            step="any"
            value={minStars}
            aria-label="Étoiles minimum"
            onChange={(event) => setMinStars(event.target.valueAsNumber)}
            className={`w-16 ${inputClass}`}
          />
          ★ et plus
        </label>
      )}
      <button
        type="submit"
        className="rounded-md bg-accent px-3 py-1 text-sm font-semibold text-on-accent"
      >
        Ajouter
      </button>
      <button
        type="button"
        onClick={props.onCancel}
        className="rounded-md px-2 py-1 text-sm text-ink-soft hover:text-ink"
      >
        Annuler
      </button>
    </form>
  )
}

/** Without session, goals wait for the next one to start. */
export function GoalsPanel(props: {
  sessionId: string | null
  plays: RecentPlay[]
  ppGain: number | null
}): React.JSX.Element {
  const { sessionId, plays, ppGain } = props
  const [goals, setGoals] = useState<Goal[]>([])
  const [adding, setAdding] = useState(false)

  const refresh = useCallback(() => {
    window.api.getGoals(sessionId).then(setGoals)
  }, [sessionId])

  useEffect(refresh, [refresh])

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Objectifs</span>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="rounded-md px-2 py-0.5 text-sm text-ink-soft hover:bg-panel-raised hover:text-ink"
          >
            + Ajouter
          </button>
        )}
      </div>
      {goals.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              plays={plays}
              ppGain={ppGain}
              onRemove={() => window.api.removeGoal(goal.id).then(refresh)}
            />
          ))}
        </ul>
      )}
      {adding && (
        <GoalForm
          sessionId={sessionId}
          onCancel={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}
