import { i18n } from '../i18n'
import { gbLinkTradeDevice } from './service'
import { compareFirmwareVersions } from './gbLinkProtocol'
import { Picoboot, type PicobootSession } from './vendor/picoflash/picoboot.js'
import { uf2ToFlashBuffer } from './vendor/picoflash/uf2.js'

const ORIGIN = 'https://raw.githubusercontent.com/GB-Link/gblink-launcher/main/'
export interface FirmwareBuild {
  version: string
  beta: boolean
  url: string
}
interface BootDevice {
  vendorId: number
  productId: number
  serialNumber?: string
}
export interface UpdateUsb {
  getDevices(): Promise<BootDevice[]>
  requestDevice(options: {
    filters: { vendorId: number; productId: number }[]
  }): Promise<BootDevice>
}
interface FirmwareDevice {
  state: string
  connect(options?: {
    previouslyGrantedOnly?: boolean
    signal?: AbortSignal
  }): Promise<void>
  disconnect(): Promise<void>
  firmwareVersion(): Promise<string | null>
  rebootToBootloader(): Promise<void>
}
export interface UpdateDependencies {
  device: FirmwareDevice
  usb: UpdateUsb
  fetch: typeof fetch
  boot(device: BootDevice): PicobootSession
  wait(ms: number): Promise<void>
}
export interface UpdateCallbacks {
  status(message: string): void
  current(version: string | null): void
  latest(build: FirmwareBuild): void
}
export type UpdateResult = 'current' | 'select' | 'verify' | 'updated'

export async function latestGbLinkFirmware(
  fetcher: typeof fetch = fetch
): Promise<FirmwareBuild> {
  const response = await fetcher(`${ORIGIN}assets/firmware/manifest.json`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok)
    throw new Error(
      i18n.t(
        'services:gbLinkFirmwareUpdate.couldNotCheckTheLatestFirmwareTryAgain'
      )
    )
  const catalog = (await response.json()) as { gblink?: unknown }
  if (!Array.isArray(catalog.gblink))
    throw new Error(
      i18n.t('services:gbLinkFirmwareUpdate.theFirmwareCatalogIsUnavailable')
    )
  const builds: FirmwareBuild[] = []
  for (const entry of catalog.gblink) {
    if (
      !entry ||
      typeof entry.version !== 'string' ||
      !/^\d+\.\d+\.\d+$/.test(entry.version)
    )
      continue
    const expected = `assets/firmware/${entry.beta ? 'beta.' : ''}gblink.v${entry.version}.uf2`
    if (entry.uf2 !== expected) continue
    builds.push({
      version: entry.version,
      beta: entry.beta === true,
      url: `${ORIGIN}${expected}`,
    })
  }
  builds.sort(
    (a, b) =>
      compareFirmwareVersions(b.version, a.version) ||
      Number(a.beta) - Number(b.beta)
  )
  if (!builds[0])
    throw new Error(
      i18n.t('services:gbLinkFirmwareUpdate.noCompatibleGbLinkFirmwareWasFound')
    )
  return builds[0]
}

/** Validate every block before allowing any erase, not just the UF2 magic. */
export function prepareFirmware(bytes: Uint8Array) {
  if (!bytes.length || bytes.length % 512 || bytes.length > 4 * 1024 * 1024)
    throw new Error(
      i18n.t('services:gbLinkFirmwareUpdate.theFirmwareDownloadIsIncomplete')
    )
  const blocks = bytes.length / 512
  const seen = new Set<number>()
  for (let offset = 0; offset < bytes.length; offset += 512) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 512)
    const address = view.getUint32(12, true)
    const index = view.getUint32(20, true)
    if (
      view.getUint32(0, true) !== 0x0a324655 ||
      view.getUint32(4, true) !== 0x9e5d5157 ||
      view.getUint32(508, true) !== 0x0ab16f30 ||
      view.getUint32(8, true) !== 0x2000 ||
      view.getUint32(28, true) !== 0xe48bff56 ||
      view.getUint32(16, true) !== 256 ||
      view.getUint32(24, true) !== blocks ||
      index >= blocks ||
      seen.has(index) ||
      address !== 0x10000000 + index * 256
    ) {
      throw new Error(
        i18n.t(
          'services:gbLinkFirmwareUpdate.theFirmwareIsNotACompleteGbLinkRp2040Image'
        )
      )
    }
    seen.add(index)
  }
  return uf2ToFlashBuffer(bytes)
}

