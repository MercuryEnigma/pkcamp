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
  CampsitesStatusCard,
  DataStorageControls,
  SpriteSourcePicker,
  ThemePicker,
  BackupStatusCard,
} from '../SettingsSections'
import { useSettingsForm, type SettingsTab } from '../useSettingsForm'
import { ArcadeControlsSettings, ArcadeSkinSettings } from './ArcadeSettings'
import { LabCollectionData } from './LabCollectionData'
import './labSettings.css'

export type { SettingsTab }

const getTabs = (): ReadonlyArray<{
  id: SettingsTab
  label: string
}> => [
  { id: 'backups', label: i18n.t('settings:LabSettings.backupRestore') },
  { id: 'appearance', label: i18n.t('settings:LabSettings.appearance') },
  { id: 'storage', label: i18n.t('settings:LabSettings.data') },
  { id: 'hardware', label: i18n.t('settings:LabSettings.hardware') },
  {
    id: 'arcade-controls',
    label: i18n.t('settings:LabSettings.arcadeControls'),
  },
  { id: 'arcade-skin', label: i18n.t('settings:LabSettings.arcadeSkin') },
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
  const { t } = useTranslation(['settings', 'arcade', 'common'] as const)

  const confirmLeave = useConfirmNavigation()
  const { gameId } = useActiveGame()
  const form = useSettingsForm({
    initialTab: tab,
    initialCabin: gameId ?? undefined,
    savedMessage: t('LabSettings.settingsSaved'),
  })
  const { selectedCabin, offline, message } = form
  const active = form.tab

  // A link such as the Dropbox badge can change the tab while this is open.
  const [shownTab, setShownTab] = useState(tab)
  if (shownTab !== tab) {
    setShownTab(tab)
    form.setTab(tab)
  }

  const choose = (next: SettingsTab) => {
    if (next === active) return
    if ((active === 'hardware' || active === 'backups') && !confirmLeave())
      return
    onTabChange(next)
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
      <Panel
        className="lab-settings-workstation"
        resetScrollOn={active}
        label={getTabs().find((item) => item.id === active)?.label ?? ''}
      >
        <header className="lab-settings-heading">
          <h2>{getTabs().find((item) => item.id === active)?.label}</h2>
          {active === 'backups' && (
            <p>{t('LabSettings.manageTheSaveBackupForEachGame')}</p>
          )}
          {active === 'appearance' && (
            <p>{t('LabSettings.chooseColorsAndHowPokeMonAppear')}</p>
          )}
          {active === 'storage' && (
            <p>
              {t(
                'LabSettings.whereYourBackupsCampingPokeMonCollectionsAndSettingsAre'
              )}
            </p>
          )}
          {active === 'arcade-controls' && (
            <p>{t('arcade:actions.rebindHint')}</p>
          )}
        </header>

        {active === 'backups' && (
          <div className="lab-settings-backup">
            <div className="lab-settings-module lab-settings-cabin">
              <CabinPicker form={form} />
            </div>
            {selectedCabin === 'campsites' ? (
              <>
                <CampsitesStatusCard form={form} />
                <CampsitesCard form={form} />
              </>
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
            <ThemePicker form={form} />
            <SpriteSourcePicker form={form} />
          </div>
        )}

        {active === 'storage' && (
          <div className="lab-settings-data">
            <DataStorageControls form={form} />
            <LabCollectionData offline={offline} />
          </div>
        )}

        {active === 'hardware' && (
          <div className="lab-settings-hardware">
            <GbLinkFirmwareSettings />
          </div>
        )}
        {active === 'arcade-controls' && <ArcadeControlsSettings />}
        {active === 'arcade-skin' && <ArcadeSkinSettings />}

        {offline &&
          active !== 'hardware' &&
          active !== 'arcade-controls' &&
          active !== 'arcade-skin' && (
            <p className="camp-status">
              {t('LabSettings.dropboxIsUnreachableYourDataIsReadOnlyUntilIt')}
            </p>
          )}
        {message && active !== 'backups' && (
          <p className="camp-status">{message}</p>
        )}
      </Panel>
    </div>
  )
}
