import { useTranslation } from 'react-i18next'
import { useRef, useState } from 'react'
import { dropboxAccount } from '../../services/storage/dropbox'
import { DropboxBadge } from '../pokestorage/DropboxBadge'
import { SourceLink } from './SourceLink'
import { LanguageMenu } from './LanguageMenu'
import { useDropboxStatus } from '../pokestorage/useStorage'

/**
 * Shared corner indicator and account controls for the hub menus. Pages inside
 * the app pass `onOpenSettings` to open Lab Settings → storage; isolated pages
 * (and Start before setup) fall back to the account dialog.
 */
export function DropboxMenu({
  onOpenSettings,
}: {
  onOpenSettings?: () => void
} = {}) {
  const { t } = useTranslation(['hub', 'common'] as const)

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
      <SourceLink />
      <LanguageMenu />
      <DropboxBadge
        onOpen={onOpenSettings ?? (() => dialog.current?.showModal())}
      />
      <dialog
        ref={dialog}
        className="hub-dialog"
        onClose={() => setError(null)}
      >
        <h2>{t('DropboxMenu.dropbox')}</h2>
        {status.state === 'connected' ? (
          <p>
            {t(
              'DropboxMenu.dropboxConnectedYourSavesSettingsAndCollectionsAreSynced'
            )}
          </p>
        ) : (
          <>
            <p>{t('DropboxMenu.signInToDropboxToUseYourSavesSettingsAnd')}</p>
            <button
              disabled={busy || status.state === 'connecting'}
              onClick={() => void connect()}
            >
              {t('common:actions.signInToDropbox')}
            </button>
          </>
        )}
        {status.message && <p role="status">{status.message}</p>}
        {error && <p role="alert">{error}</p>}
        <div className="hub-dialog-actions">
          <button disabled={busy} onClick={() => dialog.current?.close()}>
            {t('common:actions.close')}
          </button>
        </div>
      </dialog>
    </>
  )
}
