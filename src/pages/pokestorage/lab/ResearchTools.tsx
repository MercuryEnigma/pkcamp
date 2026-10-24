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
  return (
    <nav className="research-tools" aria-label="Research tools">
      <SiteCard
        title="Mystery Gifts"
        description="Send Wonder Cards to a GBA or the Switch."
        onClick={onOpenGifts}
      />
      <SiteCard
        title="Cartridge Saves"
        description="Back up and restore GBA cartridge saves."
        onClick={onOpenSaves}
      />
      <SiteCard
        title="ROM / BIOS Dumps"
        description="Download cartridge ROMs and the GBA BIOS."
        onClick={onOpenDumps}
      />
    </nav>
  )
}
