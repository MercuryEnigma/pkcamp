import { useTranslation, Trans } from 'react-i18next'
import { i18n } from '../../../services/i18n'
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

const getSteps = () =>
  [
    i18n.t('transporter:PokeTransporter.whatYouNeed'),
    i18n.t('transporter:PokeTransporter.backUpOptional'),
    i18n.t('transporter:PokeTransporter.sendToGba'),
    i18n.t('transporter:PokeTransporter.onTheConsoles'),
  ] as const

const getTaskerror = () =>
  taskErrorMessage({
    cancelled: i18n.t(
      'transporter:PokeTransporter.cancelledResetTheGbaIntoMultibootModeBeforeRetrying'
    ),
    retry: i18n.t('transporter:PokeTransporter.resetTheGbaBeforeRetrying'),
  })

/**
 * A step-by-step guide that sends Poké Transporter GB to the GBA, which then
 * moves Pokémon from a Gen 1–2 game into a Gen 3 game. Backing up both games
 * first is optional.
 */
export function PokeTransporter() {
  const { t } = useTranslation(['transporter', 'common'] as const)

  const [step, setStep] = useState(0)
  const [active, setActive] = useState<Side | null>(null)
  const [busy, setBusy] = useState(false)
  const [backups, setBackups] = useState<Partial<Record<Side, Backup>>>({})
  const [sent, setSent] = useState(false)

  const done = [step > 0, Object.keys(backups).length > 0, sent, false] as const

  const content: ReactNode[] = [
    <>
      <p>{t('PokeTransporter.youNeedTwoSystemsBothGamesGbLinkAndA')}</p>
      <details>
        <summary>{t('PokeTransporter.whichGamesWork')}</summary>
        <p>{t('PokeTransporter.v121SupportsEnglishRedBlueYellowGoldSilver')}</p>
      </details>
      <p>{t('PokeTransporter.movedPokeMonLeaveYourOldGameBothSavesWill')}</p>
    </>,
    <>
      <p>{t('PokeTransporter.backUpBothGamesFirstSoNothingIsLost')}</p>
      <div className="transporter-backups">
        {(['gb', 'gba'] as const).map((side) => (
          <div key={side} className="transporter-backup">
            <h3>
              {side === 'gb'
                ? t('PokeTransporter.gbGbcSource')
                : t('PokeTransporter.gbaDestination')}
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
              {backups[side]
                ? t('PokeTransporter.backUpAgain')
                : t('PokeTransporter.backUp')}
            </button>
            {backups[side] && (
              <button
                type="button"
                className="camp-text-btn"
                onClick={() =>
                  downloadFile(backups[side]!.bytes, backups[side]!.name)
                }
              >
                {t('PokeTransporter.downloadAgain')}
              </button>
            )}
            <p>
              {backups[side]
                ? t('PokeTransporter.backedUp', { name: backups[side].name })
                : t('PokeTransporter.notBackedUpYet')}
            </p>
          </div>
        ))}
      </div>
      {active && (
        <GbLinkTaskPanel
          key={active}
          title={t('PokeTransporter.backUp2', {
            value1:
              active === 'gb'
                ? t('transporter:PokeTransporter.gbGbcSource2')
                : t('transporter:PokeTransporter.gbaDestination'),
          })}
          onBusyChange={setBusy}
          onClose={() => setActive(null)}
          progressLabel={t('PokeTransporter.readingTheSave')}
          describeError={getTaskerror()}
          afterStartSteps={
            active === 'gb'
              ? [
                  t('transporter:PokeTransporter.waitForTheGbcScreenOnTheGba'),
                  t('transporter:PokeTransporter.insertYourGbGbcGame'),
                  t(
                    'transporter:PokeTransporter.pressBOnTheGbaToBackUpTheSave'
                  ),
                ]
              : undefined
          }
          steps={
            active === 'gb'
              ? [
                  t(
                    'transporter:PokeTransporter.connectGbLinkToYourGbaWithAGbcCable'
                  ),
                  t(
                    'transporter:PokeTransporter.turnOnTheGbaWithNoGameInserted'
                  ),
                ]
              : [
                  t('transporter:PokeTransporter.connectGbLinkToYourGba'),
                  t('transporter:PokeTransporter.insertYourGbaGame'),
                  t(
                    'transporter:PokeTransporter.holdStartSelectAsYouTurnOnTheGba'
                  ),
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
            return t(
              'PokeTransporter.downloadStartedTurnOffTheGbaCloseThisBackupPanel',
              { name: name }
            )
          }}
        />
      )}
    </>,
    <>
      <GbLinkTaskPanel
        title={t('PokeTransporter.launchPokeTransporterGbV121')}
        disabled={active !== null}
        startLabel={t('PokeTransporter.startPokeTransporterGb')}
        progressLabel={t('PokeTransporter.sendingPokeTransporter')}
        onBusyChange={setBusy}
        describeError={getTaskerror()}
        steps={[
          t('transporter:PokeTransporter.turnOffTheGba'),
          t(
            'transporter:PokeTransporter.insertTheGbaGameThatWillReceiveYourPokeMon'
          ),
          t(
            'transporter:PokeTransporter.connectGbLinkWithAGameBoyColorLinkCable'
          ),
          t('transporter:PokeTransporter.holdStartSelectAsYouTurnOnTheGba'),
        ]}
        run={async (options) => {
          setSent(false)
          await launchTransporter(options)
          setSent(true)
          return t('PokeTransporter.programSentFollowTheStepsBelow')
        }}
      />
    </>,
    <>
      <ol className="camp-gba-steps">
        <li>{t('PokeTransporter.keepTheGbaRunningPokeTransporterTurnedOn')}</li>
        <li>{t('PokeTransporter.unplugGbLinkFromThatGba')}</li>
        <li>{t('PokeTransporter.putYourGbGbcGameInTheOtherSystem')}</li>
        <li>{t('PokeTransporter.joinTheTwoSystemsWithAGameBoyColorLink')}</li>
        <li>{t('PokeTransporter.followTheStepsOnTheGameScreens')}</li>
      </ol>
      <p className="transporter-warning">
        {t('PokeTransporter.aGbaLinkCableWillNotWork')}
      </p>
    </>,
  ]

  return (
    <div className="transporter">
      <div className="transporter-main">
        <ol
          className="transporter-steps"
          aria-label={t('PokeTransporter.steps')}
        >
          {getSteps().map((title, index) => (
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
          {t('PokeTransporter.stepOf', {
            value1: step + 1,
            length: getSteps().length,
            value3: getSteps()[step],
          })}
        </p>
        <div className="transporter-step">
          <Panel label={getSteps()[step]}>
            <h2>{getSteps()[step]}</h2>
            {content[step]}
          </Panel>
          <div className="transporter-nav">
            <button
              type="button"
              className="camp-upload-btn"
              disabled={busy || step === 0}
              onClick={() => setStep(step - 1)}
            >
              {t('PokeTransporter.back')}
            </button>
            <button
              type="button"
              className="camp-upload-btn camp-upload-btn--primary"
              disabled={busy || step === getSteps().length - 1}
              onClick={() => setStep(step + 1)}
            >
              {t('PokeTransporter.next')}
            </button>
          </div>
        </div>
      </div>
      <p className="transporter-credits">
        <Trans
          ns="transporter"
          i18nKey="PokeTransporter.pokeTransporterGbV121ByStriatonLabTeam"
          components={{
            part1: (
              <a
                href="https://github.com/Striaton-Lab-Team/Poke_Transporter_GB/releases/tag/1.2.1"
                target="_blank"
                rel="noreferrer"
              />
            ),
            part2: (
              <a
                href="https://github.com/Striaton-Lab-Team/Poke_Transporter_GB/blob/1.2.1/docs/EZ_Flash_Omega_DE.md"
                target="_blank"
                rel="noreferrer"
              />
            ),
          }}
        />
      </p>
    </div>
  )
}
