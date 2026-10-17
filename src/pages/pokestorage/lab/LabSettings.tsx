import '../camp.css'
import './labZone.css'
import {
  CabinBackupCard,
  CabinPicker,
  CampsitesCard,
  DataStorageControls,
  SpriteSourcePicker,
} from '../SettingsSections'
import { useSettingsForm, type SettingsTab } from '../useSettingsForm'

export type { SettingsTab }

const SETTINGS_TABS: ReadonlyArray<{ id: SettingsTab; label: string }> = [
  { id: 'backups', label: 'Backup & Restore' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'storage', label: 'Data' },
]

/** The Lab Zone settings page. Settings logic lives in `useSettingsForm`. */
export function LabSettings({
  onBack,
  initialTab = 'backups',
}: {
  onBack: () => void
  /** Tab to open first. */
  initialTab?: SettingsTab
}) {
  const form = useSettingsForm({
    initialTab,
    savedMessage: 'Settings saved.',
  })
  const {
    tab,
    setTab,
    selectedCabin,
    camps,
    siteCounts,
    saving,
    offline,
    message,
    handleSave,
  } = form

  return (
    <div className="camp-root">
      <div className="camp-content">
        <header className="camp-page-header">
          <button type="button" className="camp-back" onClick={onBack}>
            ← Back
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">Lab Zone · Settings</p>
            <h1 className="camp-title">Settings</h1>
            <p className="camp-page-subtitle">
              Manage save backups, Camp Sites, and appearance.
            </p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>

        <div className="camp-panel camp-settings-panel">
          <div
            className="camp-settings-tabs"
            role="tablist"
            aria-label="settings section"
          >
            {SETTINGS_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`camp-settings-tab${tab === item.id ? ' camp-settings-tab--active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'backups' && (
            <section className="camp-settings-section">
              <h2>Backup &amp; Restore</h2>
              <p>Manage the saves assigned to your GBA Lodge cabins.</p>
              <p className="camp-lodge-label">GBA Lodge</p>
              <CabinPicker form={form} />

              {selectedCabin === 'campsites' ? (
                <CampsitesCard form={form} />
              ) : (
                <CabinBackupCard form={form} gameId={selectedCabin} />
              )}
            </section>
          )}

          {tab === 'appearance' && (
            <section className="camp-settings-section">
              <h2>Appearance</h2>
              <p>Choose how Pokémon appear throughout PkCamp.</p>
              <SpriteSourcePicker form={form} />
            </section>
          )}

          {tab === 'storage' && (
            <section className="camp-settings-section">
              <h2>Data</h2>
              <p>Where your backups, Camping Pokémon, and settings are kept.</p>
              <DataStorageControls form={form} />
            </section>
          )}

          {offline && (
            <p className="camp-status">
              Dropbox is unreachable. Your data is read-only until it
              reconnects.
            </p>
          )}
          {message && <p className="camp-status">{message}</p>}
          <button
            type="button"
            className="camp-confirm-btn"
            disabled={!camps || !siteCounts || saving || offline}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
