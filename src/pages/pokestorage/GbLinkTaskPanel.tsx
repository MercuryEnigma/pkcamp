import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { GbaCartInfo } from '../../services/gbaSaveDump/gbaCartClient'
import { gbLinkTradeDevice } from '../../services/tradeDevice'
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
  /**
   * Leave the GB-Link connected when the panel closes, so the next task can
   * reuse it. The owner of the session disconnects it later.
   */
  keepConnected?: boolean
  onBeforeStart?: () => boolean
  onBusyChange?: (busy: boolean) => void
  onClose?: () => void
  /** Runs the task; a returned string replaces the status on success. */
  run(task: GbLinkTaskContext): Promise<string | void>
  /** Turns a failure into the status shown to the player. */
  describeError(cause: unknown, cancelled: boolean): string
}

/** Steps, progress and cancellation for one GB-Link cartridge task. */
export function GbLinkTaskPanel(props: GbLinkTaskPanelProps) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const { keepConnected } = props
  useNavigationGuard(
    busy,
    'A cartridge transfer is active. Cancel it and leave?'
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      abortRef.current?.abort()
      if (!keepConnected) void gbLinkTradeDevice.disconnect().catch(() => {})
    }
  }, [keepConnected])

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
    setStatus(
      gbLinkTradeDevice.state === 'connected'
        ? 'Starting…'
        : 'Choose your GB-Link in the browser window.'
    )
    try {
      await gbLinkTradeDevice.connect({ signal: controller.signal })
      controller.signal.throwIfAborted()
      const result = await props.run({
        signal: controller.signal,
        onStatus: report,
        onProgress: (done, total) =>
          report(
            `${props.progressLabel}… ${Math.floor((done / total) * 100)}%`
          ),
        onCartridge: (info) =>
          report(`Detected ${info.title || info.code} (${info.code}).`),
      })
      controller.signal.throwIfAborted()
      if (result) report(result)
    } catch (cause) {
      if (mounted.current)
        setStatus(props.describeError(cause, controller.signal.aborted))
    } finally {
      abortRef.current = null
      if (mounted.current) setRunning(false)
    }
  }

  const connected = gbLinkTradeDevice.state === 'connected'
  const startLabel = props.startLabel ?? 'Start'

  return (
    <div className="camp-gba-task">
      <p className="camp-gba-task-title">{props.title}</p>
      <ol className="camp-gba-steps">
        {props.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
        <li>
          Press {startLabel === 'Start' ? 'Start' : 'the start button'} below.
        </li>
        {!connected && <li>Choose your GB-Link in the browser.</li>}
        {props.afterStartSteps?.map((step, index) => (
          <li key={`after-${index}`}>{step}</li>
        ))}
      </ol>
      {props.note && <p className="camp-gba-task-note">{props.note}</p>}
      <div className="camp-local-actions">
        <button
          type="button"
          className="camp-upload-btn camp-upload-btn--primary"
          disabled={busy || props.disabled || !gbLinkTradeDevice.supported}
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
                  'Cancelling… Close the device chooser if it is still open.'
                )
              } else props.onClose?.()
            }}
          >
            Cancel
          </button>
        )}
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
