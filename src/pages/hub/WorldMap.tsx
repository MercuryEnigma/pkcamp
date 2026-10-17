import { DropboxMenu } from './DropboxMenu'
import { ZoneCard } from '../pokestorage/ZoneCard'

export function WorldMap({
  onCamp,
  onLab,
  onBack,
}: {
  onCamp: () => void
  onLab: () => void
  onBack: () => void
}) {
  return (
    <main className="camp-root hub-root">
      <DropboxMenu />
      <div className="camp-content">
        <h1 className="camp-title">pkCamp</h1>
        <p className="camp-subtitle">Choose a zone to explore.</p>
        <div className="camp-grid camp-grid--wide">
          <ZoneCard
            label="Camp Zone"
            sublabel="Manage and trade your Pokémon"
            onClick={onCamp}
          />
          <ZoneCard
            label="Lab Zone"
            sublabel="Pokédex collections & research"
            onClick={onLab}
          />
          {['Battle Zone', 'Safari Zone', 'Pelago Zone', 'Arcade Zone'].map(
            (label) => (
              <ZoneCard key={label} label={label} comingSoon />
            )
          )}
        </div>
        <button type="button" className="hub-back" onClick={onBack}>
          ← Start menu
        </button>
      </div>
    </main>
  )
}
