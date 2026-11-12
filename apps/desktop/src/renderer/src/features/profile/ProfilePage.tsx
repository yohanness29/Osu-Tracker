import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { TopScoreRow } from '@osu-tracker/storage'
import type { AccountStatus } from '../../../../main/account'
import { CopyMapId } from '../../shared/CopyMapId'
import { formatDay, splitMods } from '../../shared/format'
import { MapCover } from '../../shared/MapCover'
import { onMapContextMenu } from '../../shared/mapMenu'
import { ModeFilter } from '../../shared/ModeFilter'
import { useTracking } from '../../store'
import { useAccount } from './useAccount'

const OAUTH_SETTINGS_URL = 'https://osu.ppy.sh/home/account/edit#oauth'
const DEFAULT_MODE = 'osu'

function CredentialsForm({ account }: { account: AccountStatus }): React.JSX.Element {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const inputClass = 'w-full rounded-lg bg-panel-raised px-3 py-2 text-sm text-ink'

  return (
    <section className="mt-6 max-w-2xl rounded-xl bg-panel p-6">
      <h2 className="text-lg font-bold">Relier ton compte osu!</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
        <li>
          Ouvre tes{' '}
          <a
            href={OAUTH_SETTINGS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-ink underline hover:text-accent"
          >
            paramètres OAuth
          </a>{' '}
          et crée une nouvelle application nommée Osu!tracker.
        </li>
        <li>
          Comme Application Callback URL, indique exactement{' '}
          <code className="rounded bg-panel-raised px-1.5 py-0.5 text-ink select-text">
            {account.redirectUri}
          </code>
        </li>
        <li>Copie ici le Client ID et le Client Secret obtenus.</li>
      </ol>

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          window.api.saveCredentials({ clientId, clientSecret })
        }}
      >
        <input
          required
          value={clientId}
          aria-label="Client ID"
          placeholder="Client ID"
          onChange={(event) => setClientId(event.target.value)}
          className={inputClass}
        />
        <input
          required
          type="password"
          value={clientSecret}
          aria-label="Client Secret"
          placeholder="Client Secret"
          onChange={(event) => setClientSecret(event.target.value)}
          className={inputClass}
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page"
        >
          Enregistrer
        </button>
      </form>

      <p className="mt-3 text-xs text-ink-soft">
        {account.encrypted
          ? 'Ces informations restent sur ce PC, chiffrées par le système.'
          : 'Ces informations restent sur ce PC, mais sans chiffrement : aucun trousseau système disponible.'}
      </p>
    </section>
  )
}

function ConnectCard(): React.JSX.Element {
  return (
    <section className="mt-6 max-w-2xl rounded-xl bg-panel p-6">
      <h2 className="text-lg font-bold">Dernière étape</h2>
      <p className="mt-2 text-sm text-ink-soft">
        osu! va s’ouvrir dans ton navigateur pour autoriser Osu!tracker à lire ton profil public.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => window.api.login()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page"
        >
          Se connecter
        </button>
        <button
          onClick={() => window.api.saveCredentials({ clientId: '', clientSecret: '' })}
          className="rounded-lg px-3 py-2 text-sm text-ink-soft hover:text-ink"
        >
          Changer de clé
        </button>
      </div>
    </section>
  )
}

function TopScoreCard(props: { score: TopScoreRow }): React.JSX.Element {
  const { score } = props

  return (
    <li
      onContextMenu={onMapContextMenu(
        score.checksum
          ? {
              beatmapChecksum: score.checksum,
              mode: score.mode,
              beatmapId: score.beatmapId,
              beatmapsetId: score.beatmapsetId,
              title: score.title,
              artist: score.artist,
              version: score.version,
              mapper: score.mapper ?? ''
            }
          : null
      )}
      className="relative overflow-hidden rounded-xl bg-panel"
    >
      <MapCover
        beatmapsetId={score.beatmapsetId}
        variant="card"
        className="absolute inset-y-0 right-0 h-full w-2/3"
        fadeIn
      />
      <div className="absolute inset-0 bg-gradient-to-r from-panel from-30% via-panel/60 via-55% to-panel/20" />
      <div className="relative on-cover flex items-center gap-4 p-4">
        <span className="w-7 shrink-0 text-right text-sm text-ink-soft tabular-nums">
          {score.position + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            {score.title} [{score.version}]
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink-soft tabular-nums">
            <span>
              {(score.moddedStars ?? score.stars).toFixed(2)}★ · {score.rank} ·{' '}
              {formatDay(score.playedAt)}
            </span>
            {splitMods(score.mods).map((mod) => (
              <span key={mod} className="rounded bg-panel-raised px-1.5 py-0.5 font-semibold">
                {mod}
              </span>
            ))}
            <CopyMapId beatmapId={score.beatmapId} />
          </div>
        </div>
        <span className="w-16 shrink-0 text-right text-sm tabular-nums">
          {score.accuracy.toFixed(2)}%
        </span>
        <div className="w-24 shrink-0 text-right tabular-nums">
          <div className="font-bold">{score.pp.toFixed(0)}pp</div>
          {score.weightPercent !== null && (
            <div className="text-xs text-ink-soft">pondéré à {score.weightPercent.toFixed(0)}%</div>
          )}
        </div>
      </div>
    </li>
  )
}

function TopScores({ account }: { account: AccountStatus }): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const liveMode = useTracking((state) => state.frame?.play.mode)
  const mode = params.get('mode') ?? liveMode ?? account.user?.mode ?? DEFAULT_MODE
  const [scores, setScores] = useState<TopScoreRow[]>([])

  useEffect(() => {
    window.api.getTopScores(mode).then(setScores)
  }, [mode, account.syncing])

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-4">
        <ModeFilter
          mode={mode}
          onChange={(key) => key && setParams({ mode: key })}
          withAll={false}
        />
        <button
          disabled={account.syncing}
          onClick={() => window.api.refreshAccount()}
          className="rounded-lg bg-panel px-3 py-1.5 text-sm font-medium text-ink-soft hover:text-ink disabled:opacity-60"
        >
          {account.syncing ? 'Mise à jour…' : 'Actualiser'}
        </button>
      </div>
      {scores.length === 0 && !account.syncing && (
        <p className="mt-6 text-ink-soft">Aucun top play dans ce mode.</p>
      )}
      <ul className="mt-4 space-y-2">
        {scores.map((score) => (
          <TopScoreCard key={score.scoreId} score={score} />
        ))}
      </ul>
    </>
  )
}

export function ProfilePage(): React.JSX.Element {
  const account = useAccount()

  if (!account) return <div className="h-full" />

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Profil</h1>
          <p className="mt-1 text-ink-soft">
            {account.user
              ? `Connecté en tant que ${account.user.name}.`
              : 'Tes top plays et ton gain réel.'}
          </p>
        </div>
        {account.user && (
          <button
            onClick={() => window.api.logout()}
            className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
          >
            Se déconnecter
          </button>
        )}
      </div>

      {account.error && (
        <p className="mt-4 rounded-lg bg-panel p-3 text-sm font-medium">
          <span aria-hidden className="text-failed">
            ✕{' '}
          </span>
          {account.error}
        </p>
      )}

      {!account.hasCredentials && <CredentialsForm account={account} />}
      {account.hasCredentials && !account.user && <ConnectCard />}
      {account.user && <TopScores account={account} />}
    </div>
  )
}
