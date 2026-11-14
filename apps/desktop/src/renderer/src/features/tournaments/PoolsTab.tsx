import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { TournamentData, ImportProgress } from '../../../../main/tournaments'
import { errorMessage } from '../../shared/errors'
import { MapCover } from '../../shared/MapCover'
import { MapStyle } from '../../shared/MapStyle'
import { onMapContextMenu } from '../../shared/mapMenu'
import {
  CATEGORY_COLORS,
  formatLength,
  percent,
  READINESS,
  trainedSlots,
  type TrainedSlot
} from './tournamentView'

const POOL_EXAMPLE = `NM1 4630139
NM2 https://osu.ppy.sh/beatmapsets/1#taiko/123456
HD1 1234567
HR1 2345678
DT1 3456789
TB 4567890`

function AddPoolForm(props: {
  tournamentId: string
  onAdded: (poolId: string) => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [progress, setProgress] = useState<ImportProgress>(null)
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<string[]>([])

  useEffect(() => window.api.onImportProgress(setProgress), [])

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setMessages([])
    try {
      const result = await window.api.addPool(props.tournamentId, name, text)
      setMessages(result.errors)
      setName('')
      setText('')
      props.onAdded(result.poolId)
    } catch (error) {
      setMessages([errorMessage(error)])
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl bg-panel p-4">
      <h3 className="font-semibold">Ajouter un pool</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Une map par ligne : le slot (NM1, HD2, HR1, DT1, FM1, TB…), puis l’identifiant de la
        difficulté ou son lien osu!. Chaque map est analysée avec les mods de son slot.
      </p>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nom du tour : Qualifiers, RO32…"
        aria-label="Nom du tour"
        className="mt-3 w-full rounded-lg bg-panel-raised px-3 py-2 text-sm"
      />
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={POOL_EXAMPLE}
        aria-label="Maps du pool"
        rows={8}
        className="mt-2 w-full rounded-lg bg-panel-raised px-3 py-2 font-mono text-sm"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page disabled:opacity-60"
        >
          {busy
            ? progress
              ? `Analyse ${progress.done + 1} / ${progress.total}…`
              : 'Import…'
            : 'Importer le pool'}
        </button>
        {busy && (
          <span className="text-xs text-ink-soft">
            Environ 2 secondes par map : l’app télécharge et analyse chacune.
          </span>
        )}
      </div>
      {messages.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {messages.map((message) => (
            <li key={message}>⚠ {message}</li>
          ))}
        </ul>
      )}
    </form>
  )
}

function SlotRow({ slot, mode }: { slot: TrainedSlot; mode: string }): React.JSX.Element {
  const { map, training } = slot
  const readiness = READINESS[training.readiness]
  const color = CATEGORY_COLORS[slot.category]

  return (
    <li
      onContextMenu={onMapContextMenu({
        beatmapChecksum: map.checksum,
        mode,
        beatmapId: map.beatmapId,
        beatmapsetId: map.beatmapsetId,
        title: map.title,
        artist: map.artist,
        version: map.version,
        mapper: map.mapper
      })}
      className="flex items-center gap-4 rounded-xl bg-panel p-3"
    >
      <span
        className="w-12 shrink-0 rounded-md py-1 text-center text-sm font-bold"
        style={{ color, backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }}
      >
        {map.slot}
      </span>
      <MapCover
        beatmapsetId={map.beatmapsetId}
        variant="list"
        className="h-12 w-20 shrink-0 rounded-md"
      />
      <div className="min-w-0 flex-1">
        <Link
          to={`/maps/${map.checksum}?mode=${mode}`}
          className="block truncate font-semibold hover:text-accent"
        >
          {map.title} [{map.version}]
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft tabular-nums">
          <span>
            {map.stars.toFixed(2)}★ · {Math.round(map.bpm)} BPM · OD {map.od.toFixed(1)} ·{' '}
            {formatLength(map.lengthSeconds)}
          </span>
          <MapStyle style={map.style} tags={map.tags} />
        </div>
        {training.readiness !== 'ready' && (
          <div className="mt-0.5 truncate text-xs" style={{ color: readiness.color }}>
            {training.reasons.join(' · ')}
          </div>
        )}
      </div>
      <div className="w-56 shrink-0 text-right text-xs tabular-nums">
        <div className="flex items-center justify-end gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: readiness.color }} />
          <span className="font-semibold" style={{ color: readiness.color }}>
            {readiness.label}
          </span>
        </div>
        {training.recentAccuracy !== null ? (
          <div className="mt-0.5 text-ink-soft">
            {percent(training.recentAccuracy)} · {training.recentMisses?.toFixed(1)} miss
            {training.unstableRate ? ` · UR ${Math.round(training.unstableRate)}` : ''}
          </div>
        ) : null}
        <div className="mt-0.5 text-ink-faint" title={training.reasons.join('\n')}>
          {training.best
            ? `Meilleure : ${percent(training.best.accuracy)} · ${training.best.misses} miss`
            : `${training.attempts} essai${training.attempts > 1 ? 's' : ''}`}
        </div>
      </div>
    </li>
  )
}

export function PoolsTab(props: { data: TournamentData; onChange: () => void }): React.JSX.Element {
  const { data, onChange } = props
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const pool = data.pools.find(({ id }) => id === selectedId) ?? data.pools.at(-1) ?? null
  const slots = pool ? trainedSlots(pool, data.plays) : []
  const counts = Object.fromEntries(
    (['ready', 'fragile', 'weak', 'untested'] as const).map((key) => [
      key,
      slots.filter(({ training }) => training.readiness === key).length
    ])
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {data.pools.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setSelectedId(entry.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              entry.id === pool?.id
                ? 'bg-accent font-semibold text-page'
                : 'bg-panel hover:bg-panel-raised'
            }`}
          >
            {entry.name} <span className="opacity-70">({entry.maps.length})</span>
          </button>
        ))}
        <button
          onClick={() => setAdding(!adding)}
          className="rounded-lg bg-panel px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
        >
          {adding ? 'Fermer' : '+ Ajouter un pool'}
        </button>
      </div>

      {(adding || data.pools.length === 0) && (
        <AddPoolForm
          tournamentId={data.tournament.id}
          onAdded={(poolId) => {
            setSelectedId(poolId)
            setAdding(false)
            onChange()
          }}
        />
      )}

      {pool && (
        <section className="mt-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">
              <span style={{ color: READINESS.ready.color }}>{counts.ready} prêtes</span> ·{' '}
              <span style={{ color: READINESS.fragile.color }}>{counts.fragile} fragiles</span> ·{' '}
              <span style={{ color: READINESS.weak.color }}>{counts.weak} à travailler</span> ·{' '}
              {counts.untested} pas jouées. Tes parties sur ces maps sont rattachées toutes seules à
              leur slot, avec ses mods.
            </p>
            <button
              onClick={() => window.api.deletePool(pool.id).then(onChange).catch(console.error)}
              className="shrink-0 text-sm text-ink-soft hover:text-failed"
            >
              Supprimer ce pool
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {slots.map((slot) => (
              <SlotRow key={slot.slot} slot={slot} mode={data.tournament.mode} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
