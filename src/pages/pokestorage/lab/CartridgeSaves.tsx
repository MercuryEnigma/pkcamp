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
import { useConfirmNavigation } from '../navigationGuard'
import { gameIdFromSave } from '../saveVersion'
import { useStorageProvider } from '../useStorage'
import { cartridgeFileName, downloadFile } from './downloadFile'
import './cartridgeSaves.css'
import './researchPage.css'

type Task = 'read' | 'write' | 'repair'

interface RestoreFile {
  name: string
  bytes: Uint8Array
  gameId: Gen3GameId
}

const TASKS = [
  ['read', 'Back up'],
  ['write', 'Restore'],
  ['repair', 'Repair'],
] as const

const describeReadError = taskErrorMessage()

/**
 * Backs up and restores GBA cartridge saves over GB-Link. The game comes from
 * the cartridge (backup) or the chosen file (restore), never a menu.
 */
export function CartridgeSaves({ onBack }: { onBack(): void }) {
  const confirmNavigation = useConfirmNavigation()
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
        const gameId = gameIdFromSave(loaded)
        if (!gameId) {
          setFileError(
            `${file.name} is a ${loaded.version.aggregated} save. Restore supports Ruby, Sapphire, Emerald, FireRed and LeafGreen.`
          )
          return
        }
        setRestore({ name: file.name, bytes, gameId })
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
      keepConnected
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
        `Insert ${GAME_LABEL[restore.gameId]} and power on while holding START + SELECT.`,
      ]}
      note={`The cartridge's current save is stored first as the ${GAME_LABEL[restore.gameId]} Cabin's hardware backup.`}
      progressLabel="Sending the save"
      keepConnected
      disabled={!ready}
      onBusyChange={setBusy}
      onBeforeStart={() =>
        window.confirm(
          `Overwrite the save on the ${GAME_LABEL[restore.gameId]} cartridge with ${restore.name}?`
        )
      }
      describeError={(cause, cancelled) =>
        restoreErrorMessage(
          cause,
          cancelled,
          `If the first step finished, its previous save is the ${GAME_LABEL[restore.gameId]} Cabin's hardware backup.`
        )
      }
      run={async (task) => {
        await gbLinkTradeDevice.writeSave({
          ...task,
          gameId: restore.gameId,
          save: restore.bytes,
          // Stored as the Cabin's hardware.sav before the cartridge is touched.
          backUpCartridgeSave: (cartridgeSave) =>
            storage.putHardwareSave(restore.gameId, cartridgeSave),
        })
        return `Restored ${restore.name} to the ${GAME_LABEL[restore.gameId]} cartridge. Its previous save is the ${GAME_LABEL[restore.gameId]} Cabin's hardware backup.`
      }}
    />
  )

  return (
    <div className="camp-root lab-saves-root research-page">
      <div className="camp-content lab-saves-content research-page-content">
        <header className="camp-page-header">
          <button
            type="button"
            className="camp-back"
            onClick={() => {
              if (confirmNavigation()) onBack()
            }}
          >
            ← Back
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">Research Tools</p>
            <h1 className="camp-title">Cartridge Saves</h1>
            <p className="camp-page-subtitle">
              Back up and restore GBA cartridge saves.
            </p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>

        <section
          className="lab-save-workspace research-page-body"
          aria-label="Cartridge save tools"
        >
          <div className="lab-save-tasks" aria-label="Choose a task">
            {TASKS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`camp-settings-tab${task === value ? ' camp-settings-tab--active' : ''}`}
                aria-pressed={task === value}
                disabled={busy}
                onClick={() => setTask(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {task === 'read' && (
            <>
              <div className="lab-save-info">
                <p>
                  Download the save from a GBA cartridge. The game is detected
                  from the cartridge.
                </p>
                <p className="research-optional">
                  Switch save download is{' '}
                  <span className="lab-tag">In research</span>
                </p>
              </div>
              {backUp}
            </>
          )}

          {task === 'write' && (
            <>
              <div className="lab-save-info">
                <p>
                  Choose a Ruby, Sapphire, Emerald, FireRed or LeafGreen .sav
                  file. The game is detected from the file, and the cartridge
                  must match it.
                </p>
              </div>
              <label className="lab-save-game">
                Save file
                <input
                  type="file"
                  accept=".sav"
                  disabled={busy || !adapter}
                  onChange={(event) => void chooseFile(event.target.files?.[0])}
                />
              </label>
              {!adapter && (
                <p className="camp-status">Save tools are still loading…</p>
              )}
              {fileError && (
                <p className="camp-status" role="status">
                  {fileError}
                </p>
              )}
              {restore && (
                <p className="camp-status" role="status">
                  {restore.name} is a Pokémon {GAME_LABEL[restore.gameId]} save.
                </p>
              )}
              {restorePanel}
            </>
          )}

          {task === 'repair' && (
            <div className="lab-save-info">
              <p>
                Ruby and Sapphire berry glitch repair and clock changes are{' '}
                <span className="lab-tag">Coming later</span>
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
