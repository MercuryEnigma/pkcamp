import { useState, type ReactNode } from 'react'
import { readGbSave } from '../../../services/gbaSaveDump/readGbSave'
import type { GbaCartInfo } from '../../../services/gbaSaveDump/gbaCartClient'
import { launchTransporter } from '../../../services/pokeTransporter/launch'
import { gbLinkTradeDevice } from '../../../services/tradeDevice'
import { GbLinkTaskPanel } from '../GbLinkTaskPanel'
import { taskErrorMessage } from '../gbLinkTask'
import { Panel } from '../../hub/Panel'
import { cartridgeFileName, downloadFile } from './downloadFile'
import './pokeTransporter.css'

type Backup = { bytes: Uint8Array; name: string }
type Side = 'gb' | 'gba'

const STEPS = [
  'What you need',
  'Back up (optional)',
  'Send to GBA',
  'On the consoles',
] as const

const taskError = taskErrorMessage({
  cancelled: 'Cancelled. Reset the GBA into multiboot mode before retrying.',
  retry: 'Reset the GBA before retrying.',
})

/**
 * A step-by-step guide that sends Poké Transporter GB to the GBA, which then
 * moves Pokémon from a Gen 1–2 game into a Gen 3 game. Backing up both games
 * first is optional.
 */
export function PokeTransporter() {
  const [step, setStep] = useState(0)
  const [active, setActive] = useState<Side | null>(null)
  const [busy, setBusy] = useState(false)
  const [backups, setBackups] = useState<Partial<Record<Side, Backup>>>({})
  const [sent, setSent] = useState(false)

  const done = [step > 0, Object.keys(backups).length > 0, sent, false] as const

  const content: ReactNode[] = [
    <>
      <p>
        You need two systems, both games, GB-Link, and a Game Boy Color link
        cable.
      </p>
      <details>
        <summary>Which games work?</summary>
        <p>
          v1.2.1 supports English Red, Blue, Yellow, Gold, Silver, and Crystal,
          and English, Spanish, German, Italian, and French Ruby, Sapphire,
          Emerald, FireRed, and LeafGreen.
        </p>
      </details>
      <p>
        Moved Pokémon leave your old game. Both saves will change. Use original
        cartridges: bootleg copies can lose Pokémon.
      </p>
    </>,
    <>
      <p>Back up both games first, so nothing is lost.</p>
      <div className="transporter-backups">
        {(['gb', 'gba'] as const).map((side) => (
          <div key={side} className="transporter-backup">
            <h3>{side === 'gb' ? 'GB / GBC source' : 'GBA destination'}</h3>
            <button
              type="button"
              className="camp-upload-btn"
              disabled={busy}
              onClick={() => {
                setActive(side)
                setSent(false)
              }}
            >
              {backups[side] ? 'Back up again' : 'Back up'}
            </button>
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
            <p>
              {backups[side]
                ? `Backed up: ${backups[side].name}`
                : 'Not backed up yet.'}
            </p>
          </div>
        ))}
      </div>
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
    </>,
    <>
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
    </>,
    <>
      <ol className="camp-gba-steps">
        <li>Keep the GBA running Poké Transporter turned on.</li>
        <li>Unplug GB-Link from that GBA.</li>
        <li>Put your GB/GBC game in the other system.</li>
        <li>Join the two systems with a Game Boy Color link cable.</li>
        <li>Follow the steps on the game screens.</li>
      </ol>
      <p className="transporter-warning">A GBA link cable will not work.</p>
    </>,
  ]

  return (
    <div className="transporter">
      <div className="transporter-main">
        <ol className="transporter-steps" aria-label="Steps">
          {STEPS.map((title, index) => (
            <li key={title}>
              <button
                type="button"
                aria-current={step === index ? 'step' : undefined}
                disabled={busy}
                onClick={() => setStep(index)}
              >
                <span>{index + 1}</span>
                {title}
                <span aria-hidden="true">
                  {step === index ? '●' : done[index] ? '✓' : ''}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="transporter-indicator">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
        <div className="transporter-step">
          <Panel label={STEPS[step]}>
            <h2>{STEPS[step]}</h2>
            {content[step]}
          </Panel>
          <div className="transporter-nav">
            <button
              type="button"
              className="camp-upload-btn"
              disabled={busy || step === 0}
              onClick={() => setStep(step - 1)}
            >
              ◀ Back
            </button>
            <button
              type="button"
              className="camp-upload-btn camp-upload-btn--primary"
              disabled={busy || step === STEPS.length - 1}
              onClick={() => setStep(step + 1)}
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>
      <p className="transporter-credits">
        Poké Transporter GB v1.2.1 by Striaton Lab Team · MIT code ·{' '}
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
        . Pokémon © Nintendo/Creatures Inc./GAME FREAK Inc. Not endorsed by
        Nintendo.
      </p>
    </div>
  )
}
