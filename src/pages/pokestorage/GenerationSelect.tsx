import { ZoneCard } from './ZoneCard'

/** Only Gen 3 has a working save adapter today (see src/services/pkhex). */
const SUPPORTED_GENERATION = 3 as const

/* Era metadata shows even on lodges that aren't open yet, so the player
 * doesn't have to already know which generations "DS Lodge"/"3DS Lodge"/etc.
 * mean before a single one of them is available. */
const LODGE_CHOICES = [
  { id: 'Game Boy', label: 'Game Boy Lodge', sublabel: 'Generations 1–2' },
  { id: 'GBA', label: 'GBA Lodge', sublabel: 'Generation 3\nRSE · FRLG' },
  { id: 'DS', label: 'DS Lodge', sublabel: 'Generations 4–5' },
  { id: '3DS', label: '3DS Lodge', sublabel: 'Generations 6–7' },
  { id: 'Switch', label: 'Switch Lodge', sublabel: 'Generations 8–9' },
] as const
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
              {activity === 'trade'
                ? 'Camp Zone · Trading Post'
                : 'Camp Zone · Lodges'}
            </p>
            <h1 className="camp-title">
              {activity === 'trade'
                ? 'Which lodge are you trading from?'
                : 'Choose a lodge'}
            </h1>
            <p className="camp-page-subtitle">
              Which Pokémon era is going camping?
            </p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>
        <div className="camp-grid">
          {LODGE_CHOICES.map((lodge) =>
            lodge.id === 'GBA' ? (
              <ZoneCard
                key={lodge.id}
                label={lodge.label}
                sublabel={lodge.sublabel}
                title="Ruby, Sapphire, Emerald, FireRed, LeafGreen"
                onClick={() => onSelectGeneration(SUPPORTED_GENERATION)}
              />
            ) : (
              <ZoneCard
                key={lodge.id}
                label={lodge.label}
                sublabel={lodge.sublabel}
                comingSoon
              />
            )
          )}
        </div>
      </div>
    </div>
  )
}