export function browserUpdateUsb(): UpdateUsb | undefined {
  return (navigator as unknown as { usb?: UpdateUsb }).usb
}

/** Owns one pending image across the browser's bootloader permission prompt. */
export class GbLinkFirmwareUpdater {
  private readonly deps: UpdateDependencies
  private pending: {
    build: FirmwareBuild
    image: ReturnType<typeof prepareFirmware>
  } | null = null
  private expectedVersion: string | null = null
  private working = false
  constructor(deps?: UpdateDependencies) {
    this.deps = deps ?? {
      device: gbLinkTradeDevice,
      usb: browserUpdateUsb()!,
      fetch: (input, init) => fetch(input, init),
      boot: (device) => Picoboot.fromDevice(device),
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    }
  }

  async run(
    callbacks: UpdateCallbacks,
    signal?: AbortSignal
  ): Promise<UpdateResult> {
    signal?.throwIfAborted()
    if (this.working || this.deps.device.state === 'trading')
      throw new Error(
        i18n.t(
          'services:gbLinkFirmwareUpdate.gbLinkIsBusyFinishTheCurrentTaskFirst'
        )
      )
    if (!this.deps.usb)
      throw new Error(
        i18n.t(
          'services:gbLinkFirmwareUpdate.useChromeOrEdgeForAutomaticFirmwareUpdates'
        )
      )
    this.working = true
    try {
      if (this.pending) {
        // Keep the chooser directly on this click's user gesture.
        const device = await this.deps.usb.requestDevice({
          filters: [{ vendorId: 0x2e8a, productId: 0x0003 }],
        })
        signal?.throwIfAborted()
        return await this.flash(device, callbacks, signal)
      }
      if (this.expectedVersion) {
        callbacks.status(
          i18n.t(
            'services:gbLinkFirmwareUpdate.selectYourGbLinkToFinishCheckingTheUpdate'
          )
        )
        await this.deps.device.connect({ signal })
        signal?.throwIfAborted()
        return await this.verifyVersion(callbacks)
      }
      callbacks.status(i18n.t('services:gbLinkFirmwareUpdate.chooseYourGbLink'))
      if (this.deps.device.state === 'connected')
        await this.deps.device.disconnect()
      signal?.throwIfAborted()
      await this.deps.device.connect({ signal })
      const current = await this.deps.device.firmwareVersion()
      signal?.throwIfAborted()
      callbacks.current(current)
      if (!current)
        throw new Error(
          i18n.t(
            'services:gbLinkFirmwareUpdate.couldNotReadTheInstalledVersionReconnectGbLinkAnd'
          )
        )
      callbacks.status(
        i18n.t('services:gbLinkFirmwareUpdate.checkingTheLatestFirmware')
      )
      const build = await latestGbLinkFirmware(this.deps.fetch)
      signal?.throwIfAborted()
      callbacks.latest(build)
      if (compareFirmwareVersions(current, build.version) >= 0) {
        callbacks.status(
          i18n.t('services:gbLinkFirmwareUpdate.yourGbLinkIsUpToDate')
        )
        return 'current'
      }
      callbacks.status(
        i18n.t('services:gbLinkFirmwareUpdate.preparingFirmware', {
          version: build.version,
        })
      )
      const response = await this.deps.fetch(build.url, {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
          : AbortSignal.timeout(20000),
      })
      if (!response.ok)
        throw new Error(
          i18n.t(
            'services:gbLinkFirmwareUpdate.couldNotDownloadFirmwareYourGbLinkHasNotBeen'
          )
        )
      const image = prepareFirmware(
        new Uint8Array(await response.arrayBuffer())
      )
      const key = (device: BootDevice) =>
        `${device.vendorId}:${device.productId}:${device.serialNumber ?? ''}`
      const previous = new Set((await this.deps.usb.getDevices()).map(key))
      signal?.throwIfAborted()
      this.pending = { build, image }
      callbacks.status(
        i18n.t('services:gbLinkFirmwareUpdate.restartingGbLinkIntoUpdateMode')
      )
      try {
        await this.deps.device.rebootToBootloader()
      } catch {
        await this.deps.device.disconnect().catch(() => {})
        callbacks.status(
          i18n.t(
            'services:gbLinkFirmwareUpdate.unplugGbLinkHoldBootselWhilePluggingItBackIn'
          )
        )
      }
      for (let attempt = 0; attempt < 8; attempt++) {
        await this.deps.wait(250)
        signal?.throwIfAborted()
        const devices = (await this.deps.usb.getDevices()).filter(
          (device) =>
            device.vendorId === 0x2e8a &&
            device.productId === 0x0003 &&
            !previous.has(key(device))
        )
        signal?.throwIfAborted()
        if (devices.length === 1)
          return await this.flash(devices[0], callbacks, signal)
      }
      callbacks.status(
        compareFirmwareVersions(current, '2.1.2') < 0
          ? i18n.t(
              'services:gbLinkFirmwareUpdate.unplugGbLinkHoldBootselWhilePluggingItBackIn2'
            )
          : i18n.t(
              'services:gbLinkFirmwareUpdate.pressTheButtonBelowAndSelectRp2BootToFinish'
            )
      )
      return 'select'
    } finally {
      this.working = false
    }
  }

