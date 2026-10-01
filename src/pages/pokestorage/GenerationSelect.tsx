import { ZoneCard } from './ZoneCard'

/** Only Gen 3 has a working save adapter today (see src/services/pkhex). */
const SUPPORTED_GENERATION = 3 as const

const GEN_CHOICES = ['Gameboy', 'GBA', 'DS', '3DS', 'Switch']
export function GenerationSelect({
  onBack,
  onSelectGeneration,
  activity = 'storage',
}: {
  onBack: () => void
  onSelectGeneration: (generation: 3) => void
  activity?: 'storage' | 'trade'
}) {
  return (
    <div className="camp-root">
      <div className="camp-content">
        <header className="camp-page-header">
          <button type="button" className="camp-back" onClick={onBack}>
            ← Back
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">
              {activity === 'trade' ? 'Trade' : 'Organize'}
            </p>
            <h1 className="camp-title">Choose a generation</h1>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>
        <div className="camp-grid">
          {GEN_CHOICES.map((generation) =>
            generation === 'GBA' ? (
              <ZoneCard
                key={generation}
                label={`${generation} Era`}
                sublabel="RSE • FRLG"
                title="Ruby, Sapphire, Emerald, FireRed, LeafGreen"
                onClick={() => onSelectGeneration(SUPPORTED_GENERATION)}
              />
            ) : (
              <ZoneCard
                key={generation}
                label={`${generation} Era`}
                comingSoon
              />
            )
          )}
        </div>
      </div>
    </div>
  )
}
