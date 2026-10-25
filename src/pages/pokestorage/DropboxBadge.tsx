import { useTranslation } from 'react-i18next'
import { i18n } from '../../services/i18n'
import { useConfirmNavigation } from './navigationGuard'
import { dropboxAccount } from '../../services/storage/dropbox'
import { useDropboxStatus, useStorageProvider } from './useStorage'

type BadgeState = 'connected' | 'connecting' | 'offline' | 'signed-out'

const getBadgeLabel = (): Record<BadgeState, string> => ({
  connected: i18n.t('camp:DropboxBadge.dropboxConnected'),
  connecting: i18n.t('camp:DropboxBadge.connectingToDropbox'),
  offline: i18n.t('camp:DropboxBadge.dropboxUnreachableSavingIsPaused'),
  'signed-out': i18n.t(
    'camp:DropboxBadge.notConnectedToDropboxSavingInThisBrowser'
  ),
})

/**
 * Corner indicator for the Camp Zone showing whether the player's data is
 * going to Dropbox. Opens the Camp Office's Storage tab. Hidden when this
 * build has no Dropbox app key.
 */
export function DropboxBadge({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation(['camp', 'common'] as const)

  const confirmLeave = useConfirmNavigation()
  const status = useDropboxStatus()
  const { provider } = useStorageProvider()
  if (!dropboxAccount.isConfigured()) return null

  const state: BadgeState =
    status.state === 'connecting'
      ? 'connecting'
      : provider.id !== 'dropbox'
        ? 'signed-out'
        : status.state === 'error'
          ? 'offline'
          : 'connected'
  const label = getBadgeLabel()[state]
  const title = status.message
    ? t('DropboxBadge.connectionDetails', {
        label: label,
        message: status.message,
      })
    : label

  return (
    <button
      type="button"
      className={`camp-dropbox-badge camp-dropbox-badge--${state}`}
      onClick={() => {
        if (confirmLeave()) onOpen()
      }}
      title={title}
      aria-label={t('DropboxBadge.openStorageSettings', { label: label })}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 1.807 0 5.629l6 3.822 6.001-3.822zm12 0-6 3.822 6 3.822 6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452zm18-3.822-6 3.822 6 3.822 6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822z" />
      </svg>
      <span className="camp-dropbox-badge-dot" aria-hidden="true" />
    </button>
  )
}
