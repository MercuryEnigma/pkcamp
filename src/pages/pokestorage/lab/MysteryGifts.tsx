import { useTranslation } from 'react-i18next'
import { i18n } from '../../../services/i18n'
import { useEffect, useRef, useState } from 'react'
import { openGbaGift } from '../../../services/mysteryGift/gbaGift'
import {
  MORE_GIFTS_URL,
  getMysteryGifts,
} from '../../../services/mysteryGift/gifts'
import { openSwitchGift } from '../../../services/mysteryGift/switchGift'
import type {
  GiftDecision,
  GiftLink,
  GiftResult,
  GiftStatus,
  GiftTarget,
} from '../../../services/mysteryGift/types'
import { gbLinkErrorMessage } from '../gbLinkTask'
import { useNavigationGuard } from '../navigationGuard'
import { OptionGroup } from '../../hub/OptionGroup'
import { ToolPage } from './ToolPage'

const getTargets = (): readonly (readonly [GiftTarget, string])[] => [
  ['gba', 'GBA'],
  ['switch', i18n.t('mystery-gifts:MysteryGifts.switch')],
]

const getConsole = (): Record<GiftTarget, string> => ({
  gba: 'GBA',
  switch: i18n.t('mystery-gifts:MysteryGifts.switch'),
})

const getWhere = (): Record<GiftTarget, string> => ({
  gba: i18n.t('mystery-gifts:MysteryGifts.readyNowChooseMysteryGiftOnYourGba'),
  switch: i18n.t(
    'mystery-gifts:MysteryGifts.readyNowChooseMysteryGiftOnYourSwitch'
  ),
})

const getSteps = (): Record<GiftTarget, string[]> => ({
  gba: [
    i18n.t('mystery-gifts:MysteryGifts.connectGbLinkToYourComputerAndGba'),
    i18n.t('mystery-gifts:MysteryGifts.useAGameBoyColorLinkCable'),
    i18n.t('mystery-gifts:MysteryGifts.turnOnTheGameStayOnTheMainMenu'),
    i18n.t('mystery-gifts:MysteryGifts.pressStartBelowAndChooseYourGbLink'),
    i18n.t('mystery-gifts:MysteryGifts.waitForReadyOnThisPage'),
    i18n.t('mystery-gifts:MysteryGifts.onTheGbaChooseMysteryGift'),
    i18n.t('mystery-gifts:MysteryGifts.chooseWirelessCommunication'),
  ],
  switch: [
    i18n.t('mystery-gifts:MysteryGifts.connectYourEsp32BoardToYourComputer'),
    i18n.t('mystery-gifts:MysteryGifts.openTheGameStayOnTheMainMenu'),
    i18n.t('mystery-gifts:MysteryGifts.pressStartBelowAndChooseYourEsp32'),
    i18n.t('mystery-gifts:MysteryGifts.waitForReadyOnThisPage'),
    i18n.t('mystery-gifts:MysteryGifts.onTheSwitchChooseMysteryGift'),
    i18n.t('mystery-gifts:MysteryGifts.chooseWonderCardsFriendGblink'),
  ],
})

const getGames = (): Record<GiftTarget, string> => ({
  gba: i18n.t(
    'mystery-gifts:MysteryGifts.forEmeraldFireredAndLeafgreenOnAGbaThroughThe'
  ),
  switch: i18n.t(
    'mystery-gifts:MysteryGifts.forFireredAndLeafgreenOnNintendoSwitchOnlineThroughThe'
  ),
})

type Phase = 'idle' | 'opening' | 'open' | 'stopping'

interface Message {
  headline: string
  hint?: string
}

