/** GB-Link firmware host protocol values used by PkCamp. */
export const GB_LINK_COMMAND = {
  setMode: 0x00,
  cancel: 0x01,
  getFirmwareInfo: 0x0f,
  /** `[us0, us1, us2, bytesPerTransfer]`, GB link mode only. */
  setTimingConfig: 0x30,
  setVoltage3V3: 0x40,
} as const

export const GB_LINK_MODE = {
  tradeEmulation: 0x00,
  /** Raw SPI exchanges; used to multiboot and talk to the save dumper. */
  gbLink: 0x02,
} as const

export const GB_LINK_STATUS = {
  deviceReady: 0xff08,
  tradeSessionFinished: 0xff09,
  emulationSessionStarted: 0xff0a,
} as const

export const GB_LINK_SERIAL_CHANNEL = {
  command: 0,
  data: 1,
  status: 2,
} as const

export const GB_LINK_MAX_PAYLOAD = 64

const SERIAL_SYNC_0 = 0x47
const SERIAL_SYNC_1 = 0x42

export function encodeGbLinkSerialFrame(
  channel: number,
  payload: Uint8Array
): Uint8Array {
  if (payload.length > GB_LINK_MAX_PAYLOAD) {
    throw new RangeError('A GB-Link serial payload cannot exceed 64 bytes.')
  }

  const frame = new Uint8Array(5 + payload.length)
  frame[0] = SERIAL_SYNC_0
  frame[1] = SERIAL_SYNC_1
  frame[2] = channel
  frame[3] = payload.length & 0xff
  frame[4] = payload.length >>> 8
  frame.set(payload, 5)
  return frame
}

export interface GbLinkSerialFrame {
  channel: number
  payload: Uint8Array
}

type DecoderState =
  'sync-0' | 'sync-1' | 'channel' | 'length-low' | 'length-high' | 'payload'

/** Incremental decoder for the firmware's `GB` Web Serial framing. */
export class GbLinkSerialFrameDecoder {
  private state: DecoderState = 'sync-0'
  private channel = 0
  private length = 0
  private payload = new Uint8Array(0)
  private offset = 0

  push(bytes: Uint8Array): GbLinkSerialFrame[] {
    const frames: GbLinkSerialFrame[] = []
    for (const byte of bytes) {
      switch (this.state) {
        case 'sync-0':
          if (byte === SERIAL_SYNC_0) this.state = 'sync-1'
          break
        case 'sync-1':
          if (byte === SERIAL_SYNC_1) this.state = 'channel'
          else this.state = byte === SERIAL_SYNC_0 ? 'sync-1' : 'sync-0'
          break
        case 'channel':
          this.channel = byte
          this.state = 'length-low'
          break
        case 'length-low':
          this.length = byte
          this.state = 'length-high'
          break
        case 'length-high':
          this.length |= byte << 8
          if (this.length > GB_LINK_MAX_PAYLOAD) {
            this.reset()
          } else if (this.length === 0) {
            frames.push({ channel: this.channel, payload: new Uint8Array(0) })
            this.reset()
          } else {
            this.payload = new Uint8Array(this.length)
            this.offset = 0
            this.state = 'payload'
          }
          break
        case 'payload':
          this.payload[this.offset++] = byte
          if (this.offset === this.length) {
            frames.push({ channel: this.channel, payload: this.payload })
            this.reset()
          }
          break
      }
    }
    return frames
  }

  private reset(): void {
    this.state = 'sync-0'
    this.channel = 0
    this.length = 0
    this.payload = new Uint8Array(0)
    this.offset = 0
  }
}
