import { useState } from 'react'
import type { Gen3GameId } from '../../../services/saveLibrary'
import { storage } from '../../../services/storage'
import { gbLinkTradeDevice } from '../../../services/tradeDevice'
import { usePkHex } from '../../context/PkHexContext'
import { GAME_LABEL } from '../gameDisplay'
import { GbLinkTaskPanel } from '../GbLinkTaskPanel'
import {
  BOOT_STEP,
  CONNECT_STEP,
  readFromCartridge,
  restoreErrorMessage,
  taskErrorMessage,
} from '../gbLinkTask'
import { gameIdsFromSave } from '../saveVersion'
import { useStorageProvider } from '../useStorage'
import { cartridgeFileName, downloadFile } from './downloadFile'
import { ToolPage } from './ToolPage'

type Task = 'read' | 'write'

interface RestoreFile {
  name: string
  bytes: Uint8Array
  /** Ruby/Sapphire saves fit either cartridge; the cartridge decides. */
  gameIds: readonly Gen3GameId[]
  /** The games, as text: "Emerald", "Ruby or Sapphire". */
  label: string
}

const TASKS = [
  ['read', 'Back up'],
  ['write', 'Restore'],
] as const

const describeReadError = taskErrorMessage()

/**
 * Backs up and restores GBA cartridge saves over GB-Link. The game comes from
 * the cartridge (backup) or the chosen file (restore), never a menu.
 */
export function CartridgeSaves() {
  const { adapter } = usePkHex()
  const { ready } = useStorageProvider()
  const [task, setTask] = useState<Task>('read')
  const [busy, setBusy] = useState(false)
  const [restore, setRestore] = useState<RestoreFile | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const chooseFile = async (file: File | undefined) => {
    setRestore(null)
    setFileError(null)
    if (!file || !adapter) return
    const bytes = new Uint8Array(await file.arrayBuffer())
    try {
      const loaded = adapter.load(bytes)
      try {
        const gameIds = gameIdsFromSave(loaded)
        if (gameIds.length === 0) {
          setFileError(
            `${file.name} is a ${loaded.version.aggregated} save. Restore supports Ruby, Sapphire, Emerald, FireRed and LeafGreen.`
          )
          return
        }
        setRestore({
          name: file.name,
          bytes,
          gameIds,
          label: gameIds.map((id) => GAME_LABEL[id]).join(' or '),
        })
      } finally {
        loaded.dispose()
      }
    } catch {
      setFileError(`${file.name} isn't a save file PKHeX can read.`)
    }
  }

  const backUp = (
    <GbLinkTaskPanel
      key="read"
      title="Back up a cartridge save"
      steps={[CONNECT_STEP, BOOT_STEP]}
      progressLabel="Reading the save"
      onBusyChange={setBusy}
      describeError={describeReadError}
      run={async (task) => {
        const { bytes, cartridge } = await readFromCartridge(task, (t) =>
          gbLinkTradeDevice.readSave(t)
        )
        const name = cartridge
          ? cartridgeFileName(cartridge, 'sav')
          : 'GBA save.sav'
        downloadFile(bytes, name)
        return `Downloaded ${name}.`
      }}
    />
  )

  const restorePanel = restore && (
    <GbLinkTaskPanel
      key={`write-${restore.name}`}
      title={`Restore ${restore.name}`}
      steps={[
        CONNECT_STEP,
        `Insert ${restore.label} and power on while holding START + SELECT.`,
      ]}
      note="The cartridge's current save is stored first as its game's Cabin hardware backup."

      progressLabel="Sending the save"
      disabled={!ready}
      onBusyChange={setBusy}
      onBeforeStart={() =>
        window.confirm(
          `Overwrite the save on the ${restore.label} cartridge with ${restore.name}?`
        )
      }
      describeError={(cause, cancelled) =>
        restoreErrorMessage(
          cause,
          cancelled,
          `If the first step finished, its previous save is that game's Cabin hardware backup.`
        )
      }
      run={async (task) => {
        let cartridgeGame: Gen3GameId = restore.gameIds[0]
        await gbLinkTradeDevice.writeSave({
          ...task,
          gameId: restore.gameIds,
          save: restore.bytes,
          // Stored as the cartridge game's hardware.sav before it is touched.
          backUpCartridgeSave: (cartridgeSave, gameId) => {
            cartridgeGame = gameId
            return storage.putHardwareSave(gameId, cartridgeSave)
          },
        })
        const label = GAME_LABEL[cartridgeGame]
        return `Restored ${restore.name} to the ${label} cartridge. Its previous save is the ${label} Cabin's hardware backup.`
      }}
    />
  )

  return (
    <ToolPage
      label="Choose a task"
      options={TASKS}
      value={task}
      onChange={setTask}
      disabled={busy}
      choices={
        task === 'read' ? (
          <>
            <p>
              Download the save from a GBA cartridge. The game is detected from
              the cartridge.
            </p>
            <p>
              Switch save download is{' '}
              <span className="lab-tag">In research</span>
            </p>
          </>
        ) : (
          <>
            <p>
              Choose a Ruby, Sapphire, Emerald, FireRed or LeafGreen .sav file.
              The cartridge must match the file. A Ruby or Sapphire save fits
              either cartridge.
            </p>
            <label>
              Save file
              <input
                type="file"
                accept=".sav"
                disabled={busy || !adapter}
                onChange={(event) => void chooseFile(event.target.files?.[0])}
              />
            </label>
            {!adapter && <p>Save tools are still loading…</p>}
            {fileError && <p role="status">{fileError}</p>}
            {restore && (
              <p role="status">
                {restore.name} is a Pokémon {restore.label} save.
              </p>
            )}
          </>
        )
      }
      task={
        task === 'read'
          ? backUp
          : (restorePanel ?? <p>Choose a save file to restore.</p>)
      }
    />
  )
}
