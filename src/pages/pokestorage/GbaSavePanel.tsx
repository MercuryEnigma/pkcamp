import { useTranslation } from 'react-i18next'
import type { Gen3GameId } from '../../services/saveLibrary'
import { storage } from '../../services/storage'
import { gbLinkTradeDevice } from '../../services/tradeDevice'
import { usePkHex } from '../context/PkHexContext'
import { getGameLabel } from './gameDisplay'
import { GbLinkTaskPanel } from './GbLinkTaskPanel'
import {
  getConnectStep,
  restoreErrorMessage,
  taskErrorMessage,
} from './gbLinkTask'
import { assertSaveMatchesCabin } from './saveVersion'

const describeReadError = taskErrorMessage()

type GbaSavePanelProps = {
  gameId: Gen3GameId
  onClose(): void
  onBeforeStart?: () => boolean
} & (
  | {
      /** Read the cartridge save into PkCamp's storage as the backup. */
      mode: 'read'
      /** Called with the save once PKHeX opened it and storage kept it. */
      onSave(bytes: Uint8Array): void
    }
  | {
      /** Overwrite the cartridge save with `save`. */
      mode: 'write'
      save: Uint8Array
      onWritten(): void
    }
)

/** Reads or writes a Cabin's cartridge save on a GBA connected via GB-Link. */
export function GbaSavePanel(props: GbaSavePanelProps) {
  const { t } = useTranslation(['cartridge-saves', 'common'] as const)

  const { gameId } = props
  const { adapter } = usePkHex()
  const cabin = t('GbaSavePanel.cabin', { value1: getGameLabel(gameId) })

  return (
    <GbLinkTaskPanel
      title={
        props.mode === 'write'
          ? t('GbaSavePanel.restoreToGba', { cabin: cabin })
          : t('GbaSavePanel.backUpFromGba', { cabin: cabin })
      }
      steps={[
        getConnectStep(),
        t(
          'cartridge-saves:GbaSavePanel.insertAndPowerOnWhileHoldingStartSelect',
          { value1: getGameLabel(gameId) }
        ),
      ]}
      note={
        props.mode === 'write'
          ? t(
              'cartridge-saves:GbaSavePanel.theCartridgeSCurrentSaveWillBeBackedUpBefore',
              { cabin: cabin }
            )
          : undefined
      }
      progressLabel={
        props.mode === 'read'
          ? t('GbaSavePanel.readingTheSave')
          : t('GbaSavePanel.sendingTheBackup')
      }
      startLabel={t('common:actions.continue')}
      disabled={!adapter}
      onBeforeStart={props.onBeforeStart}
      onClose={props.onClose}
      describeError={(cause, cancelled) =>
        props.mode === 'write'
          ? restoreErrorMessage(
              cause,
              cancelled,
              t('GbaSavePanel.ifTheInitialBackupCompletedItIsStoredAsThe')
            )
          : describeReadError(cause, cancelled)
      }
      run={async (task) => {
        if (!adapter) return
        const assertMatches = (bytes: Uint8Array) => {
          const loaded = adapter.load(bytes)
          try {
            assertSaveMatchesCabin(gameId, loaded)
          } finally {
            loaded.dispose()
          }
        }
        if (props.mode === 'read') {
          const bytes = await gbLinkTradeDevice.readSave({ ...task, gameId })
          assertMatches(bytes)
          task.onStatus(
            t('GbaSavePanel.savingTheBackup', { value1: getGameLabel(gameId) })
          )
          await storage.putSave(gameId, bytes)
          props.onSave(bytes)
          return
        }
        assertMatches(props.save)
        await gbLinkTradeDevice.writeSave({
          ...task,
          gameId,
          save: props.save,
          // Stored as hardware.sav before the cartridge is touched.
          backUpCartridgeSave: (cartridgeSave) =>
            storage.putHardwareSave(gameId, cartridgeSave),
        })
        props.onWritten()
        return t('GbaSavePanel.theCartridgeSaveWasOverwritten')
      }}
    />
  )
}
