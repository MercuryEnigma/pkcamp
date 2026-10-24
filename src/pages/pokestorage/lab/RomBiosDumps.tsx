import { useState } from 'react'
import {
  gen3GameIdFromCode,
  type Gen3GameId,
} from '../../../services/saveLibrary'
import { storage } from '../../../services/storage'
import { gbLinkTradeDevice } from '../../../services/tradeDevice'
import { GAME_LABEL } from '../gameDisplay'
import { GbLinkTaskPanel } from '../GbLinkTaskPanel'
import {
  BOOT_STEP,
  CONNECT_STEP,
  readFromCartridge,
  taskErrorMessage,
} from '../gbLinkTask'
import { cartridgeFileName, downloadFile } from './downloadFile'
import { ToolPage } from './ToolPage'

type DumpTask = 'rom' | 'bios'

const TASKS = [
  ['rom', 'ROM dump'],
  ['bios', 'BIOS dump'],
] as const

interface RomDump {
  bytes: Uint8Array
  name: string
  /** The Gen 3 game the cartridge is, if it is one. */
  gameId: Gen3GameId | null
}

const dumpError = taskErrorMessage({ fallback: 'The dump failed. Try again.' })

/** Downloads a GBA cartridge ROM or the GBA BIOS over GB-Link. */
export function RomBiosDumps() {
  const [task, setTask] = useState<DumpTask>('rom')
  const [busy, setBusy] = useState(false)
  const [dump, setDump] = useState<RomDump | null>(null)
  const [stored, setStored] = useState<string | null>(null)

  const backUpToStorage = async (bytes: Uint8Array, gameId: Gen3GameId) => {
    try {
      await storage.putRom(gameId, { bytes, extension: 'gba' })
      setStored(`Saved as the ${GAME_LABEL[gameId]} ROM.`)
    } catch (cause) {
      setStored(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <ToolPage
      label="Choose a task"
      options={TASKS}
      value={task}
      onChange={setTask}
      disabled={busy}
      choices={
        task === 'rom' ? (
          <>
            <p>
              Download the ROM of any GBA cartridge. The game is detected from
              the cartridge. Large games take several minutes.
            </p>
            {dump && (
              <>
                <p role="status">Dumped {dump.name}.</p>
                <button
                  type="button"
                  className="camp-upload-btn"
                  onClick={() => downloadFile(dump.bytes, dump.name)}
                >
                  Download
                </button>
                {dump.gameId && (
                  <button
                    type="button"
                    className="camp-upload-btn"
                    onClick={() =>
                      void backUpToStorage(dump.bytes, dump.gameId!)
                    }
                  >
                    Back up to storage for the Arcade
                  </button>
                )}
                {stored && <p role="status">{stored}</p>}
              </>
            )}
          </>
        ) : (
          <>
            <p>Download the 16 KB BIOS from your GBA.</p>
            <p>Downloads stay on your computer and are never synced.</p>
          </>
        )
      }
      task={
        task === 'rom' ? (
          <GbLinkTaskPanel
            key="rom"
            title="Dump a cartridge ROM"
            steps={[CONNECT_STEP, BOOT_STEP]}
            progressLabel="Reading the ROM"
            onBusyChange={setBusy}
            describeError={dumpError}
            run={async (task) => {
              setDump(null)
              setStored(null)
              const { bytes, cartridge } = await readFromCartridge(task, (t) =>
                gbLinkTradeDevice.readRom(t)
              )
              const name = cartridge
                ? cartridgeFileName(cartridge, 'gba')
                : 'GBA ROM.gba'
              setDump({
                bytes,
                name,
                gameId: cartridge ? gen3GameIdFromCode(cartridge.code) : null,
              })
              return `Dumped ${name}.`
            }}
          />
        ) : (
          <GbLinkTaskPanel
            key="bios"
            title="Dump the GBA BIOS"
            steps={[
              CONNECT_STEP,
              'Power on the GBA while holding START + SELECT. A cartridge isn’t needed.',
            ]}
            progressLabel="Reading the BIOS"
            onBusyChange={setBusy}
            describeError={dumpError}
            run={async (dump) => {
              const bytes = await gbLinkTradeDevice.readBios(dump)
              downloadFile(bytes, 'gba_bios.bin')
              return 'Downloaded gba_bios.bin.'
            }}
          />
        )
      }
    />
  )
}
