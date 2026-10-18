import { useState } from 'react'
import { gbLinkTradeDevice } from '../../../services/tradeDevice'
import { GbLinkTaskPanel } from '../GbLinkTaskPanel'
import {
  BOOT_STEP,
  CONNECT_STEP,
  readFromCartridge,
  taskErrorMessage,
} from '../gbLinkTask'
import { useConfirmNavigation } from '../navigationGuard'
import { cartridgeFileName, downloadFile } from './downloadFile'
import './cartridgeSaves.css'
import './researchPage.css'

type DumpTask = 'rom' | 'bios'

const dumpError = taskErrorMessage({ fallback: 'The dump failed. Try again.' })

/** Downloads a GBA cartridge ROM or the GBA BIOS over GB-Link. Files stay local. */
export function RomBiosDumps({ onBack }: { onBack(): void }) {
  const confirmNavigation = useConfirmNavigation()
  const [task, setTask] = useState<DumpTask>('rom')
  const [busy, setBusy] = useState(false)

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
            <h1 className="camp-title">ROM &amp; BIOS Dumps</h1>
            <p className="camp-page-subtitle">
              Download cartridge ROMs and the GBA BIOS.
            </p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>

        <section
          className="lab-save-workspace research-page-body"
          aria-label="ROM and BIOS dump tools"
        >
          <div className="lab-save-tasks" aria-label="Choose a task">
            {(
              [
                ['rom', 'ROM dump'],
                ['bios', 'BIOS dump'],
              ] as const
            ).map(([value, label]) => (
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

          <div className="lab-save-info">
            <p>
              {task === 'rom'
                ? 'Download the ROM of any GBA cartridge. The game is detected from the cartridge. Large games take several minutes.'
                : 'Download the 16 KB BIOS from your GBA.'}
            </p>
            <p className="research-optional">
              Downloads stay on your computer and are never synced.
            </p>
          </div>

          {task === 'rom' ? (
            <GbLinkTaskPanel
              key="rom"
              title="Dump a cartridge ROM"
              steps={[CONNECT_STEP, BOOT_STEP]}
              progressLabel="Reading the ROM"
              onBusyChange={setBusy}
              describeError={dumpError}
              run={async (dump) => {
                const { bytes, cartridge } = await readFromCartridge(
                  dump,
                  (t) => gbLinkTradeDevice.readRom(t)
                )
                const name = cartridge
                  ? cartridgeFileName(cartridge, 'gba')
                  : 'GBA ROM.gba'
                downloadFile(bytes, name)
                return `Downloaded ${name}.`
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
          )}
        </section>
      </div>
    </div>
  )
}
