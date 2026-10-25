import { useTranslation } from 'react-i18next'
import type { Gen3GameId } from '../../services/saveLibrary'
import { getGameLabel } from '../pokestorage/gameDisplay'
import { DropboxMenu } from './DropboxMenu'
import './pageHeader.css'

/**
 * ← Back · {game} on the light side, then a diagonal edge into the page name
 * and badges. Phones keep the arrow, page and badges.
 */
export function PageHeader({
  page,
  gameId,
  onBack,
  onOpenSettings,
}: {
  page: string
  gameId: Gen3GameId | null
  onBack: () => void
  /** Opens Lab Settings → storage, after the Dropbox badge confirmed leaving. */
  onOpenSettings: () => void
}) {
  const { t } = useTranslation(['hub', 'common'] as const)

  return (
    <header className="site-page-header">
      <button
        type="button"
        className="site-page-back"
        onClick={onBack}
        aria-label={t('common:actions.back')}
      >
        <span aria-hidden="true">←</span>
        <span className="site-page-back-label" aria-hidden="true">
          {t('common:actions.back')}
        </span>
      </button>
      <span className="site-page-game">
        {gameId ? getGameLabel(gameId) : ''}
      </span>
      <div className="site-page-right">
        <h1 className="site-page-title">{page}</h1>
        <div className="site-page-actions">
          <DropboxMenu onOpenSettings={onOpenSettings} />
        </div>
      </div>
    </header>
  )
}
