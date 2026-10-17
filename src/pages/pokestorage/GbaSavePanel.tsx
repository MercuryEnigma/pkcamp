import type { Gen3GameId } from '../../services/saveLibrary'
import { storage } from '../../services/storage'
import { gbLinkTradeDevice } from '../../services/tradeDevice'
import { usePkHex } from '../context/PkHexContext'
import { GAME_LABEL } from './gameDisplay'
import { GbLinkTaskPanel } from './GbLinkTaskPanel'
import {
  CONNECT_STEP,
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
  const { gameId } = props
  const { adapter } = usePkHex()
  const cabin = `${GAME_LABEL[gameId]} Cabin`

  return (
    <GbLinkTaskPanel
      title={
        props.mode === 'write'
          ? `Restore ${cabin} to GBA`
          : `Back up ${cabin} from GBA`
      }
      steps={[
        CONNECT_STEP,
        `Insert ${GAME_LABEL[gameId]} and power on while holding START + SELECT.`,
      ]}
      note={
        props.mode === 'write'
          ? `The cartridge's current save will be backed up before ${cabin} is written to it.`
          : undefined
      }
      progressLabel={
        props.mode === 'read' ? 'Reading the save' : 'Sending the backup'
      }
      startLabel="Continue"
      disabled={!adapter}
      onBeforeStart={props.onBeforeStart}
      onClose={props.onClose}
      describeError={(cause, cancelled) =>
        props.mode === 'write'
          ? restoreErrorMessage(
              cause,
              cancelled,
              'If the initial backup completed, it is stored as the hardware backup in this Cabin.'
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
          task.onStatus(`Saving the ${GAME_LABEL[gameId]} backup…`)
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
        return 'The cartridge save was overwritten.'
      }}
    />
  )
}
