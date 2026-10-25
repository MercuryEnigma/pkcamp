import { useTranslation } from 'react-i18next'
import type { Gen3GameId } from '../../../services/saveLibrary'
import { SiteCard } from '../../hub/SiteCard'
import { SitePage } from '../../hub/SitePage'
import './labMenu.css'

/** The Lab landing page: four cards and a Patch Notes link, laid out by the
 * proportions in the design (see `labMenu.css`). */
export function LabMenu({
  gameId,
  onBack,
  onSelectCollections,
  onSelectTransporter,
  onSelectResearch,
  onSelectSettings,
  onSelectNews,
}: {
  gameId: Gen3GameId | null
  onBack: () => void
  onSelectCollections: () => void
  onSelectTransporter: () => void
  onSelectResearch: () => void
  onSelectSettings: () => void
  onSelectNews: () => void
}) {
  const { t } = useTranslation(['lab', 'common'] as const)

  return (
    <SitePage page={t('LabMenu.lab')} gameId={gameId} onBack={onBack}>
      <nav className="site-tiles lab-menu" aria-label={t('LabMenu.lab')}>
        <SiteCard
          className="lab-menu-pc"
          title={t('LabMenu.pc')}
          description={t('LabMenu.pokeDexCollectionsAndResearchProgress')}
          onClick={onSelectCollections}
        />
        <SiteCard
          className="lab-menu-transporter"
          title={t('LabMenu.transporter')}
          description={t('LabMenu.moveGen12PokeMonIntoGen3')}
          onClick={onSelectTransporter}
        />
        <SiteCard
          className="lab-menu-tools"
          title={t('LabMenu.researchTools')}
          description={t('LabMenu.giftsCartridgeSavesAndDumps')}
          onClick={onSelectResearch}
        />
        <SiteCard
          className="lab-menu-settings"
          title={t('common:actions.settings')}
          description={t('LabMenu.backupsAppearanceDataAndHardware')}
          onClick={onSelectSettings}
        />
        <button type="button" className="lab-link" onClick={onSelectNews}>
          {t('LabMenu.patchNotes')}
        </button>
      </nav>
    </SitePage>
  )
}
