import { useState } from 'react'
import { OptionGroup } from '../../hub/OptionGroup'
import { Panel } from '../../hub/Panel'
import { useActiveGame } from '../../context/useActiveGame'
import { GbLinkFirmwareSettings } from '../GbLinkFirmwareSettings'
import { useConfirmNavigation } from '../navigationGuard'
import {
  CabinBackupCard,
  CabinPicker,
  CampsitesCard,
  DataStorageControls,
  SpriteSourcePicker,
} from '../SettingsSections'
import { useSettingsForm, type SettingsTab } from '../useSettingsForm'
import { ArcadeSettings } from './ArcadeSettings'
import { LabCollectionData } from './LabCollectionData'
import './labSettings.css'

export type { SettingsTab }

const TABS: ReadonlyArray<{ id: SettingsTab | 'arcade'; label: string }> = [
  { id: 'backups', label: 'Backup & Restore' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'storage', label: 'Data' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'arcade', label: 'Arcade' },
]

/** Every site setting, in tabs. Settings logic lives in `useSettingsForm`. */
export function LabSettings({
  tab,
  onTabChange,
}: {
  /** The tab named by the URL. */
  tab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}) {
  const confirmLeave = useConfirmNavigation()
  const { gameId } = useActiveGame()
  const form = useSettingsForm({
    initialTab: tab,
    initialCabin: gameId ?? undefined,
    savedMessage: 'Settings saved.',
  })
  const { selectedCabin, camps, siteCounts, saving, offline, message } = form
  // The Arcade tab is not yet addressable by URL, so it is local state.
  const [arcade, setArcade] = useState(false)
  const active: SettingsTab | 'arcade' = arcade ? 'arcade' : form.tab

  // A link such as the Dropbox badge can change the tab while this is open.
  const [shownTab, setShownTab] = useState(tab)
  if (shownTab !== tab) {
    setShownTab(tab)
    form.setTab(tab)
    setArcade(false)
  }

  const choose = (next: SettingsTab | 'arcade') => {
    if (next === active) return
    if ((active === 'hardware' || active === 'backups') && !confirmLeave())
      return
    setArcade(next === 'arcade')
    if (next !== 'arcade') onTabChange(next)
  }

  return (
    <div className="settings-page">
      <OptionGroup
        label="Settings"
        layout="rail"
        options={TABS.map((item) => [item.id, item.label] as const)}
        value={active}
        onChange={choose}
      />
      <Panel label={TABS.find((item) => item.id === active)?.label ?? ''}>
        <h2>{TABS.find((item) => item.id === active)?.label}</h2>

        {active === 'backups' && (
          <>
            <p>Manage the save backup for each game.</p>
            <CabinPicker form={form} />
            {selectedCabin === 'campsites' ? (
              <CampsitesCard form={form} />
            ) : (
              <CabinBackupCard form={form} gameId={selectedCabin} />
            )}
          </>
        )}

        {active === 'appearance' && (
          <>
            <p>Choose how Pokémon appear throughout pkCamp.</p>
            <SpriteSourcePicker form={form} />
          </>
        )}

        {active === 'storage' && (
          <>
            <p>
              Where your backups, Camping Pokémon, collections, and settings are
              kept.
            </p>
            <DataStorageControls form={form} />
            <LabCollectionData offline={offline} />
          </>
        )}

        {active === 'hardware' && <GbLinkFirmwareSettings />}
        {active === 'arcade' && <ArcadeSettings />}

        {offline && active !== 'hardware' && active !== 'arcade' && (
          <p className="camp-status">
            Dropbox is unreachable. Your data is read-only until it reconnects.
          </p>
        )}
        {message && <p className="camp-status">{message}</p>}
        {active !== 'hardware' && active !== 'arcade' && (
          <button
            type="button"
            className="camp-confirm-btn"
            disabled={!camps || !siteCounts || saving || offline}
            onClick={() => void form.handleSave()}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        )}
      </Panel>
    </div>
  )
}
