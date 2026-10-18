import { useState } from 'react'
import { readGbSave } from '../../../services/gbaSaveDump/readGbSave'
import type { GbaCartInfo } from '../../../services/gbaSaveDump/gbaCartClient'
import { launchTransporter } from '../../../services/pokeTransporter/launch'
import { gbLinkTradeDevice } from '../../../services/tradeDevice'
import { GbLinkTaskPanel } from '../GbLinkTaskPanel'
import { taskErrorMessage } from '../gbLinkTask'
import { useConfirmNavigation } from '../navigationGuard'
import { cartridgeFileName, downloadFile } from './downloadFile'
import './cartridgeSaves.css'
import './researchPage.css'
import './pokeTransporter.css'

type Backup = { bytes: Uint8Array; name: string }
type Side = 'gb' | 'gba'

const taskError = taskErrorMessage({
  cancelled: 'Cancelled. Reset the GBA into multiboot mode before retrying.',
  retry: 'Reset the GBA before retrying.',
})

export function PokeTransporter({ onBack }: { onBack(): void }) {
  const confirmNavigation = useConfirmNavigation()
  const [active, setActive] = useState<Side | null>(null)
  const [busy, setBusy] = useState(false)
  const [backups, setBackups] = useState<Partial<Record<Side, Backup>>>({})
  const [sent, setSent] = useState(false)

  return (
    <div className="camp-root research-page">
      <div className="camp-content research-page-content">
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
            <h1 className="camp-title">Poké Transporter GB</h1>
            <p className="camp-page-subtitle">
              Move Pokémon from Gen 1 or 2 into Gen 3.
            </p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>
        <section
          className="lab-save-workspace research-page-body"
          aria-label="Poké Transporter setup"
        >
          <div className="lab-save-info">
            <p>
              You need two systems, both games, GB-Link, and a Game Boy Color
              link cable.
            </p>
            <details>
              <summary>Which games work?</summary>
              <p>
                v1.2.1 supports English Red, Blue, Yellow, Gold, Silver, and
                Crystal, and English, Spanish, German, Italian, and French Ruby,
                Sapphire, Emerald, FireRed, and LeafGreen.
              </p>
            </details>
          </div>
          <section className="lab-save-info" aria-label="Optional backups">
            <h2>Back up both games (recommended)</h2>
            <div className="transporter-backups">
              {(['gb', 'gba'] as const).map((side) => (
                <div key={side}>
                  <h3>
                    {side === 'gb' ? 'GB / GBC source' : 'GBA destination'}
                  </h3>
                  <button
                    type="button"
                    className="camp-upload-btn"
                    disabled={busy}
                    onClick={() => {
                      setActive(side)
                      setSent(false)
                    }}
                  >
                    Back up {side === 'gb' ? 'GB/GBC' : 'GBA'} save
                  </button>
                  <p>
                    {backups[side]
                      ? `Download started: ${backups[side].name}`
                      : 'Not backed up yet.'}
                  </p>
                  {backups[side] && (
                    <button
                      type="button"
                      className="camp-text-btn"
                      onClick={() =>
                        downloadFile(backups[side]!.bytes, backups[side]!.name)
                      }
                    >
                      Download again
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
          {active && (
            <GbLinkTaskPanel
              key={active}
              title={`Back up ${active === 'gb' ? 'GB/GBC source' : 'GBA destination'}`}
              onBusyChange={setBusy}
              onClose={() => setActive(null)}
              progressLabel="Reading the save"
              describeError={taskError}
              afterStartSteps={
                active === 'gb'
                  ? [
                      'Wait for the GBC screen on the GBA.',
                      'Insert your GB/GBC game.',
                      'Press B on the GBA to back up the save.',
                    ]
                  : undefined
              }
              steps={
                active === 'gb'
                  ? [
                      'Connect GB-Link to your GBA with a GBC cable.',
                      'Turn on the GBA with no game inserted.',
                    ]
                  : [
                      'Connect GB-Link to your GBA.',
                      'Insert your GBA game.',
                      'Hold START + SELECT as you turn on the GBA.',
                    ]
              }
              run={async (options) => {
                let info: GbaCartInfo | undefined
                let bytes: Uint8Array
                if (active === 'gb') {
                  const lease = gbLinkTradeDevice.claim(options.signal)
                  try {
                    bytes = await readGbSave(lease.transport, {
                      ...options,
                      signal: lease.signal,
                    })
                  } finally {
                    lease.free()
                  }
                } else {
                  bytes = await gbLinkTradeDevice.readSave({
                    ...options,
                    onCartridge: (cartridge) => {
                      info = cartridge
                      options.onCartridge(cartridge)
                    },
                  })
                }
                const name = info
                  ? cartridgeFileName(info, 'sav')
                  : 'GB-GBC-source.sav'
                setBackups((previous) => ({
                  ...previous,
                  [active]: { bytes, name },
                }))
                downloadFile(bytes, name)
                return `Download started: ${name}. Turn off the GBA. Close this backup panel to continue.`
              }}
            />
          )}
          <div className="lab-save-info">
            <p>
              Moved Pokémon leave your old game. Both saves will change. Use
              original cartridges: bootleg copies can lose Pokémon.
            </p>
          </div>
          <GbLinkTaskPanel
            title="Launch Poké Transporter GB v1.2.1"
            disabled={active !== null}
            startLabel="Start Poké Transporter GB"
            progressLabel="Sending Poké Transporter"
            onBusyChange={setBusy}
            describeError={taskError}
            steps={[
              'Turn off the GBA.',
              'Insert the GBA game that will receive your Pokémon.',
              'Connect GB-Link with a Game Boy Color link cable.',
              'Hold START + SELECT as you turn on the GBA.',
            ]}
            run={async (options) => {
              setSent(false)
              await launchTransporter(options)
              setSent(true)
              return 'Program sent! Follow the steps below.'
            }}
          />
          {sent && (
            <div className="lab-save-info" role="status">
              <h2>Continue on the consoles</h2>
              <ol className="camp-gba-steps">
                <li>Keep the GBA running Poké Transporter turned on.</li>
                <li>Unplug GB-Link from that GBA.</li>
                <li>Put your GB/GBC game in the other system.</li>
                <li>Join the two systems with a Game Boy Color link cable.</li>
                <li>Follow the steps on the game screens.</li>
              </ol>
              <p>A GBA link cable will not work.</p>
            </div>
          )}
          <p className="transporter-credits">
            v1.2.1 ·{' '}
            <a
              href="https://github.com/Striaton-Lab-Team/Poke_Transporter_GB/releases/tag/1.2.1"
              target="_blank"
              rel="noreferrer"
            >
              Release and instructions ↗
            </a>{' '}
            ·{' '}
            <a
              href="https://github.com/Striaton-Lab-Team/Poke_Transporter_GB/blob/1.2.1/docs/EZ_Flash_Omega_DE.md"
              target="_blank"
              rel="noreferrer"
            >
              EZ-Flash Mode B instructions ↗
            </a>
            <br />
            Striaton Lab Team · MIT code. Pokémon © Nintendo/Creatures Inc./GAME
            FREAK Inc. Not endorsed by Nintendo.
          </p>
        </section>
      </div>
    </div>
  )
}
