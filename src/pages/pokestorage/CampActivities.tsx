import { ZoneCard } from './ZoneCard'

export function CampActivities({
  onSelectOrganize,
  onSelectTrade,
  onSelectSettings,
}: {
  onSelectOrganize: () => void
  onSelectTrade: () => void
  onSelectSettings: () => void
}) {
  return (
    <div className="camp-root">
      <div className="camp-content">
        <p className="camp-eyebrow">Camp Zone</p>
        <h1 className="camp-title">Camp ground activities</h1>
        <ZoneCard
          primary
          label="Organize"
          sublabel="View parties & boxes"
          onClick={onSelectOrganize}
        />
        <div className="camp-grid">
          <ZoneCard label="Trade" onClick={onSelectTrade} />
          <ZoneCard label="Transfer" comingSoon />
        </div>
        <button
          type="button"
          className="camp-settings-btn"
          onClick={onSelectSettings}
        >
          Poké Storage Settings
        </button>
      </div>
    </div>
  )
}
