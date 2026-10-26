import { i18n } from '../i18n'
import {
  GB_LINK_MAX_PAYLOAD,
  GB_LINK_SERIAL_CHANNEL,
  GbLinkSerialFrameDecoder,
  encodeGbLinkSerialFrame,
} from './gbLinkProtocol.ts'

export type GbLinkTransportKind = 'webusb' | 'webserial'

export interface GbLinkTransport {
  readonly attached: boolean
  readonly kind: GbLinkTransportKind | null
  open(options?: {
    previouslyGrantedOnly?: boolean
    signal?: AbortSignal
  }): Promise<void>
  close(): Promise<void>
  sendCommand(command: number, args?: Uint8Array): Promise<void>
  sendData(payload: Uint8Array): Promise<void>
  onStatus(listener: (status: number) => void): () => void
  /** Data-endpoint payloads from the adapter (e.g. `GetEmuTradeResult` replies). */
  onData(listener: (payload: Uint8Array) => void): () => void
  /** Every status and data payload of any length, with its serial channel. */
  onFrame(listener: (channel: number, payload: Uint8Array) => void): () => void
  /**
   * Called once when the link drops on its own (unplugged, or a USB read
   * failed), so the owner can release it. Not called by `close()`.
   */
  onDetach?(listener: () => void): () => void
}

interface UsbTransferInResultLike {
  data?: DataView
  status?: string
}

interface UsbTransferOutResultLike {
  status?: string
}

interface UsbDeviceLike {
  vendorId?: number
  productId?: number
  configuration?: { configurationValue: number } | null
  open(): Promise<void>
  selectConfiguration(value: number): Promise<void>
  claimInterface(interfaceNumber: number): Promise<void>
  transferIn(
    endpointNumber: number,
    length: number
  ): Promise<UsbTransferInResultLike>
  transferOut(
    endpointNumber: number,
    data: Uint8Array
  ): Promise<UsbTransferOutResultLike>
  close(): Promise<void>
}

interface SerialReaderLike {
  read(): Promise<{ value?: Uint8Array; done: boolean }>
  cancel(): Promise<void>
  releaseLock(): void
}

interface SerialWriterLike {
  write(data: Uint8Array): Promise<void>
  releaseLock(): void
}

interface SerialPortLike {
  readable?: { getReader(): SerialReaderLike } | null
  writable?: { getWriter(): SerialWriterLike } | null
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
}

interface GbLinkNavigator {
  usb?: {
    getDevices?(): Promise<UsbDeviceLike[]>
    requestDevice(options: {
      filters: { vendorId: number; productId: number }[]
    }): Promise<UsbDeviceLike>
  }
  serial?: {
    requestPort(options: {
      filters: { usbVendorId: number }[]
    }): Promise<SerialPortLike>
  }
}

const USB_FILTERS = [
  { vendorId: 0x2fe3, productId: 0x0100 },
  { vendorId: 0x2fe3, productId: 0x000a },
  { vendorId: 0x8086, productId: 0xf8a1 },
]

const SERIAL_FILTERS = [{ usbVendorId: 0x2fe3 }]
/** Closing never waits longer than this for the read loops to stop. */
const READ_STOP_TIMEOUT_MS = 1000
const STATUS_ENDPOINT = 1
const DATA_ENDPOINT = 2

function browserNavigator(): GbLinkNavigator | undefined {
  if (typeof navigator === 'undefined') return undefined
  return navigator as unknown as GbLinkNavigator
}

function statusFrom(payload: Uint8Array): number | null {
  if (payload.length !== 2) return null
  return payload[0] | (payload[1] << 8)
}

/**
 * Browser transport for current GB-Link firmware. WebUSB is attempted first;
 * Web Serial is the fallback when WebUSB is unavailable or cannot be opened.
 */
export class BrowserGbLinkTransport implements GbLinkTransport {
  private usbDevice: UsbDeviceLike | null = null
  private serialPort: SerialPortLike | null = null
  private serialReader: SerialReaderLike | null = null
  private serialWriter: SerialWriterLike | null = null
  private currentKind: GbLinkTransportKind | null = null
  private connected = false
  private closing = false
  private readonly listeners = new Set<(status: number) => void>()
  private readonly dataListeners = new Set<(payload: Uint8Array) => void>()
  private readonly frameListeners = new Set<
    (channel: number, payload: Uint8Array) => void
  >()
  private readonly detachListeners = new Set<() => void>()
  private readonly decoder = new GbLinkSerialFrameDecoder()
  private readTasks: Promise<void>[] = []

  static available(): boolean {
    const host = browserNavigator()
    return Boolean(host?.usb || host?.serial)
  }

  get attached(): boolean {
    return this.connected
  }