  get nextAction(): 'select' | 'verify' | 'check' {
    return this.pending ? 'select' : this.expectedVersion ? 'verify' : 'check'
  }

  private async flash(
    device: BootDevice,
    callbacks: UpdateCallbacks,
    signal?: AbortSignal
  ): Promise<UpdateResult> {
    if (
      device.vendorId !== 0x2e8a ||
      device.productId !== 0x0003 ||
      !this.pending
    )
      throw new Error(
        i18n.t('services:gbLinkFirmwareUpdate.selectTheGbLinkRp2BootDevice')
      )
    const { build, image } = this.pending
    const boot = this.deps.boot(device)
    try {
      callbacks.status(
        i18n.t('services:gbLinkFirmwareUpdate.updatingGbLinkKeepItPluggedIn')
      )
      let connection:
        Awaited<ReturnType<PicobootSession['connect']>> | undefined
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          connection = await boot.connect()
          break
        } catch (cause) {
          await this.close(boot)
          if (attempt === 3) throw cause
          await this.deps.wait(400)
        }
      }
      if (!connection)
        throw new Error(
          i18n.t('services:gbLinkFirmwareUpdate.couldNotOpenGbLinkInUpdateMode')
        )
      signal?.throwIfAborted()
      // Once erase starts, complete writing, verification and reboot even if
      // the UI closes. An interrupted flash could leave the adapter unusable.
      await boot.flashEraseAndWrite(image.address, image.data)
      callbacks.status(
        i18n.t(
          'services:gbLinkFirmwareUpdate.checkingTheWrittenFirmwareKeepItPluggedIn'
        )
      )
      const read = await boot.flashRead(image.address, image.data.length)
      if (
        read.length !== image.data.length ||
        read.some((value, i) => value !== image.data[i])
      )
        throw new Error(
          i18n.t(
            'services:gbLinkFirmwareUpdate.firmwareVerificationFailedKeepGbLinkConnectedAndRetryThe'
          )
        )
      this.expectedVersion = build.version
      this.pending = null
      try {
        await connection.reboot(500)
      } catch {
        /* USB disconnect is expected on reboot. */
      }
    } finally {
      await this.close(boot)
    }
    signal?.throwIfAborted()
    callbacks.status(i18n.t('services:gbLinkFirmwareUpdate.reconnectingGbLink'))
    for (let attempt = 0; attempt < 12; attempt++) {
      await this.deps.wait(250)
      signal?.throwIfAborted()
      try {
        await this.deps.device.connect({ previouslyGrantedOnly: true, signal })
      } catch {
        continue
      }
      return await this.verifyVersion(callbacks)
    }
    callbacks.status(
      i18n.t(
        'services:gbLinkFirmwareUpdate.firmwareWrittenAndCheckedPressTheButtonBelowToReconnect'
      )
    )
    return 'verify'
  }

  private async verifyVersion(
    callbacks: UpdateCallbacks
  ): Promise<UpdateResult> {
    const current = await this.deps.device.firmwareVersion()
    callbacks.current(current)
    if (!current || compareFirmwareVersions(current, this.expectedVersion!) < 0)
      throw new Error(
        i18n.t(
          'services:gbLinkFirmwareUpdate.couldNotConfirmTheNewFirmwareVersionReconnectAndTry'
        )
      )
    this.expectedVersion = null
    callbacks.status(
      i18n.t('services:gbLinkFirmwareUpdate.gbLinkIsUpToDate', {
        current: current,
      })
    )
    return 'updated'
  }

  private async close(boot: PicobootSession) {
    await boot.disconnect().catch(() => {})
    if (boot.device.opened) await boot.device.close().catch(() => {})
  }
}
