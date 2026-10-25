import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { GbaCartInfo } from '../../services/gbaSaveDump/gbaCartClient'
import { device } from '../../services/device'
import { useNavigationGuard } from './navigationGuard'

export interface GbLinkTaskContext {
  signal: AbortSignal
  onStatus(message: string): void
  onProgress(done: number, total: number): void
  onCartridge(info: GbaCartInfo): void
}

type GbLinkTaskPanelProps = {
  title: string
  /** Shown as numbered steps before the task starts. */
  steps: ReactNode[]
  /** Actions on the console after pressing Start in this panel. */
  afterStartSteps?: ReactNode[]
  note?: ReactNode
  /** Prefixes the percentage while the task reports progress. */
  progressLabel: string
  startLabel?: string
  disabled?: boolean
  onBeforeStart?: () => boolean
  onBusyChange?: (busy: boolean) => void
  onClose?: () => void
  /** Runs the task; a returned string replaces the status on success. */
  run(task: GbLinkTaskContext): Promise<string | void>
  /** Turns a failure into the status shown to the player. */
  describeError(cause: unknown, cancelled: boolean): string
}

/**
 * Steps, progress and cancellation for one GB-Link cartridge task. The
 * GB-Link is released when the task ends, however it ends; the next task
 * reconnects to it, without the chooser where the browser allows.
 */
export function GbLinkTaskPanel(props: GbLinkTaskPanelProps) {
  const { t } = useTranslation(['camp', 'common'] as const)

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  useNavigationGuard(
    busy,
    t('GbLinkTaskPanel.aCartridgeTransferIsActiveCancelItAndLeave')
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      // A running task disconnects as it settles.
      abortRef.current?.abort()
    }
  }, [])

  const setRunning = (running: boolean) => {
    setBusy(running)
    props.onBusyChange?.(running)
  }

  const start = async () => {
    if (abortRef.current) return
    if (props.onBeforeStart?.() === false) return
    const controller = new AbortController()
    abortRef.current = controller
    const report = (message: string) => {
      if (mounted.current && !controller.signal.aborted) setStatus(message)
    }
    setRunning(true)
    setProgress(null)
    setStatus(
      device.state === 'connected'
        ? t('GbLinkTaskPanel.starting')
        : t('GbLinkTaskPanel.connectingChooseYourGbLinkIfTheBrowserAsks')
    )
    try {
      await device.connect({ signal: controller.signal })
      controller.signal.throwIfAborted()
      const result = await props.run({
        signal: controller.signal,
        onStatus: report,
        onProgress: (done, total) => {
          if (mounted.current && !controller.signal.aborted)
            setProgress(done / total)
          report(
            t('GbLinkTaskPanel.transferProgress', {
              progressLabel: props.progressLabel,
              value2: Math.floor((done / total) * 100),
            })
          )
        },
        onCartridge: (info) =>
          report(
            t('GbLinkTaskPanel.detected', {
              value1: info.title || info.code,
              code: info.code,
            })
          ),
      })
      controller.signal.throwIfAborted()
      if (result) report(result)
    } catch (cause) {
      if (mounted.current)
        setStatus(props.describeError(cause, controller.signal.aborted))
    } finally {
      // Another tool may still hold the GB-Link (a refused "busy" start).
      if (device.state !== 'trading') await device.disconnect().catch(() => {})
      abortRef.current = null
      if (mounted.current) setRunning(false)
    }
  }

  const startLabel = props.startLabel ?? t('common:actions.start')

  return (
    <div className="camp-gba-task">
      <p className="camp-gba-task-title">{props.title}</p>
      <ol className="camp-gba-steps">
        {props.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
        <li>
          {props.startLabel
            ? t('GbLinkTaskPanel.pressStartButtonBelow')
            : t('GbLinkTaskPanel.pressStartBelow')}
        </li>
        <li>{t('GbLinkTaskPanel.ifTheBrowserAsksChooseYourGbLink')}</li>
        {props.afterStartSteps?.map((step, index) => (
          <li key={`after-${index}`}>{step}</li>
        ))}
      </ol>
      {props.note && <p className="camp-gba-task-note">{props.note}</p>}
      <div className="camp-local-actions">
        <button
          type="button"
          className="camp-upload-btn camp-upload-btn--primary"
          disabled={busy || props.disabled || !device.supported}
          onClick={() => void start()}
        >
          {startLabel}
        </button>
        {(busy || props.onClose) && (
          <button
            type="button"
            className="camp-text-btn"
            onClick={() => {
              if (busy) {
                abortRef.current?.abort()
                setStatus(
                  t(
                    'GbLinkTaskPanel.cancellingCloseTheDeviceChooserIfItIsStillOpen'
                  )
                )
              } else props.onClose?.()
            }}
          >
            {t('common:actions.cancel')}
          </button>
        )}
      </div>
      {!device.supported && (
        <p className="camp-status">
          {t('GbLinkTaskPanel.thisBrowserDoesNotSupportConnectingToTheGbLink')}
        </p>
      )}
      {busy && progress !== null && (
        <progress value={progress} max={1} aria-label={props.progressLabel} />
      )}
      {status && (
        <p className="camp-status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  )
}