  get kind(): GbLinkTransportKind | null {
    return this.currentKind
  }

  async open(options?: {
    previouslyGrantedOnly?: boolean
    signal?: AbortSignal
  }): Promise<void> {
    const signal = options?.signal
    signal?.throwIfAborted()
    if (this.connected) return
    const host = browserNavigator()
    if (!host)
      throw new Error(
        i18n.t('services:gbLinkTransport.thisBrowserHasNoUsbDeviceApis')
      )

    // A GB-Link this site may already use reconnects without the chooser.
    if (!options?.previouslyGrantedOnly && host.usb?.getDevices) {
      try {
        await this.open({ previouslyGrantedOnly: true, signal })
        return
      } catch {
        signal?.throwIfAborted()
      }
    }

    if (options?.previouslyGrantedOnly) {
      const devices = (await host.usb?.getDevices?.()) ?? []
      signal?.throwIfAborted()
      const matches = devices.filter((device) =>
        USB_FILTERS.some(
          (filter) =>
            device.vendorId === filter.vendorId &&
            device.productId === filter.productId
        )
      )
      if (matches.length !== 1)
        throw new Error(
          i18n.t('services:gbLinkTransport.selectYourGbLinkToReconnect')
        )
      try {
        await this.openUsb(matches[0])
        signal?.throwIfAborted()
        return
      } catch (cause) {
        await this.close()
        throw cause
      }
    }

    let webUsbError: unknown
    if (host.usb) {
      try {
        const device = await host.usb.requestDevice({ filters: USB_FILTERS })
        signal?.throwIfAborted()
        await this.openUsb(device)
        signal?.throwIfAborted()
        return
      } catch (error) {
        webUsbError = error
        await this.close()
        signal?.throwIfAborted()
        if (
          error instanceof DOMException &&
          ['NotFoundError', 'AbortError'].includes(error.name)
        )
          throw error
      }
    }

    if (host.serial) {
      const port = await host.serial.requestPort({ filters: SERIAL_FILTERS })
      signal?.throwIfAborted()
      await this.openSerial(port)
      signal?.throwIfAborted()
      return
    }

    throw (
      webUsbError ??
      new Error(
        i18n.t(
          'services:gbLinkTransport.thisBrowserSupportsNeitherWebusbNorWebSerial'
        )
      )
    )
  }

  async close(): Promise<void> {
    this.closing = true
    this.connected = false

    try {
      await this.serialReader?.cancel()
    } catch {
      // The port may already have disappeared.
    }
    // A pending USB read only settles when data arrives or the device closes,
    // so close it before waiting for the reads, or this waits forever.
    try {
      await this.usbDevice?.close()
    } catch {
      // Ignore a device that was physically disconnected.
    }
    await Promise.race([
      Promise.allSettled(this.readTasks),
      new Promise((resolve) => setTimeout(resolve, READ_STOP_TIMEOUT_MS)),
    ])
    this.readTasks = []

    try {
      this.serialReader?.releaseLock()
    } catch {
      // Ignore a lock already released by the browser.
    }
    try {
      this.serialWriter?.releaseLock()
    } catch {
      // Ignore a lock already released by the browser.
    }
    try {
      await this.serialPort?.close()
    } catch {
      // Ignore a port that was physically disconnected.
    }

    this.usbDevice = null
    this.serialPort = null
    this.serialReader = null
    this.serialWriter = null
    this.currentKind = null
    this.closing = false
  }

  async sendCommand(command: number, args = new Uint8Array(0)): Promise<void> {
    const payload = new Uint8Array(1 + args.length)
    payload[0] = command
    payload.set(args, 1)
    await this.write(GB_LINK_SERIAL_CHANNEL.command, STATUS_ENDPOINT, payload)
  }

  async sendData(payload: Uint8Array): Promise<void> {
    if (payload.length > GB_LINK_MAX_PAYLOAD) {
      throw new RangeError(
        'A GB-Link data payload cannot exceed 64 bytes.'
      )
    }
    await this.write(GB_LINK_SERIAL_CHANNEL.data, DATA_ENDPOINT, payload)
  }

