import { useRef, useState } from 'react'
import { dropboxAccount } from '../../services/storage/dropbox'
import { DropboxBadge } from '../pokestorage/DropboxBadge'
import { useDropboxStatus } from '../pokestorage/useStorage'

/** Shared corner indicator and account controls for the hub menus. */
export function DropboxMenu() {
  const dialog = useRef<HTMLDialogElement>(null)
  const status = useDropboxStatus()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <>
      <DropboxBadge onOpen={() => dialog.current?.showModal()} />
      <dialog
        ref={dialog}
        className="hub-dialog"
        onClose={() => setError(null)}
      >
        <h2>Dropbox</h2>
        {status.state === 'connected' ? (
          <p>
            Dropbox connected. Your saves, settings, and collections are synced.
          </p>
        ) : (
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
        {status.message && <p role="status">{status.message}</p>}
        {error && <p role="alert">{error}</p>}
        <div className="hub-dialog-actions">
          <button disabled={busy} onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
    </>
  )
}
