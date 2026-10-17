import { useEffect, useRef, useState } from 'react'
import { gbLinkTradeDevice } from '../../services/tradeDevice'
import {
  browserUpdateUsb,
  GbLinkFirmwareUpdater,
  latestGbLinkFirmware,
  type FirmwareBuild,
} from '../../services/tradeDevice/gbLinkFirmwareUpdate'
import { useNavigationGuard } from './navigationGuard'

export function GbLinkFirmwareSettings() {
  const [current, setCurrent] = useState<string | null>(
    gbLinkTradeDevice.knownFirmwareVersion
  )
  const [latest, setLatest] = useState<FirmwareBuild | null>(null)
  const [busy, setBusy] = useState(false)
  const [next, setNext] = useState<'check' | 'select' | 'verify'>('check')
  const [message, setMessage] = useState(
    'Plug in GB-Link, then press Check & update.'
  )
  const updater = useRef<GbLinkFirmwareUpdater | null>(null)
  const mounted = useRef(false)
  const running = useRef(false)
  const touched = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const usbSupported = Boolean(browserUpdateUsb())
  useNavigationGuard(
    busy || next !== 'check',
    'GB-Link is updating. Keep this page open and the adapter plugged in. Leave?'
  )

  useEffect(() => {
    mounted.current = true
    updater.current ??= new GbLinkFirmwareUpdater()
    void latestGbLinkFirmware()
      .then((build) => {
        if (mounted.current && !touched.current) setLatest(build)
      })
      .catch(() => {
        if (mounted.current && !touched.current)
          setMessage(
            'Could not check the latest version. Press Check & update to try again.'
          )
      })
    return () => {
      mounted.current = false
      abort.current?.abort()
      // The updater owns a separate bootloader handle while flashing. Close
      // this page's normal connection now, so delayed cleanup cannot close
      // a connection opened by another tool after we leave.
      if (touched.current) void gbLinkTradeDevice.disconnect().catch(() => {})
    }
  }, [])

  async function update() {
    if (running.current || gbLinkTradeDevice.state === 'trading') return
    touched.current = true
    running.current = true
    const controller = new AbortController()
    abort.current = controller
    setBusy(true)
    try {
      await updater.current!.run(
        {
          current: (value) => {
            if (mounted.current) setCurrent(value)
          },
          latest: (value) => {
            if (mounted.current) setLatest(value)
          },
          status: (value) => {
            if (mounted.current) setMessage(value)
          },
        },
        controller.signal
      )
    } catch (cause) {
      if (mounted.current)
        setMessage(
          cause instanceof Error
            ? cause.message
            : 'Update failed. Keep GB-Link connected and try again.'
        )
    } finally {
      running.current = false
      abort.current = null
      if (mounted.current) {
        setNext(updater.current!.nextAction)
        setBusy(false)
      }
    }
  }

  return (
    <section className="camp-settings-section">
      <h2>GB-Link firmware</h2>
      <p>
        <strong>Current version:</strong> {current ?? 'Connect to check'}
      </p>
      <p>
        <strong>Latest available:</strong>{' '}
        {latest
          ? `${latest.version}${latest.beta ? ' (beta)' : ''}`
          : 'Not checked'}
      </p>
      <button
        type="button"
        className="camp-upload-btn camp-upload-btn--primary"
        disabled={
          busy || !usbSupported || gbLinkTradeDevice.state === 'trading'
        }
        onClick={() => void update()}
      >
        {busy
          ? 'Please wait…'
          : next === 'select'
            ? 'Select GB-Link to finish update'
            : next === 'verify'
              ? 'Reconnect to finish'
              : 'Check & update'}
      </button>
      {!usbSupported && (
        <p className="camp-status">
          Open this page in Chrome or Edge to update automatically.
        </p>
      )}
      <p className="camp-status" role="status">
        {message}
      </p>
    </section>
  )
}