function statusMessage(status: GiftStatus, target: GiftTarget): Message | null {
  const who =
    status.player?.name ||
    i18n.t('mystery-gifts:MysteryGifts.the', { value1: getConsole()[target] })
  switch (status.stage) {
    case 'open':
      return { headline: getWhere()[target] }
    case 'restarting':
      return {
        headline: i18n.t('mystery-gifts:MysteryGifts.theBoardIsRestarting'),
        hint: i18n.t(
          'mystery-gifts:MysteryGifts.itOpensAgainInAboutHalfAMinute'
        ),
      }
    case 'joining':
      return {
        headline: i18n.t('mystery-gifts:MysteryGifts.isJoining', { who: who }),
      }
    case 'linked':
    case 'checking':
    case 'checked':
    case 'deciding':
      return {
        headline: i18n.t('mystery-gifts:MysteryGifts.linkedWith', { who: who }),
        hint: i18n.t('mystery-gifts:MysteryGifts.checkingItsWonderCard'),
      }
    case 'asking':
      return {
        headline: i18n.t('mystery-gifts:MysteryGifts.hasAnotherWonderCard', {
          who: who,
        }),
        hint: i18n.t(
          'mystery-gifts:MysteryGifts.onTheConsoleChooseWhetherToReplaceItWithThis'
        ),
      }
    case 'sending':
      return {
        headline: i18n.t('mystery-gifts:MysteryGifts.sending', {
          value1:
            status.event?.label ??
            i18n.t('mystery-gifts:MysteryGifts.theCard2'),
        }),
        hint: i18n.t(
          'mystery-gifts:MysteryGifts.keepThisPageOpenUntilTheGameSaysTheCard'
        ),
      }
    case 'closing':
      return { headline: i18n.t('mystery-gifts:MysteryGifts.finishingTheLink') }
    default:
      return null
  }
}

function resultMessage(result: GiftResult, target: GiftTarget): Message {
  const who =
    result.player?.name ||
    i18n.t('mystery-gifts:MysteryGifts.the2', { value1: getConsole()[target] })
  const name =
    result.event?.label ?? i18n.t('mystery-gifts:MysteryGifts.theCard')
  switch (result.outcome) {
    case 'sent':
      return {
        headline: i18n.t('mystery-gifts:MysteryGifts.deliveredTo', {
          name: name,
          who: who,
        }),
        hint: i18n.t(
          'mystery-gifts:MysteryGifts.waitForTheGameToSavePickUpYourGift'
        ),
      }
    case 'had-card':
      return {
        headline: i18n.t(
          'mystery-gifts:MysteryGifts.notSentAlreadyHadThisWonderCard',
          { who: who }
        ),
      }
    case 'kept-card':
      return {
        headline: i18n.t(
          'mystery-gifts:MysteryGifts.notSentKeptTheWonderCardItHad',
          { who: who }
        ),
      }
    case 'cant-accept':
      return {
        headline: i18n.t('mystery-gifts:MysteryGifts.couldnTTakeAWonderCard', {
          who: who,
        }),
      }
    case 'unsupported':
      return {
        headline: i18n.t(
          'mystery-gifts:MysteryGifts.notSentDoesnTRunOnThatGame',
          { name: name }
        ),
      }
    case 'unverified':
      return {
        headline: i18n.t(
          'mystery-gifts:MysteryGifts.notSentDoesnTWorkWithThatCopyOfThe',
          { name: name }
        ),
        hint: i18n.t(
          'mystery-gifts:MysteryGifts.nothingWasSentAndTheGameIsAsItWas'
        ),
      }
    case 'lost':
      return {
        headline: i18n.t(
          'mystery-gifts:MysteryGifts.theLinkDroppedBeforeTheCardWasDelivered'
        ),
      }
    case 'error':
      return {
        headline:
          result.message ??
          i18n.t('mystery-gifts:MysteryGifts.theMysteryGiftExchangeFailed'),
      }
    default:
      return { headline: i18n.t('mystery-gifts:MysteryGifts.theLinkEnded') }
  }
}

function decisionMessage(decision: GiftDecision, target: GiftTarget): string {
  if (decision.reasons.includes('same-card')) {
    return i18n.t(
      'mystery-gifts:MysteryGifts.theAlreadyHasThisWonderCardSendItAgainOr',
      { value1: getConsole()[target] }
    )
  }
  return i18n.t(
    'mystery-gifts:MysteryGifts.thisCardWasChosenForADifferentGameSendIt'
  )
}

const describeError = (cause: unknown) =>
  gbLinkErrorMessage(
    cause,
    i18n.t('mystery-gifts:MysteryGifts.theMysteryGiftGroupCouldNotOpen')
  )

