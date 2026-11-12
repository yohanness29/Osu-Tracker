import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CalendarView } from './CalendarView'
import { SessionDetail } from './SessionDetail'
import { SessionTree } from './SessionTree'
import { useSessions } from './useSessions'

const VIEWS = [
  { key: 'explorer', label: 'Explorateur' },
  { key: 'calendar', label: 'Calendrier' }
]

const TREE_OPEN_KEY = 'history.treeOpen'

function readTreeOpen(): boolean {
  try {
    return localStorage.getItem(TREE_OPEN_KEY) !== 'false'
  } catch {
    return true
  }
}

function saveTreeOpen(open: boolean): void {
  try {
    localStorage.setItem(TREE_OPEN_KEY, String(open))
  } catch {
    // Only a convenience: the panel simply reopens next time.
  }
}

export function HistoryPage(): React.JSX.Element {
  const [treeOpen, setTreeOpen] = useState(readTreeOpen)
  const toggleTree = (): void => {
    saveTreeOpen(!treeOpen)
    setTreeOpen(!treeOpen)
  }
  const { sessions, refresh } = useSessions()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'calendar' ? 'calendar' : 'explorer'
  const openSession = (sessionId: string): void => setParams({ session: sessionId })

  if (sessions === null) return <div className="h-full" />

  const selected = sessions.find(({ id }) => id === params.get('session')) ?? sessions[0]

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-8 pt-6">
        <h1 className="text-3xl font-bold">Historique</h1>
        <div className="flex gap-1 rounded-lg bg-panel p-1">
          {VIEWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setParams({ view: key })}
              aria-pressed={view === key}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === key ? 'bg-panel-raised text-ink' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {!selected && <p className="px-8 pt-8 text-ink-soft">Aucune session enregistrée.</p>}

      {selected && view === 'calendar' && (
        <div className="min-h-0 flex-1 px-2">
          <CalendarView sessions={sessions} onOpen={openSession} />
        </div>
      )}

      {selected && view === 'explorer' && (
        <div className="flex min-h-0 flex-1 gap-2 p-4 pt-4">
          <nav
            aria-label="Sessions"
            className={`shrink-0 overflow-y-auto rounded-xl bg-panel p-2 ${treeOpen ? 'w-56' : 'w-11'}`}
          >
            <button
              onClick={toggleTree}
              aria-expanded={treeOpen}
              aria-label={treeOpen ? 'Replier les sessions' : 'Déplier les sessions'}
              title={treeOpen ? 'Replier les sessions' : 'Déplier les sessions'}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-semibold text-ink-soft hover:bg-panel-raised hover:text-ink"
            >
              {treeOpen && <span>Sessions</span>}
              <span aria-hidden>{treeOpen ? '«' : '»'}</span>
            </button>
            {treeOpen && (
              <SessionTree sessions={sessions} selectedId={selected.id} onSelect={openSession} />
            )}
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto px-4 py-2">
            <SessionDetail key={selected.id} session={selected} onRenamed={refresh} />
          </div>
        </div>
      )}
    </div>
  )
}
