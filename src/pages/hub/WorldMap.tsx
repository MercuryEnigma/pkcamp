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
  return (
    <SitePage page="pkCamp" gameId={gameId} onBack={onBack}>
      <nav className="site-tiles hub-map" aria-label="pkCamp areas">
        <SiteCard
          className="hub-map-arcade"
          title="Arcade"
          description={onArcade ? 'Play your adventure' : 'Select a game first'}
          onClick={onArcade}
          disabled={!onArcade}
        />
        <SiteCard
          className="hub-map-camp"
          title="Camp"
          description="Move and trade Pokémon"
          onClick={onCamp}
        />
        <SiteCard
          className="hub-map-lab"
          title="Lab"
          description="Collections and research"
          onClick={onLab}
        />
      </nav>
    </SitePage>
  )
}
