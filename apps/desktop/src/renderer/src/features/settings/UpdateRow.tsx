import type { UpdateState } from '../../../../main/updates'
import { useUpdateState } from '../../shared/useUpdateState'

const BUTTON = 'rounded-lg bg-panel-raised px-3 py-1.5 font-medium hover:bg-line'
const MAIN_BUTTON = 'rounded-lg bg-accent px-3 py-1.5 font-semibold text-page'

function describe(state: UpdateState): string {
  switch (state.status) {
    case 'idle':
      return ''
    case 'checking':
      return 'Recherche d’une nouvelle version…'
    case 'up-to-date':
      return 'Tu as la dernière version.'
    case 'available':
      return state.installable
        ? `La version ${state.version} est disponible.`
        : `La version ${state.version} est sortie : lancée depuis les sources, l’app ne peut pas s’installer elle-même.`
    case 'downloading':
      return `Téléchargement de la version ${state.version} : ${state.percent} %`
    case 'ready':
      return `La version ${state.version} est prête : l’app redémarre pour l’installer.`
    case 'error':
      return `Recherche impossible : ${state.message}`
  }
}

export function UpdateRow(props: { version: string | null }): React.JSX.Element {
  const state = useUpdateState()

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium">Version</div>
        <div className="text-xs text-ink-soft">
          Osu!tracker {props.version ?? '…'}
          {describe(state) && ` · ${describe(state)}`}
        </div>
        {state.status === 'downloading' && (
          <div className="mt-1.5 h-1 w-48 overflow-hidden rounded bg-panel-raised">
            <div className="h-full bg-accent" style={{ width: `${state.percent}%` }} />
          </div>
        )}
      </div>
      <div className="shrink-0">
        {state.status === 'available' && (
          <button onClick={() => window.api.downloadUpdate()} className={MAIN_BUTTON}>
            {state.installable ? 'Mettre à jour' : 'Voir la version'}
          </button>
        )}
        {state.status === 'ready' && (
          <button onClick={() => window.api.installUpdate()} className={MAIN_BUTTON}>
            Redémarrer et installer
          </button>
        )}
        {(state.status === 'up-to-date' || state.status === 'error' || state.status === 'idle') && (
          <button onClick={() => window.api.checkForUpdates()} className={BUTTON}>
            Vérifier
          </button>
        )}
      </div>
    </div>
  )
}
