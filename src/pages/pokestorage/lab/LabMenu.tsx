/** A tool a Lab station will offer later, with what it will do. */
interface PlannedTool {
  name: string
  description: string
}

/**
 * A Lab station: a research-desk card with a title, a short description,
 * and either one clear action or, for planned work, the tools in
 * development. Planned stations render as plain content rather than a
 * disabled button, so there's nothing to tab to until they exist.
 */
function LabStation({
  title,
  description,
  action,
  onClick,
  planned,
  primary = false,
}: {
  title: string
  description: string
  action?: string
  onClick?: () => void
  /** Tools listed with a "Coming later" status instead of an action. */
  planned?: readonly PlannedTool[]
  primary?: boolean
}) {
  const className = `lab-station${primary ? ' lab-station--primary' : ''}${
    planned ? ' lab-station--planned' : ''
  }`

  if (planned) {
    return (
      <section className={className} aria-label={`${title}, in development`}>
        <span className="lab-station-head">
          <span className="lab-station-title">{title}</span>
          <span className="lab-tag">In development</span>
        </span>
        <span className="lab-station-desc">{description}</span>
        <ul className="lab-planned">
          {planned.map((tool) => (
            <li key={tool.name}>
              <span className="lab-planned-text">
                <span className="lab-planned-name">{tool.name}</span>
                <span className="lab-planned-desc">{tool.description}</span>
              </span>
              <span className="lab-tag">Coming later</span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      <span className="lab-station-title">{title}</span>
      <span className="lab-station-desc">{description}</span>
      <span className="lab-station-action">{action} →</span>
    </button>
  )
}

/**
 * The Lab Zone's landing page: three stations, then a utility footer with
 * Settings and Patch Notes.
 */
export function LabMenu({
  onBack,
  onSelectCollections,
  onSelectTrade,
  onSelectSettings,
  onSelectNews,
}: {
  onBack: () => void
  onSelectCollections: () => void
  onSelectTrade: () => void
  onSelectSettings: () => void
  onSelectNews: () => void
}) {
  return (
    <div className="camp-root lab-menu-root">
      <div className="camp-content lab-menu-content">
        <header className="camp-page-header">
          <button type="button" className="camp-back" onClick={onBack}>
            ← Back
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">Lab Zone</p>
            <h1 className="camp-title">Celio's Lab</h1>
            <p className="camp-page-subtitle">
              Catalog, study, and work with Pokémon data.
            </p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>

        <nav className="lab-stations" aria-label="Lab stations">
          <LabStation
            primary
            title="Pokédex Collections"
            description="Catalog the Pokémon your Cabins hold and track each collection's progress."
            action="Browse collections"
            onClick={onSelectCollections}
          />
          <LabStation
            title="Trade Table"
            description="Trade between Cabin saves, Camp Sites, and connected games."
            action="Open trade table"
            onClick={onSelectTrade}
          />
          <LabStation
            title="Research Tools"
            description="Mystery Gifts and research utilities are coming later."
            planned={[
              {
                name: 'Mystery Gifts',
                description: 'Receive event Pokémon and items.',
              },
            ]}
          />
        </nav>

        <footer className="lab-utility">
          <button
            type="button"
            className="lab-settings-btn"
            onClick={onSelectSettings}
          >
            Settings
            <span className="lab-settings-sub">
              Backups, appearance &amp; data
            </span>
          </button>
          <button type="button" className="lab-link" onClick={onSelectNews}>
            Patch Notes
          </button>
        </footer>
      </div>
    </div>
  )
}
