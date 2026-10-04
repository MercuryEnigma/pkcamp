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
  open(): Promise<void>
  close(): Promise<void>
  sendCommand(command: number, args?: Uint8Array): Promise<void>
  sendData(payload: Uint8Array): Promise<void>
  onStatus(listener: (status: number) => void): () => void
  /** Data-endpoint payloads from the adapter (e.g. `GetEmuTradeResult` replies). */
  onData(listener: (payload: Uint8Array) => void): () => void
  /** Every status and data payload of any length, with its serial channel. */
  onFrame(listener: (channel: number, payload: Uint8Array) => void): () => void
}

interface UsbTransferInResultLike {
  data?: DataView
  status?: string
}

interface UsbTransferOutResultLike {
  status?: string
}

interface UsbDeviceLike {
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

  async open(): Promise<void> {
    if (this.connected) return
    const host = browserNavigator()
    if (!host) throw new Error('This browser has no USB device APIs.')

    let webUsbError: unknown
    if (host.usb) {
      try {
        await this.openUsb(
          await host.usb.requestDevice({ filters: USB_FILTERS })
        )
        return
      } catch (error) {
        webUsbError = error
        await this.close()
      }
    }

    if (host.serial) {
      await this.openSerial(
        await host.serial.requestPort({ filters: SERIAL_FILTERS })
      )
      return
    }

    throw (
      webUsbError ??
      new Error('This browser supports neither WebUSB nor Web Serial.')
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
    await Promise.allSettled(this.readTasks)
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
    try {
      await this.usbDevice?.close()
    } catch {
      // Ignore a device that was physically disconnected.
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
      throw new RangeError('A GB-Link data payload cannot exceed 64 bytes.')
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
        'The GB-Link serial port did not expose readable and writable streams.'
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
    if (!this.connected) throw new Error('The GB-Link is not connected.')
    if (this.currentKind === 'webserial') {
      if (!this.serialWriter)
        throw new Error('The GB-Link serial writer is unavailable.')
      await this.serialWriter.write(
        encodeGbLinkSerialFrame(serialChannel, payload)
      )
      return
    }
    if (!this.usbDevice)
      throw new Error('The GB-Link USB device is unavailable.')
    const result = await this.usbDevice.transferOut(usbEndpoint, payload)
    if (result.status && result.status !== 'ok') {
      throw new Error(`GB-Link USB write failed: ${result.status}.`)
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
      if (!this.closing) this.connected = false
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
      if (!this.closing) this.connected = false
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
      if (!this.closing && reader === this.serialReader) this.connected = false
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
