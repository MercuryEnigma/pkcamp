import { useNavigationGuard } from './navigationGuard'
import { useEffect, useRef, useState } from 'react'
import type { Gen3GameId } from '../../services/saveLibrary'
import { storage } from '../../services/storage'
import { gbLinkTradeDevice } from '../../services/tradeDevice'
import { usePkHex } from '../context/PkHexContext'
import { GAME_LABEL } from './gameDisplay'
import { assertSaveMatchesCabin } from './saveVersion'
import { storageErrorMessage } from './useStorage'

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
  const { gameId, onClose } = props
  const { adapter } = usePkHex()
  const [busy, setBusy] = useState(false)
  useNavigationGuard(
    busy,
    'A cartridge save transfer is active. Cancel it and leave?'
  )
  const [status, setStatus] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      abortRef.current?.abort()
      void gbLinkTradeDevice.disconnect()
    },
    []
  )

  const start = async () => {
    if (!adapter || props.onBeforeStart?.() === false) return
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setStatus('Choose your GB-Link in the browser window.')
    const options = {
      gameId,
      signal: controller.signal,
      onStatus: setStatus,
      onProgress: (done: number, total: number) =>
        setStatus(
          `${props.mode === 'read' ? 'Reading the save' : 'Sending the backup'}… ${Math.floor((done / total) * 100)}%`
        ),
    }
    try {
      await gbLinkTradeDevice.connect()
      if (props.mode === 'read') {
        const bytes = await gbLinkTradeDevice.readSave(options)
        const loaded = adapter.load(bytes)
        try {
          assertSaveMatchesCabin(gameId, loaded)
        } finally {
          loaded.dispose()
        }
        setStatus(`Saving the ${GAME_LABEL[gameId]} backup…`)
        await storage.putSave(gameId, bytes)
        props.onSave(bytes)
      } else {
        const loaded = adapter.load(props.save)
        try {
          assertSaveMatchesCabin(gameId, loaded)
        } finally {
          loaded.dispose()
        }
        await gbLinkTradeDevice.writeSave({
          ...options,
          save: props.save,
          // Stored as hardware.sav before the cartridge is touched.
          backUpCartridgeSave: (cartridgeSave) =>
            storage.putHardwareSave(gameId, cartridgeSave),
        })
        setStatus('The cartridge save was overwritten.')
        props.onWritten()
      }
    } catch (cause) {
      setStatus(
        controller.signal.aborted ? 'Cancelled.' : storageErrorMessage(cause)
      )
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  return (
    <div className="camp-gba-task">
      <p className="camp-gba-task-title">
        {props.mode === 'write'
          ? `Restore ${GAME_LABEL[gameId]} Cabin to GBA`
          : `Back up ${GAME_LABEL[gameId]} Cabin from GBA`}
      </p>
      <ol className="camp-gba-steps">
        <li>Connect the GB-Link to this computer and your GBA.</li>
        <li>
          Insert {GAME_LABEL[gameId]} and power on while holding START + SELECT.
        </li>
        <li>When ready, continue and choose your GB-Link.</li>
      </ol>
      {props.mode === 'write' && (
        <p className="camp-gba-task-note">
          The cartridge&apos;s current save will be backed up before{' '}
          {GAME_LABEL[gameId]} Cabin is written to it.
        </p>
      )}
      <div className="camp-local-actions">
        <button
          type="button"
          className="camp-upload-btn camp-upload-btn--primary"
          disabled={busy || !adapter || !gbLinkTradeDevice.supported}
          onClick={() => void start()}
        >
          Continue
        </button>
        <button
          type="button"
          className="camp-text-btn"
          onClick={() => (busy ? abortRef.current?.abort() : onClose())}
        >
          Cancel
        </button>
      </div>
      {!gbLinkTradeDevice.supported && (
        <p className="camp-status">
          This browser does not support connecting to the GB-Link.
        </p>
      )}
      {status && (
        <p className="camp-status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  )
}
