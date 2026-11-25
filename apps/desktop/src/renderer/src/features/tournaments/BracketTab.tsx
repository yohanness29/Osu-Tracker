import { useEffect, useMemo, useRef, useState } from 'react'
import { parseChallonge } from '@osu-tracker/stats'
import type { TournamentData } from '../../../../main/tournaments'
import { Choices } from '../../shared/Choices'
import { errorMessage } from '../../shared/errors'
import { usePersistentState } from '../../shared/usePersistentState'
import { themeColor, useTheme } from '../../shared/theme'
import { useDragScroll } from '../../shared/useDragScroll'
import { svgDataUrl, themedBracket } from './challongeSvg'

/** The link of the bracket on Challonge: pasted once, kept with the tournament. */
export function ChallongeField(props: {
  data: TournamentData
  onChange: () => void
}): React.JSX.Element {
  const { tournament } = props.data
  const [text, setText] = useState(tournament.challonge ? `https://${tournament.challonge}` : '')
  const [error, setError] = useState<string | null>(null)

  const save = (event: React.FormEvent): void => {
    event.preventDefault()
    const challonge = text.trim() ? parseChallonge(text) : null
    if (text.trim() && !challonge) {
      setError('Ce n’est pas un lien Challonge : il ressemble à challonge.com/…')
      return
    }
    setError(null)
    window.api
      .updateTournament(tournament.id, { challonge })
      .then(props.onChange)
      .catch(console.error)
  }

  return (
    <form onSubmit={save}>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="https://challonge.com/…"
          aria-label="Lien du bracket sur Challonge"
          className="min-w-0 flex-1 rounded-lg bg-panel-raised px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent"
        >
          Enregistrer
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-failed">{error}</p>}
    </form>
  )
}

const ZOOMS = [
  { value: 'fit', label: 'Ajusté' },
  { value: 'full', label: 'Taille réelle' }
] as const

/** The bracket of Challonge, in the colors of the app, the player's name set apart. */
export function BracketTab(props: {
  data: TournamentData
  onChange: () => void
}): React.JSX.Element {
  const { data } = props
  const { tournament } = data
  const [version, setVersion] = useState(0)
  // The answer of the latest request: loading while it is for an older one.
  const request = `${tournament.challonge}-${version}`
  const [result, setResult] = useState<{
    request: string
    svg: string | null
    error: string | null
  } | null>(null)
  const [zoom, setZoom] = usePersistentState<'fit' | 'full'>('bracket-zoom', 'fit')
  const theme = useTheme((state) => state.theme)
  const drag = useDragScroll()

  // The latest callback, read when an answer comes: as a dependency, each new one would read
  // Challonge again, and the reload it starts would give a new one, endlessly.
  const onChange = useRef(props.onChange)
  useEffect(() => {
    onChange.current = props.onChange
  })

  useEffect(() => {
    if (!tournament.challonge) return
    let current = true
    // A refresh asked by the player reads Challonge again, and with it who is still in.
    const fresh = version > 0
    window.api
      .getChallongeBracket(tournament.id, fresh)
      .then((svg) => {
        if (!current) return
        setResult({ request, svg, error: null })
        if (fresh) onChange.current()
      })
      .catch(
        (failure) => current && setResult({ request, svg: null, error: errorMessage(failure) })
      )
    return () => {
      current = false
    }
  }, [tournament.id, tournament.challonge, request, version])

  const loading = tournament.challonge !== null && result?.request !== request
  const svg = result?.svg ?? null
  const error = loading ? null : (result?.error ?? null)

  const image = useMemo(() => {
    if (!svg) return null
    const colors = {
      text: themeColor('ink'),
      textSoft: themeColor('ink-soft'),
      textFaint: themeColor('ink-faint'),
      box: themeColor('panel-raised'),
      boxSoft: themeColor('line'),
      line: themeColor('line'),
      accent: themeColor('accent'),
      onAccent: themeColor('on-accent')
    }
    return svgDataUrl(themedBracket(svg, colors, data.me?.username ?? null))
    // The colors change with the theme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg, theme, data.me?.username])

  if (!tournament.challonge) {
    return (
      <div className="max-w-xl rounded-xl bg-panel p-5">
        <h2 className="font-semibold">Bracket</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Colle le lien du bracket du tournoi sur Challonge : il s’affiche ici aux couleurs de
          l’app, ton pseudo mis en avant.
        </p>
        <div className="mt-4">
          <ChallongeField data={data} onChange={props.onChange} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Choices label="Zoom du bracket" value={zoom} choices={[...ZOOMS]} onChange={setZoom} />
        <button
          onClick={() => setVersion((current) => current + 1)}
          disabled={loading}
          className="rounded-lg bg-panel px-3 py-1.5 text-sm hover:bg-panel-raised disabled:opacity-60"
        >
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
        <a
          href={`https://${tournament.challonge}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-ink-soft underline hover:text-accent"
        >
          Ouvrir sur Challonge
        </a>
      </div>

      {error && <p className="mt-4 text-failed">{error}</p>}
      {!error && !image && loading && <p className="mt-4 text-ink-soft">Chargement du bracket…</p>}
      {image && (
        <div
          {...drag.handlers}
          title="Clique et fais glisser pour te déplacer dans le bracket"
          className={`mt-4 max-h-[75vh] overflow-auto rounded-xl bg-panel p-4 ${
            drag.dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <img
            src={image}
            alt={`Bracket de ${tournament.name}`}
            draggable={false}
            className={zoom === 'fit' ? 'h-auto w-full' : 'max-w-none'}
          />
        </div>
      )}
    </div>
  )
}