  onStatus(listener: (status: number) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onData(listener: (payload: Uint8Array) => void): () => void {
    this.dataListeners.add(listener)
    return () => this.dataListeners.delete(listener)
  }

  onFrame(
    listener: (channel: number, payload: Uint8Array) => void
  ): () => void {
    this.frameListeners.add(listener)
    return () => this.frameListeners.delete(listener)
  }

  onDetach(listener: () => void): () => void {
    this.detachListeners.add(listener)
    return () => this.detachListeners.delete(listener)
  }

  /** The link dropped without `close()`: report it once. */
  private detached(): void {
    if (this.closing || !this.connected) return
    this.connected = false
    for (const listener of this.detachListeners) listener()
  }

  private async openUsb(device: UsbDeviceLike): Promise<void> {
    this.usbDevice = device
    await device.open()
    if (device.configuration?.configurationValue !== 1) {
      await device.selectConfiguration(1)
    }
    await device.claimInterface(0)
    this.currentKind = 'webusb'
    this.connected = true
    this.closing = false
    this.readTasks = [this.readUsbStatuses(), this.readUsbData()]
  }

  private async openSerial(port: SerialPortLike): Promise<void> {
    this.serialPort = port
    await port.open({ baudRate: 115200 })
    if (!port.readable || !port.writable) {
      throw new Error(
        i18n.t(
          'services:gbLinkTransport.theGbLinkSerialPortDidNotExposeReadableAnd'
        )
      )
    }
    this.serialReader = port.readable.getReader()
    this.serialWriter = port.writable.getWriter()
    this.currentKind = 'webserial'
    this.connected = true
    this.closing = false
    this.readTasks = [this.readSerialFrames()]
  }

  private async write(
    serialChannel: number,
    usbEndpoint: number,
    payload: Uint8Array
  ): Promise<void> {
    if (!this.connected)
      throw new Error(
        i18n.t('services:gbLinkTransport.theGbLinkIsNotConnected')
      )
    if (this.currentKind === 'webserial') {
      if (!this.serialWriter)
        throw new Error(
          i18n.t('services:gbLinkTransport.theGbLinkSerialWriterIsUnavailable')
        )
      await this.serialWriter.write(
        encodeGbLinkSerialFrame(serialChannel, payload)
      )
      return
    }
    if (!this.usbDevice)
      throw new Error(
        i18n.t('services:gbLinkTransport.theGbLinkUsbDeviceIsUnavailable')
      )
    const result = await this.usbDevice.transferOut(usbEndpoint, payload)
    if (result.status && result.status !== 'ok') {
      throw new Error(
        i18n.t('services:gbLinkTransport.gbLinkUsbWriteFailed', {
          status: result.status,
        })
      )
    }
  }

  private async readUsbStatuses(): Promise<void> {
    const device = this.usbDevice
    if (!device) return
    try {
      while (this.connected && device === this.usbDevice) {
        const result = await device.transferIn(
          STATUS_ENDPOINT,
          GB_LINK_MAX_PAYLOAD
        )
        if (!result.data || result.data.byteLength === 0) continue
        const payload = new Uint8Array(
          result.data.buffer.slice(
            result.data.byteOffset,
            result.data.byteOffset + result.data.byteLength
          )
        )
        this.emitFrame(GB_LINK_SERIAL_CHANNEL.status, payload)
        this.emitStatus(statusFrom(payload))
      }
    } catch {
      this.detached()
    }
  }

  private async readUsbData(): Promise<void> {
    const device = this.usbDevice
    if (!device) return
    try {
      while (this.connected && device === this.usbDevice) {
        const result = await device.transferIn(
          DATA_ENDPOINT,
          GB_LINK_MAX_PAYLOAD
        )
        if (!result.data || result.data.byteLength === 0) continue
        const payload = new Uint8Array(
          result.data.buffer.slice(
            result.data.byteOffset,
            result.data.byteOffset + result.data.byteLength
          )
        )
        this.emitFrame(GB_LINK_SERIAL_CHANNEL.data, payload)
        this.emitData(payload)
      }
    } catch {
      this.detached()
    }
  }

  private async readSerialFrames(): Promise<void> {
    const reader = this.serialReader
    if (!reader) return
    try {
      while (this.connected && reader === this.serialReader) {
        const { value, done } = await reader.read()
        if (done) break
        if (!value) continue
        for (const frame of this.decoder.push(value)) {
          this.emitFrame(frame.channel, frame.payload)
          if (frame.channel === GB_LINK_SERIAL_CHANNEL.status) {
            this.emitStatus(statusFrom(frame.payload))
          } else if (frame.channel === GB_LINK_SERIAL_CHANNEL.data) {
            this.emitData(frame.payload)
          }
        }
      }
    } catch {
      // Closing and unplugging both terminate the reader.
    } finally {
      if (reader === this.serialReader) this.detached()
    }
  }

  private emitFrame(channel: number, payload: Uint8Array): void {
    for (const listener of this.frameListeners) listener(channel, payload)
  }

  private emitData(payload: Uint8Array): void {
    for (const listener of this.dataListeners) listener(payload)
  }

  private emitStatus(status: number | null): void {
    if (status === null) return
    for (const listener of this.listeners) listener(status)
  }
}
