import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { TosuLaunch } from '../../../../main/tosu-process'
import { errorMessage } from '../../shared/errors'
import { clearSavedPreferences } from '../../shared/usePersistentState'
import { useTracking } from '../../store'
import { useAccount } from '../profile/useAccount'
import { UpdateRow } from './UpdateRow'

const TOSU_STATES: Record<TosuLaunch, string> = {
  pending: 'En attente de démarrage',
  installing: 'Installation en cours',
  external: 'Lancé en dehors de l’app',
  internal: 'Lancé par l’app',
  unsupported: 'Non disponible sur ce système',
  failed: 'N’a pas pu démarrer'
}

function Section(props: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-xl bg-panel p-5">
      <h2 className="text-lg font-bold">{props.title}</h2>
      <div className="mt-3 space-y-3 text-sm">{props.children}</div>
    </section>
  )
}

function Row(props: {
  label: string
  detail?: React.ReactNode
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium">{props.label}</div>
        {props.detail && <div className="text-xs break-all text-ink-soft">{props.detail}</div>}
      </div>
      <div className="flex shrink-0 gap-2">{props.children}</div>
    </div>
  )
}

const BUTTON = 'rounded-lg bg-panel-raised px-3 py-1.5 font-medium hover:bg-line'

function AccountSection(): React.JSX.Element {
  const account = useAccount()
  const [confirmForget, setConfirmForget] = useState(false)
  if (!account) return <Section title="Compte osu!">{null}</Section>

  return (
    <Section title="Compte osu!">
      <Row
        label={account.user ? `Connecté en tant que ${account.user.name}` : 'Non connecté'}
        detail={
          account.user
            ? 'Sert aux suggestions, aux top plays et à l’import des pools et des matchs.'
            : 'Connecte-toi depuis ton profil pour les suggestions et les tournois.'
        }
      >
        {account.user ? (
          <button onClick={() => window.api.logout()} className={BUTTON}>
            Se déconnecter
          </button>
        ) : (
          <Link to="/profile" className={BUTTON}>
            Se connecter
          </Link>
        )}
      </Row>
      {account.hasCredentials && (
        <Row
          label="Application osu! reliée"
          detail={
            account.encrypted
              ? 'Son identifiant et son secret sont chiffrés par le trousseau du système.'
              : 'Son identifiant et son secret sont enregistrés sans chiffrement : aucun trousseau système trouvé.'
          }
        >
          {confirmForget ? (
            <>
              <button
                onClick={() => {
                  window.api.saveCredentials({ clientId: '', clientSecret: '' })
                  setConfirmForget(false)
                }}
                className="rounded-lg bg-failed px-3 py-1.5 font-semibold text-page"
              >
                Retirer
              </button>
              <button onClick={() => setConfirmForget(false)} className={BUTTON}>
                Annuler
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmForget(true)} className={BUTTON}>
              Retirer l’application
            </button>
          )}
        </Row>
      )}
    </Section>
  )
}

function TosuSection(): React.JSX.Element {
  const connected = useTracking((state) => state.status?.connected ?? false)
  const launch = useTracking((state) => state.status?.tosu ?? 'pending')
  return (
    <Section title="tosu">
      <Row
        label={connected ? 'Connecté' : 'Non connecté'}
        detail={`${TOSU_STATES[launch]}. tosu lit osu! pendant que tu joues : l’app le lance toute seule.`}
      >
        <span className={`size-2.5 rounded-full ${connected ? 'bg-passed' : 'bg-failed'}`} />
      </Row>
    </Section>
  )
}

function InterfaceSection(): React.JSX.Element {
  const [cleared, setCleared] = useState(false)
  return (
    <Section title="Interface">
      <Row
        label="Filtres enregistrés"
        detail="Les recherches et filtres des pages Maps et Suggestions, et le menu replié."
      >
        <button
          onClick={() => {
            clearSavedPreferences()
            setCleared(true)
          }}
          disabled={cleared}
          className={`${BUTTON} disabled:opacity-60`}
        >
          {cleared ? 'Réinitialisés' : 'Réinitialiser'}
        </button>
      </Row>
    </Section>
  )
}

function DataSection(): React.JSX.Element {
  const [info, setInfo] = useState<{ version: string; dataFolder: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    window.api.getAppInfo().then(setInfo).catch(console.error)
  }, [])

  return (
    <Section title="Données">
      <Row label="Dossier des données" detail={info ? info.dataFolder : '…'}>
        <button
          onClick={() =>
            window.api.openDataFolder().catch((failure) => setError(errorMessage(failure)))
          }
          className={BUTTON}
        >
          Ouvrir
        </button>
      </Row>
      <p className="text-xs text-ink-soft">
        Tes sessions, tes maps, tes playlists et tes tournois restent sur ton ordinateur. Copie ce
        dossier pour les sauvegarder.
      </p>
      {error && <p className="text-failed">{error}</p>}
      <UpdateRow version={info?.version ?? null} />
    </Section>
  )
}

export function SettingsPage(): React.JSX.Element {
  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="text-3xl font-bold">Paramètres</h1>
      <div className="mt-6 max-w-2xl space-y-4">
        <AccountSection />
        <TosuSection />
        <InterfaceSection />
        <DataSection />
      </div>
    </div>
  )
}
