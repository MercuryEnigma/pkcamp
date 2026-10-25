import { useTranslation } from 'react-i18next'
import { i18n } from '../../../services/i18n'
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
  BackupStatusCard,
} from '../SettingsSections'
import { useSettingsForm, type SettingsTab } from '../useSettingsForm'
import { ArcadeSettings } from './ArcadeSettings'
import { LabCollectionData } from './LabCollectionData'
import './labSettings.css'

export type { SettingsTab }

const getTabs = (): ReadonlyArray<{
  id: SettingsTab | 'arcade'
  label: string
}> => [
  { id: 'backups', label: i18n.t('settings:LabSettings.backupRestore') },
  { id: 'appearance', label: i18n.t('settings:LabSettings.appearance') },
  { id: 'storage', label: i18n.t('settings:LabSettings.data') },
  { id: 'hardware', label: i18n.t('settings:LabSettings.hardware') },
  { id: 'arcade', label: i18n.t('settings:LabSettings.arcade') },
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
  const { t } = useTranslation(['settings', 'common'] as const)

  const confirmLeave = useConfirmNavigation()
  const { gameId } = useActiveGame()
  const form = useSettingsForm({
    initialTab: tab,
    initialCabin: gameId ?? undefined,
    savedMessage: t('LabSettings.settingsSaved'),
  })
  const { selectedCabin, camps, siteCounts, saving, offline, message } = form
  // The Arcade tab is not yet addressable by URL, so it is local state.
  const [arcade, setArcade] = useState(false)
  const active: SettingsTab | 'arcade' = arcade ? 'arcade' : form.tab
  const showsSave =
    active === 'appearance' ||
    (active === 'backups' && selectedCabin === 'campsites')

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
        label={t('common:actions.settings')}
        layout="rail"
        options={getTabs().map((item) => [item.id, item.label] as const)}
        value={active}
        onChange={choose}
        mobileSelect
      />
      <Panel className="lab-settings-workstation" resetScrollOn={active} label={getTabs().find((item) => item.id === active)?.label ?? ''}>
        <header className="lab-settings-heading">
          <h2>{getTabs().find((item) => item.id === active)?.label}</h2>
          {active === 'backups' && <p>{t('LabSettings.manageTheSaveBackupForEachGame')}</p>}
          {active === 'appearance' && <p>{t('LabSettings.chooseHowPokeMonAppearThroughoutPkcamp')}</p>}
          {active === 'storage' && <p>{t('LabSettings.whereYourBackupsCampingPokeMonCollectionsAndSettingsAre')}</p>}
          {active === 'arcade' && <p>{t('ArcadeSettings.selectAnActionThenPressItsNewKeyEscCancels')}</p>}
        </header>

        {active === 'backups' && (
          <div
            className={`lab-settings-backup${
              selectedCabin === 'campsites' ? ' lab-settings-backup--campsites' : ''
            }`}
          >
            <div className="lab-settings-module lab-settings-cabin"><CabinPicker form={form} /></div>
            {selectedCabin === 'campsites' ? (
              <CampsitesCard form={form} />
            ) : (
              <>
                <BackupStatusCard form={form} gameId={selectedCabin} />
                <CabinBackupCard form={form} gameId={selectedCabin} />
              </>
            )}
          </div>
        )}

        {active === 'appearance' && (
          <div className="lab-settings-appearance">
            <SpriteSourcePicker form={form} />
          </div>
        )}

        {active === 'storage' && (
          <div className="lab-settings-data">
            <DataStorageControls form={form} />
            <LabCollectionData offline={offline} />
          </div>
        )}

        {active === 'hardware' && <div className="lab-settings-hardware"><GbLinkFirmwareSettings /></div>}
        {active === 'arcade' && <ArcadeSettings />}

        {offline && active !== 'hardware' && active !== 'arcade' && (
          <p className="camp-status">
            {t('LabSettings.dropboxIsUnreachableYourDataIsReadOnlyUntilIt')}
          </p>
        )}
        {message && <p className="camp-status">{message}</p>}
        {showsSave && (
          <button
            type="button"
            className="camp-confirm-btn"
            disabled={!camps || !siteCounts || saving || offline}
            onClick={() => void form.handleSave()}
          >
            {saving
              ? t('common:actions.saving')
              : t('LabSettings.saveSettings')}
          </button>
        )}
      </Panel>
    </div>
  )
}
