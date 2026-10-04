import { describe, expect, it } from 'vitest'
import {
  GB_LINK_MAX_PAYLOAD,
  GbLinkSerialFrameDecoder,
  MIN_GBA_SWITCH_FIRMWARE,
  compareFirmwareVersions,
  encodeGbLinkSerialFrame,
} from './gbLinkProtocol.ts'

describe('GB-Link serial framing', () => {
  it('decodes a frame split across arbitrary serial reads', () => {
    const decoder = new GbLinkSerialFrameDecoder()
    const frame = encodeGbLinkSerialFrame(2, new Uint8Array([0x08, 0xff]))

    expect(decoder.push(frame.slice(0, 1))).toEqual([])
    expect(decoder.push(frame.slice(1, 4))).toEqual([])
    expect(decoder.push(frame.slice(4, 6))).toEqual([])
    expect(decoder.push(frame.slice(6))).toEqual([
      { channel: 2, payload: new Uint8Array([0x08, 0xff]) },
    ])
  })

  it('decodes coalesced frames and ignores bytes before the sync marker', () => {
    const decoder = new GbLinkSerialFrameDecoder()
    const first = encodeGbLinkSerialFrame(0, new Uint8Array([1]))
    const second = encodeGbLinkSerialFrame(1, new Uint8Array(0))
    const bytes = new Uint8Array(2 + first.length + second.length)
    bytes.set([0x00, 0x47])
    bytes.set(first, 2)
    bytes.set(second, 2 + first.length)

    expect(decoder.push(bytes)).toEqual([
      { channel: 0, payload: new Uint8Array([1]) },
      { channel: 1, payload: new Uint8Array(0) },
    ])
  })

  it('rejects oversized outbound payloads', () => {
    expect(() =>
      encodeGbLinkSerialFrame(1, new Uint8Array(GB_LINK_MAX_PAYLOAD + 1))
    ).toThrow(RangeError)
  })

  it('recovers after an oversized inbound frame header', () => {
    const decoder = new GbLinkSerialFrameDecoder()
    const valid = encodeGbLinkSerialFrame(2, new Uint8Array([9, 8]))
    const bytes = new Uint8Array(5 + valid.length)
    bytes.set([0x47, 0x42, 1, GB_LINK_MAX_PAYLOAD + 1, 0])
    bytes.set(valid, 5)

    expect(decoder.push(bytes)).toEqual([
      { channel: 2, payload: new Uint8Array([9, 8]) },
    ])
  })
})

describe('compareFirmwareVersions', () => {
  it('compares dotted numeric versions', () => {
    expect(compareFirmwareVersions('2.2.7', '2.2.7')).toBe(0)
    expect(compareFirmwareVersions('2.2.10', '2.2.7')).toBeGreaterThan(0)
    expect(
      compareFirmwareVersions('2.2.3', MIN_GBA_SWITCH_FIRMWARE)
    ).toBeLessThan(0)
    expect(compareFirmwareVersions('2.3', '2.2.9')).toBeGreaterThan(0)
  })
})
