import { useTranslation } from 'react-i18next'
import type { Gen3GameId } from '../../services/saveLibrary'
import { SiteCard } from './SiteCard'
import { SitePage } from './SitePage'

export function WorldMap({
  gameId,
  onCamp,
  onLab,
  onArcade,
  onBack,
}: {
  gameId: Gen3GameId | null
  onCamp: () => void
  onLab: () => void
  onArcade?: () => void
  onBack: () => void
}) {
  const { t } = useTranslation(['hub', 'common'] as const)

  return (
    <SitePage page={t('WorldMap.pkcamp')} gameId={gameId} onBack={onBack}>
      <nav
        className="site-tiles hub-map"
        aria-label={t('WorldMap.pkcampAreas')}
      >
        <SiteCard
          className="hub-map-arcade"
          title={t('WorldMap.arcade')}
          description={
            onArcade
              ? t('WorldMap.playYourAdventure')
              : t('WorldMap.selectAGameFirst')
          }
          onClick={onArcade}
          disabled={!onArcade}
        />
        <SiteCard
          className="hub-map-camp"
          title={t('WorldMap.camp')}
          description={t('WorldMap.moveAndTradePokeMon')}
          onClick={onCamp}
        />
        <SiteCard
          className="hub-map-lab"
          title={t('WorldMap.lab')}
          description={t('WorldMap.collectionsAndResearch')}
          onClick={onLab}
        />
        <button type="button" className="hub-map-change" onClick={onBack}>
          <span aria-hidden="true">←</span>
          {t('WorldMap.changeGame')}
        </button>
      </nav>
    </SitePage>
  )
}
