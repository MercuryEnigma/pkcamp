import { ZoneCard } from './ZoneCard'

export function CampActivities({
  onBack,
  onSelectLodges,
  onSelectTrade,
}: {
  onBack?: () => void
  onSelectLodges: () => void
  onSelectTrade: () => void
  onSelectSettings: () => void
}) {
  const heading = (
    <>
      <p className="camp-eyebrow">Camp Zone</p>
      <h1 className="camp-title">Where would you like to go?</h1>
      <p className="camp-subtitle">
        Visit a lodge, trade Pokémon, or stop by the Camp Office.
      </p>
    </>
  )
  return (
    <div className="camp-root">
      <div className="camp-content">
        {onBack ? (
          <header className="camp-page-header">
            <button type="button" className="camp-back" onClick={onBack}>
              ← Back
            </button>
            <div className="camp-page-heading">{heading}</div>
            <span className="camp-page-header-spacer" aria-hidden="true" />
          </header>
        ) : (
          heading
        )}
        <ZoneCard
          primary
          label="Camp Lodges"
          sublabel="Go camping and organize your Pokémon"
          onClick={onSelectLodges}
        />
        <div className="camp-grid camp-grid--wide">
          <ZoneCard
            label="Trading Post"
            sublabel="Trade with connected games"
            onClick={onSelectTrade}
          />
          <ZoneCard label="Transfer Station" comingSoon />
        </div>
        {/* <button
          type="button"
          className="camp-settings-btn"
          onClick={onSelectSettings}
        >
          Camp Office · Settings: backups &amp; appearance
        </button> */}
      </div>
    </div>
  )
}
