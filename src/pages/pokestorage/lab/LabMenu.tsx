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
  return (
    <SitePage page="Lab" gameId={gameId} onBack={onBack}>
      <nav className="site-tiles lab-menu" aria-label="Lab">
        <SiteCard
          className="lab-menu-pc"
          title="PC"
          description="Collections and research progress"
          onClick={onSelectCollections}
        />
        <SiteCard
          className="lab-menu-transporter"
          title="Transporter"
          description="Move Gen 1–2 Pokémon into Gen 3"
          onClick={onSelectTransporter}
        />
        <SiteCard
          className="lab-menu-tools"
          title="Research Tools"
          description="Gifts, cartridge saves and dumps"
          onClick={onSelectResearch}
        />
        <SiteCard
          className="lab-menu-settings"
          title="Settings"
          description="Backups, appearance, data and hardware"
          onClick={onSelectSettings}
        />
        <button type="button" className="lab-link" onClick={onSelectNews}>
          Patch Notes
        </button>
      </nav>
    </SitePage>
  )
}
