import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation(['settings', 'common'] as const)

  const [current, setCurrent] = useState<string | null>(
    gbLinkTradeDevice.knownFirmwareVersion
  )
  const [latest, setLatest] = useState<FirmwareBuild | null>(null)
  const [busy, setBusy] = useState(false)
  const [next, setNext] = useState<'check' | 'select' | 'verify'>('check')
  const [message, setMessage] = useState(
    t('GbLinkFirmwareSettings.plugInGbLinkThenPressCheckUpdate')
  )
  const updater = useRef<GbLinkFirmwareUpdater | null>(null)
  const mounted = useRef(false)
  const running = useRef(false)
  const touched = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const usbSupported = Boolean(browserUpdateUsb())
  useNavigationGuard(
    busy || next !== 'check',
    t('GbLinkFirmwareSettings.gbLinkIsUpdatingKeepThisPageOpenAndThe')
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
            t(
              'GbLinkFirmwareSettings.couldNotCheckTheLatestVersionPressCheckUpdateTo'
            )
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
  }, [t])

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
            : t(
                'GbLinkFirmwareSettings.updateFailedKeepGbLinkConnectedAndTryAgain'
              )
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
      <h2>{t('GbLinkFirmwareSettings.gbLinkFirmware')}</h2>
      <p>
        <strong>{t('GbLinkFirmwareSettings.currentVersion')}</strong>{' '}
        {current ?? t('GbLinkFirmwareSettings.connectToCheck')}
      </p>
      <p>
        <strong>{t('GbLinkFirmwareSettings.latestAvailable')}</strong>{' '}
        {latest
          ? latest.beta
            ? t('GbLinkFirmwareSettings.betaVersion', {
                version: latest.version,
              })
            : latest.version
          : t('GbLinkFirmwareSettings.notChecked')}
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
          ? t('GbLinkFirmwareSettings.pleaseWait')
          : next === 'select'
            ? t('GbLinkFirmwareSettings.selectGbLinkToFinishUpdate')
            : next === 'verify'
              ? t('GbLinkFirmwareSettings.reconnectToFinish')
              : t('GbLinkFirmwareSettings.checkUpdate')}
      </button>
      {!usbSupported && (
        <p className="camp-status">
          {t(
            'GbLinkFirmwareSettings.openThisPageInChromeOrEdgeToUpdateAutomatically'
          )}
        </p>
      )}
      <p className="camp-status" role="status">
        {message}
      </p>
    </section>
  )
}
