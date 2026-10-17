import { useRef, useState } from 'react'
import { DropboxMenu } from './DropboxMenu'
import { useDropboxStatus } from '../pokestorage/useStorage'
import { SPRITE_SOURCES } from '../pokestorage/spriteSources'
import { dropboxAccount } from '../../services/storage/dropbox'
import { useHubStartup } from './useHubStartup'

export function StartMenu({
  startup,
  onStart,
}: {
  startup: ReturnType<typeof useHubStartup>
  onStart: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [sourceId, setSourceId] = useState(
    startup.sourceId ?? SPRITE_SOURCES[0].id
  )
  const [chooseSource, setChooseSource] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const status = useDropboxStatus()

  const connect = async () => {
    setBusy(true)
    setError(null)
    try {
      await dropboxAccount.signIn()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  const start = () => {
    if (startup.sourceId) onStart()
    else {
      setChooseSource(true)
      dialog.current?.showModal()
    }
  }
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await startup.provider.saveSettings({ spriteSourceId: sourceId })
      startup.setSourceId(sourceId)
      dialog.current?.close()
      onStart()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="camp-root hub-root hub-start">
      <DropboxMenu />
      <div className="hub-start-center">
        <h1 className="camp-title">pkCamp</h1>
        <button
          className="hub-start-button"
          disabled={!startup.ready}
          onClick={start}
        >
          Start
        </button>
        {!startup.ready && !startup.error && (
          <p role="status">Loading your settings…</p>
        )}
        {startup.error && (
          <p role="alert">
            {startup.error} <button onClick={startup.retry}>Retry</button>
          </p>
        )}
      </div>
      <footer className="hub-credits">
        <p>Made possible by these projects and their contributors</p>
        <p>
          <a href="https://github.com/kwsch/PKHeX">PKHeX</a> ·{' '}
          <a href="https://github.com/EthanThatOneKid/pkhex-wasm">pkhex-wasm</a>{' '}
          ·{' '}
          <a href="https://github.com/GB-Link/GB-Link-Switch-LDN">
            GB-Link-Switch-LDN
          </a>{' '}
          ·{' '}
          <a href="https://github.com/GB-Link/gb-cart-doctor-web">
            GB-Link Cart Doctor
          </a>{' '}
          ·{' '}
          <a href="https://github.com/FIX94/gba-link-cable-dumper">
            GBA Link Cable Dumper
          </a>
        </p>
        <p>
          {SPRITE_SOURCES.map((source, index) => (
            <span key={source.id}>
              {index > 0 && ' · '}
              <a href={source.homepage}>{source.label.split(' — ')[0]}</a>
            </span>
          ))}
        </p>
        <p>Pokémon © Nintendo / Creatures Inc. / GAME FREAK inc.</p>
      </footer>
      <dialog
        ref={dialog}
        className="hub-dialog"
        onClose={() => setError(null)}
      >
        <h2>{chooseSource ? 'Welcome to pkCamp' : 'Dropbox'}</h2>
        {chooseSource && (
          <label className="hub-source-label">
            Choose your sprite source
            <select
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
            >
              {SPRITE_SOURCES.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {status.state !== 'connected' && dropboxAccount.isConfigured() && (
          <>
            <p>
              Sign in to Dropbox to use your saves, settings, and collections
              across devices, or continue with browser storage.
            </p>
            <button
              disabled={busy || status.state === 'connecting'}
              onClick={() => void connect()}
            >
              Sign in to Dropbox
            </button>
          </>
        )}
        {status.state === 'connected' && (
          <p>
            Dropbox connected. Your saves, settings, and collections are synced.
          </p>
        )}
        {status.message && <p role="status">{status.message}</p>}
        {error && <p role="alert">{error}</p>}
        <div className="hub-dialog-actions">
          <button disabled={busy} onClick={() => dialog.current?.close()}>
            Close
          </button>
          {chooseSource && (
            <button
              disabled={busy || !startup.ready}
              onClick={() => void save()}
            >
              {busy ? 'Saving…' : 'Continue'}
            </button>
          )}
        </div>
      </dialog>
    </main>
  )
}