/** Sends one of PkCamp's Mystery Gifts to a GBA (GB-Link) or the Switch (ESP32). */
export function MysteryGifts() {
  const { t } = useTranslation(['mystery-gifts', 'common'] as const)

  const [target, setTarget] = useState<GiftTarget>('gba')
  const [giftId, setGiftId] = useState(getMysteryGifts()[0].id)
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<Message | null>(null)
  const [decision, setDecision] = useState<GiftDecision | null>(null)
  const linkRef = useRef<GiftLink | null>(null)
  const attempt = useRef<AbortController | null>(null)
  const active = phase !== 'idle'
  useNavigationGuard(
    active,
    t('MysteryGifts.aMysteryGiftGroupIsOpenCloseItAndLeave')
  )
  const gift = getMysteryGifts().find((candidate) => candidate.id === giftId)!

  // Leaving the page closes the group.
  useEffect(
    () => () => {
      attempt.current?.abort()
      attempt.current = null
      void linkRef.current?.stop().catch(() => {})
      linkRef.current = null
    },
    []
  )

  const chooseGift = (id: string) => {
    setGiftId(id)
    linkRef.current?.setGift(id)
  }

  const open = async () => {
    if (attempt.current) return
    const controller = new AbortController()
    attempt.current = controller
    const current = () =>
      attempt.current === controller && !controller.signal.aborted
    setPhase('opening')
    setDecision(null)
    setMessage({
      headline: t('MysteryGifts.chooseYourInTheBrowserWindow', {
        value1:
          target === 'gba'
            ? 'GB-Link'
            : t('mystery-gifts:MysteryGifts.esp32Board'),
      }),
    })
    const openLink = target === 'gba' ? openGbaGift : openSwitchGift
    try {
      const link = await openLink(
        giftId,
        {
          onStatus: (status) => {
            if (!current()) return
            const next = statusMessage(status, target)
            if (next) setMessage(next)
          },
          onDecision: (value) => {
            if (current()) setDecision(value)
          },
          onResult: (result) => {
            if (!current()) return
            setDecision(null)
            const view = resultMessage(result, target)
            // A GBA exchange is over once it reports: close the group and
            // release the GB-Link. The Switch board stays open, since it
            // restarts each time it closes.
            const release = target === 'gba'
            setMessage({
              headline: view.headline,
              hint: [
                view.hint,
                release
                  ? t('MysteryGifts.pressStartToSendAnotherGift')
                  : t('MysteryGifts.chooseAnotherGiftAboveToSendAgain'),
              ]
                .filter(Boolean)
                .join(' '),
            })
            // After the session finishes reporting, not inside its callback.
            if (release) queueMicrotask(() => void finish(controller))
          },
          onFailed: (error) => {
            if (!current()) return
            controller.abort()
            attempt.current = null
            linkRef.current = null
            setDecision(null)
            setPhase('idle')
            setMessage({
              headline: t('MysteryGifts.stopped', { message: error.message }),
            })
          },
        },
        { signal: controller.signal }
      )
      if (!current()) {
        await link.stop()
        if (attempt.current === controller) {
          attempt.current = null
          setPhase('idle')
          setMessage({ headline: t('MysteryGifts.cancelled') })
        }
        return
      }
      linkRef.current = link
      setPhase('open')
      setMessage({
        headline: getWhere()[target],
        hint:
          target === 'gba'
            ? t('MysteryGifts.thenChooseWirelessCommunication')
            : t('MysteryGifts.thenChooseWonderCardsFriendGblink'),
      })
    } catch (cause) {
      if (attempt.current !== controller) return
      attempt.current = null
      setPhase('idle')
      setMessage({
        headline: controller.signal.aborted
          ? t('MysteryGifts.cancelled')
          : describeError(cause),
      })
    }
  }

  /** Ends a finished GBA group quietly, keeping the result on screen. */
  const finish = async (controller: AbortController) => {
    if (attempt.current !== controller) return
    attempt.current = null
    const link = linkRef.current
    linkRef.current = null
    setPhase('stopping')
    try {
      await link?.stop()
    } catch {
      // The result is already shown; the link is closed either way.
    } finally {
      setPhase('idle')
    }
  }

  const close = async () => {
    const controller = attempt.current
    controller?.abort()
    const link = linkRef.current
    linkRef.current = null
    setDecision(null)
    setPhase('stopping')
    setMessage({
      headline: t('MysteryGifts.closingTheGroup'),
      hint:
        target === 'switch'
          ? t('MysteryGifts.theBoardRestartsBeforeItIsReadyAgain')
          : undefined,
    })
    // The browser owns its chooser. Keep this attempt busy until it settles.
    if (!link) {
      setMessage({
        headline: t(
          'MysteryGifts.cancellingCloseTheDeviceChooserIfItIsStillOpen'
        ),
      })
      return
    }
    try {
      await link.stop()
      if (attempt.current === controller) setMessage(null)
    } catch (cause) {
      if (attempt.current === controller)
        setMessage({ headline: describeError(cause) })
    } finally {
      if (attempt.current === controller) {
        attempt.current = null
        setPhase('idle')
      }
    }
  }

  return (
    <ToolPage
      label={t('MysteryGifts.chooseYourHardware')}
      options={getTargets()}
      value={target}
      onChange={(value) => {
        setTarget(value)
        setMessage(null)
      }}
      disabled={active}
      choices={
        <>
          <p>{getGames()[target]}</p>
          <h2>{t('MysteryGifts.chooseAGift')}</h2>
          <OptionGroup
            label={t('MysteryGifts.chooseGift')}
            layout="grid"
            options={getMysteryGifts().map(
              (item) => [item.id, item.label] as const
            )}
            value={giftId}
            onChange={chooseGift}
            disabled={phase === 'opening' || phase === 'stopping'}
          />
          <p>{gift.description}</p>
          <p>
            <a href={MORE_GIFTS_URL[target]} target="_blank" rel="noreferrer">
              {t('MysteryGifts.moreGiftsForTheOnGblinkIo', {
                value1: getConsole()[target],
              })}
            </a>
          </p>
        </>
      }
      task={
        <div className="camp-gba-task">
          <p className="camp-gba-task-title">
            {t('MysteryGifts.send', { label: gift.label })}
          </p>
          <ol className="camp-gba-steps">
            {getSteps()[target].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <details className="lab-gift-help">
            <summary>{t('MysteryGifts.noMysteryGiftOnTheMenu')}</summary>
            <ol className="camp-gba-steps">
              <li>
                {t('MysteryGifts.readTheQuestionnaireAtAPokeMartCounter')}
              </li>
              <li>{t('MysteryGifts.enterLinkTogetherWithAll')}</li>
              <li>{t('MysteryGifts.saveYourGame')}</li>
              <li>{t('MysteryGifts.restartTheGameToReturnToTheMainMenu')}</li>
            </ol>
          </details>
          {target === 'switch' && (
            <p className="camp-gba-task-note">
              {t('MysteryGifts.setUpYourSwitchKeysFirst')}
            </p>
          )}
          <div className="camp-local-actions">
            {phase === 'idle' || phase === 'opening' ? (
              <button
                type="button"
                className="camp-upload-btn camp-upload-btn--primary"
                disabled={phase === 'opening'}
                onClick={() => void open()}
              >
                {phase === 'opening'
                  ? t('mystery-gifts:MysteryGifts.starting')
                  : t('common:actions.start')}
              </button>
            ) : (
              <button
                type="button"
                className="camp-upload-btn"
                disabled={phase === 'stopping'}
                onClick={() => void close()}
              >
                {t('common:actions.stop')}
              </button>
            )}
            {phase === 'opening' && (
              <button
                type="button"
                className="camp-text-btn"
                onClick={() => void close()}
              >
                {t('common:actions.cancel')}
              </button>
            )}
          </div>
          {decision && (
            <div className="lab-gift-decision" role="alert">
              <p>{decisionMessage(decision, target)}</p>
              <div className="camp-local-actions">
                <button
                  type="button"
                  className="camp-upload-btn camp-upload-btn--primary"
                  onClick={() => {
                    linkRef.current?.decide(true)
                    setDecision(null)
                  }}
                >
                  {t('MysteryGifts.sendItAgain')}
                </button>
                <button
                  type="button"
                  className="camp-upload-btn"
                  onClick={() => {
                    linkRef.current?.decide(false)
                    setDecision(null)
                  }}
                >
                  {t('MysteryGifts.keepTheOneItHas')}
                </button>
              </div>
            </div>
          )}
          {message && (
            <p className="camp-status" aria-live="polite">
              <strong>{message.headline}</strong>
              {message.hint && <> {message.hint}</>}
            </p>
          )}
        </div>
      }
    />
  )
}
