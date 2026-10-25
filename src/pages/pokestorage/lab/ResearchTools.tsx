import { useTranslation } from 'react-i18next'
import { SiteCard } from '../../hub/SiteCard'
import './researchTools.css'

/** A menu of the three cartridge and console tools. */
export function ResearchTools({
  onOpenGifts,
  onOpenSaves,
  onOpenDumps,
}: {
  onOpenGifts: () => void
  onOpenSaves: () => void
  onOpenDumps: () => void
}) {
  const { t } = useTranslation(['lab', 'common'] as const)

  return (
    <nav
      className="research-tools"
      aria-label={t('ResearchTools.researchTools')}
    >
      <SiteCard
        title={t('ResearchTools.mysteryGifts')}
        description={t('ResearchTools.sendWonderCardsToAGbaOrTheSwitch')}
        onClick={onOpenGifts}
      />
      <SiteCard
        title={t('ResearchTools.cartridgeSaves')}
        description={t('ResearchTools.backUpAndRestoreGbaCartridgeSaves')}
        onClick={onOpenSaves}
      />
      <SiteCard
        title={t('ResearchTools.romBiosDumps')}
        description={t('ResearchTools.downloadCartridgeRomsAndTheGbaBios')}
        onClick={onOpenDumps}
      />
    </nav>
  )
}
