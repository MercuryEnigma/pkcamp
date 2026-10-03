import { useEffect, useRef, useState } from 'react'
import type { Gen3GameId } from '../../services/saveLibrary'
import { gbLinkTradeDevice } from '../../services/tradeDevice'
import { usePkHex } from '../context/PkHexProvider'
import { GAME_LABEL } from './gameDisplay'

type GbaSavePanelProps = {
  gameId: Gen3GameId
  onClose(): void
} & (
  | {
      /** Read the cartridge save into PkCamp. */
      mode: 'read'
      /** Receives a save that PKHeX has already opened successfully. */
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
    if (!adapter) return
    if (
      props.mode === 'write' &&
      !window.confirm(
        `This overwrites the save on the ${GAME_LABEL[gameId]} cartridge with the PkCamp backup. It cannot be undone. Continue?`
      )
    ) {
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setStatus('Connecting to the GB-Link…')
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
        adapter.load(bytes).dispose()
        props.onSave(bytes)
      } else {
        await gbLinkTradeDevice.writeSave({ ...options, save: props.save })
        setStatus('The cartridge save was overwritten.')
        props.onWritten()
      }
    } catch (cause) {
      setStatus(
        controller.signal.aborted
          ? 'Cancelled.'
          : cause instanceof Error
            ? cause.message
            : String(cause)
      )
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  return (
    <div className="camp-gba-read">
      <p>
        Connect the GB-Link to a GBA with {GAME_LABEL[gameId]} inserted. After
        pressing Start, turn the GBA on while holding START + SELECT.
        {props.mode === 'write' &&
          ' This replaces the save on the cartridge with the PkCamp backup.'}
      </p>
      <div className="camp-local-actions">
        <button
          type="button"
          className="camp-upload-btn camp-upload-btn--primary"
          disabled={busy || !adapter || !gbLinkTradeDevice.supported}
          onClick={() => void start()}
        >
          Start
        </button>
        <button
          type="button"
          className="camp-upload-btn"
          onClick={() => (busy ? abortRef.current?.abort() : onClose())}
        >
          {busy ? 'Cancel' : 'Close'}
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
