import { useEffect, useState } from 'react'
import type { UpdateState } from '../../../../main/updates'
import { Switch } from '../../shared/Switch'
import { useUpdateState } from '../../shared/useUpdateState'

const BUTTON = 'rounded-lg bg-panel-raised px-3 py-1.5 font-medium hover:bg-line'
const MAIN_BUTTON = 'rounded-lg bg-accent px-3 py-1.5 font-semibold text-on-accent'

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
        ? `La version ${state.version}${state.beta ? ' (bêta)' : ''} est disponible.`
        : `La version ${state.version}${state.beta ? ' (bêta)' : ''} est sortie : lancée depuis les sources, l’app ne peut pas s’installer elle-même.`
    case 'downloading':
      return `Téléchargement de la version ${state.version} : ${state.percent} %`
    case 'ready':
      return `La version ${state.version} est prête : l’app redémarre pour l’installer.`
    case 'error':
      return `Recherche impossible : ${state.message}`
  }
}

/** A version with a suffix after its numbers, as 1.1.0-beta.1. */
function isBeta(version: string): boolean {
  return /^v?\d+(\.\d+)*-/.test(version)
}

function BetaBadge(): React.JSX.Element {
  return (
    <span className="ml-1.5 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent uppercase">
      Bêta
    </span>
  )
}

/** The choice of the betas: off, the app only gets the stable versions. */
function BetaRow(props: { version: string | null }): React.JSX.Element {
  const [beta, setBeta] = useState<boolean | null>(null)
  useEffect(() => {
    window.api.getBetaUpdates().then(setBeta).catch(console.error)
  }, [])
  const onBeta = props.version !== null && isBeta(props.version)

  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium">Recevoir les versions bêta</div>
        <div className="text-xs text-ink-soft">
          Les nouveautés avant tout le monde, mais elles peuvent avoir des bugs. Sinon, l’app ne
          reçoit que les versions stables.
          {beta === false &&
            onBeta &&
            ' Tu gardes ta bêta jusqu’à la prochaine version stable, qui la remplacera.'}
        </div>
      </div>
      <Switch
        checked={beta ?? false}
        disabled={beta === null}
        label="Recevoir les versions bêta"
        onChange={(next) => {
          setBeta(next)
          window.api.setBetaUpdates(next).catch(console.error)
        }}
      />
    </label>
  )
}

export function UpdateRow(props: { version: string | null }): React.JSX.Element {
  const state = useUpdateState()

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium">
            Version
            {props.version !== null && isBeta(props.version) && <BetaBadge />}
          </div>
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
          {(state.status === 'up-to-date' ||
            state.status === 'error' ||
            state.status === 'idle') && (
            <button onClick={() => window.api.checkForUpdates()} className={BUTTON}>
              Vérifier
            </button>
          )}
        </div>
      </div>
      <BetaRow version={props.version} />
    </>
  )
}
