import { useEffect, useRef, useState } from 'react'
import { openGbaGift } from '../../../services/mysteryGift/gbaGift'
import {
  MORE_GIFTS_URL,
  MYSTERY_GIFTS,
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

const TARGETS: readonly (readonly [GiftTarget, string])[] = [
  ['gba', 'GBA'],
  ['switch', 'Switch'],
]

const CONSOLE: Record<GiftTarget, string> = { gba: 'GBA', switch: 'Switch' }

const WHERE: Record<GiftTarget, string> = {
  gba: 'Ready! Now choose MYSTERY GIFT on your GBA.',
  switch: 'Ready! Now choose MYSTERY GIFT on your Switch.',
}

const STEPS: Record<GiftTarget, string[]> = {
  gba: [
    'Connect GB-Link to your computer and GBA.',
    'Use a Game Boy Color link cable.',
    'Turn on the game. Stay on the main menu.',
    'Press Start below and choose your GB-Link.',
    'Wait for “Ready!” on this page.',
    'On the GBA, choose MYSTERY GIFT.',
    'Choose WIRELESS COMMUNICATION.',
  ],
  switch: [
    'Connect your ESP32 board to your computer.',
    'Open the game. Stay on the main menu.',
    'Press Start below and choose your ESP32.',
    'Wait for “Ready!” on this page.',
    'On the Switch, choose MYSTERY GIFT.',
    'Choose WONDER CARDS → FRIEND → GBLINK.',
  ],
}

const GAMES: Record<GiftTarget, string> = {
  gba: 'For Emerald, FireRed and LeafGreen on a GBA, through the GB-Link.',
  switch:
    'For FireRed and LeafGreen on Nintendo Switch Online, through the ESP32 board.',
}

type Phase = 'idle' | 'opening' | 'open' | 'stopping'

interface Message {
  headline: string
  hint?: string
}

function statusMessage(status: GiftStatus, target: GiftTarget): Message | null {
  const who = status.player?.name || `The ${CONSOLE[target]}`
  switch (status.stage) {
    case 'open':
      return { headline: WHERE[target] }
    case 'restarting':
      return {
        headline: 'The board is restarting…',
        hint: 'It opens again in about half a minute.',
      }
    case 'joining':
      return { headline: `${who} is joining…` }
    case 'linked':
    case 'checking':
    case 'checked':
    case 'deciding':
      return {
        headline: `Linked with ${who}.`,
        hint: 'Checking its Wonder Card…',
      }
    case 'asking':
      return {
        headline: `${who} has another Wonder Card.`,
        hint: 'On the console, choose whether to replace it with this one.',
      }
    case 'sending':
      return {
        headline: `Sending ${status.event?.label ?? 'the card'}…`,
        hint: 'Keep this page open until the game says the card was received.',
      }
    case 'closing':
      return { headline: 'Finishing the link…' }
    default:
      return null
  }
}

function resultMessage(result: GiftResult, target: GiftTarget): Message {
  const who = result.player?.name || `the ${CONSOLE[target]}`
  const name = result.event?.label ?? 'The card'
  switch (result.outcome) {
    case 'sent':
      return {
        headline: `${name}: delivered to ${who}.`,
        hint: 'Wait for the game to save. Pick up your gift upstairs in a Pokémon Center.',
      }
    case 'had-card':
      return { headline: `Not sent: ${who} already had this Wonder Card.` }
    case 'kept-card':
      return { headline: `Not sent: ${who} kept the Wonder Card it had.` }
    case 'cant-accept':
      return { headline: `${who} couldn’t take a Wonder Card.` }
    case 'unsupported':
      return { headline: `Not sent: ${name} doesn’t run on that game.` }
    case 'unverified':
      return {
        headline: `Not sent: ${name} doesn’t work with that copy of the game.`,
        hint: 'Nothing was sent, and the game is as it was.',
      }
    case 'lost':
      return { headline: 'The link dropped before the card was delivered.' }
    case 'error':
      return { headline: result.message ?? 'The Mystery Gift exchange failed.' }
    default:
      return { headline: 'The link ended.' }
  }
}

function decisionMessage(decision: GiftDecision, target: GiftTarget): string {
  if (decision.reasons.includes('same-card')) {
    return `The ${CONSOLE[target]} already has this Wonder Card. Send it again, or keep the one it has?`
  }
  return 'This card was chosen for a different game. Send it anyway?'
}

const describeError = (cause: unknown) =>
  gbLinkErrorMessage(cause, 'The Mystery Gift group could not open.')

/** Sends one of PkCamp's Mystery Gifts to a GBA (GB-Link) or the Switch (ESP32). */
export function MysteryGifts() {
  const [target, setTarget] = useState<GiftTarget>('gba')
  const [giftId, setGiftId] = useState(MYSTERY_GIFTS[0].id)
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<Message | null>(null)
  const [decision, setDecision] = useState<GiftDecision | null>(null)
  const linkRef = useRef<GiftLink | null>(null)
  const attempt = useRef<AbortController | null>(null)
  const active = phase !== 'idle'
  useNavigationGuard(
    active,
    'A Mystery Gift group is open. Close it and leave?'
  )
  const gift = MYSTERY_GIFTS.find((candidate) => candidate.id === giftId)!

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
      headline: `Choose your ${target === 'gba' ? 'GB-Link' : 'ESP32 board'} in the browser window.`,
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
                  ? 'Press Start to send another gift.'
                  : 'Choose another gift above to send again.',
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
            setMessage({ headline: `Stopped: ${error.message}` })
          },
        },
        { signal: controller.signal }
      )
      if (!current()) {
        await link.stop()
        if (attempt.current === controller) {
          attempt.current = null
          setPhase('idle')
          setMessage({ headline: 'Cancelled.' })
        }
        return
      }
      linkRef.current = link
      setPhase('open')
      setMessage({
        headline: WHERE[target],
        hint:
          target === 'gba'
            ? 'Then choose WIRELESS COMMUNICATION.'
            : 'Then choose WONDER CARDS → FRIEND → GBLINK.',
      })
    } catch (cause) {
      if (attempt.current !== controller) return
      attempt.current = null
      setPhase('idle')
      setMessage({
        headline: controller.signal.aborted
          ? 'Cancelled.'
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
      headline: 'Closing the group…',
      hint:
        target === 'switch'
          ? 'The board restarts before it is ready again.'
          : undefined,
    })
    // The browser owns its chooser. Keep this attempt busy until it settles.
    if (!link) {
      setMessage({
        headline: 'Cancelling… Close the device chooser if it is still open.',
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
      label="Choose your hardware"
      options={TARGETS}
      value={target}
      onChange={(value) => {
        setTarget(value)
        setMessage(null)
      }}
      disabled={active}
      choices={
        <>
          <p>{GAMES[target]}</p>
          <h2>Choose a gift</h2>
          <OptionGroup
            label="Choose a gift"
            layout="grid"
            options={MYSTERY_GIFTS.map(
              (item) => [item.id, item.label] as const
            )}
            value={giftId}
            onChange={chooseGift}
            disabled={phase === 'opening' || phase === 'stopping'}
          />
          <p>{gift.description}</p>
          <p>
            <a href={MORE_GIFTS_URL[target]} target="_blank" rel="noreferrer">
              More gifts for the {CONSOLE[target]} on gblink.io →
            </a>
          </p>
        </>
      }
      task={
        <div className="camp-gba-task">
          <p className="camp-gba-task-title">Send {gift.label}</p>
          <ol className="camp-gba-steps">
            {STEPS[target].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <details className="lab-gift-help">
            <summary>No MYSTERY GIFT on the menu?</summary>
            <ol className="camp-gba-steps">
              <li>Read the questionnaire at a Poké Mart counter.</li>
              <li>Enter LINK TOGETHER WITH ALL.</li>
              <li>Save your game.</li>
              <li>Restart the game to return to the main menu.</li>
            </ol>
          </details>
          {target === 'switch' && (
            <p className="camp-gba-task-note">Set up your Switch keys first.</p>
          )}
          <div className="camp-local-actions">
            {phase === 'idle' || phase === 'opening' ? (
              <button
                type="button"
                className="camp-upload-btn camp-upload-btn--primary"
                disabled={phase === 'opening'}
                onClick={() => void open()}
              >
                {phase === 'opening' ? 'Starting…' : 'Start'}
              </button>
            ) : (
              <button
                type="button"
                className="camp-upload-btn"
                disabled={phase === 'stopping'}
                onClick={() => void close()}
              >
                Stop
              </button>
            )}
            {phase === 'opening' && (
              <button
                type="button"
                className="camp-text-btn"
                onClick={() => void close()}
              >
                Cancel
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
                  Send it again
                </button>
                <button
                  type="button"
                  className="camp-upload-btn"
                  onClick={() => {
                    linkRef.current?.decide(false)
                    setDecision(null)
                  }}
                >
                  Keep the one it has
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
