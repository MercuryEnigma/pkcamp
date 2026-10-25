import { i18n } from '../i18n'
import { delay, LinkTimeoutError, type GbLinkWords } from './gbLinkWords.ts'

// Port of GB-Link Cart Doctor's web/multiboot.js (GPL-3.0); see
// vendor/gb-cart-doctor/PROVENANCE.md.

const MAX_ROM_BYTES = 0x40000
const HEADER_BYTES = 0xc0
const WAIT_FOR_GBA_MS = 120_000

/** The multiboot body word for `offset`, plus the advanced seed and CRC. */
export function encryptWord(
  word: number,
  offset: number,
  seed: number,
  crc: number
): { word: number; seed: number; crc: number } {
  let tmp = word >>> 0
  for (let bit = 0; bit < 32; bit++) {
    const carry = (crc ^ tmp) & 1
    crc = (crc >>> 1) ^ (carry ? 0xc37b : 0)
    tmp >>>= 1
  }
  seed = Number((BigInt(seed) * 0x6f646573n + 1n) & 0xffffffffn)
  return {
    word: (seed ^ word ^ ((0xfe000000 - offset) >>> 0) ^ 0x43202f2f) >>> 0,
    seed,
    crc,
  }
}

function finalCrc(crc: number, crcA: number, crcB: number): number {
  let tmp = (0xffff0000 | (crcB << 8) | crcA) >>> 0
  for (let bit = 0; bit < 32; bit++) {
    const carry = (crc ^ tmp) & 1
    crc = (crc >>> 1) ^ (carry ? 0xc37b : 0)
    tmp >>>= 1
  }
  return crc
}

/**
 * Sends `rom` to a GBA waiting in multiboot mode (powered on with no
 * cartridge, or holding START + SELECT). Waits up to two minutes for the GBA.
 */
export async function multiboot(
  link: GbLinkWords,
  rom: Uint8Array,
  signal: AbortSignal,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  if (rom.length > MAX_ROM_BYTES)
    throw new Error(i18n.t('services:multiboot.multibootRomIsTooLarge'))
  const size = (rom.length + 0x0f) & ~0x0f
  const data = new Uint8Array(size + 0x10)
  data.set(rom)
  const view = new DataView(data.buffer)

  // While the GBA is off the adapter may not answer; keep polling.
  const deadline = Date.now() + WAIT_FOR_GBA_MS
  for (;;) {
    let reply = 0
    try {
      reply = await link.exchangeOne(0x6202)
    } catch (error) {
      if (!(error instanceof LinkTimeoutError)) throw error
    }
    if (reply >>> 16 === 0x7202) break
    if (Date.now() > deadline) {
      throw new Error(
        i18n.t('services:multiboot.theGbaDidNotStartMultibootTryAgain')
      )
    }
    await delay(10, signal)
  }

  await link.exchangeOne(0x6102)
  const header: number[] = []
  for (let offset = 0; offset < HEADER_BYTES; offset += 2) {
    header.push(view.getUint16(offset, true))
  }
  await link.exchange(header)
  await link.exchange([0x6200, 0x6202, 0x63d1])
  const token = await link.exchangeOne(0x63d1)
  if (token >>> 24 !== 0x73)
    throw new Error(i18n.t('services:multiboot.theGbaMultibootHandshakeFailed'))

  let crcA = (token >>> 16) & 0xff
  let seed = (0xffff00d1 | (crcA << 8)) >>> 0
  crcA = (crcA + 0x0f) & 0xff
  await link.exchangeOne(0x6400 | crcA)
  const token2 = await link.exchangeOne(((size - 0x190) / 4) >>> 0)
  const crcB = (token2 >>> 16) & 0xff
  let crc = 0xc387

  for (let offset = HEADER_BYTES; offset < size;) {
    const count = Math.min(14, (size - offset) / 4)
    const words: number[] = []
    for (let index = 0; index < count; index++) {
      const at = offset + index * 4
      const next = encryptWord(view.getUint32(at, true), at, seed, crc)
      seed = next.seed
      crc = next.crc
      words.push(next.word)
    }
    const replies = await link.exchange(words)
    replies.forEach((reply, index) => {
      const at = offset + index * 4
      if (reply >>> 16 !== (at & 0xffff)) {
        throw new Error(
          i18n.t('services:multiboot.theMultibootTransferWasCorruptedTryAgain')
        )
      }
    })
    offset += count * 4
    onProgress?.(offset, size)
  }

  crc = finalCrc(crc, crcA, crcB)
  await link.exchangeOne(0x0065)
  const ackDeadline = Date.now() + 10_000
  while ((await link.exchangeOne(0x0065)) >>> 16 !== 0x0075) {
    if (Date.now() > ackDeadline) {
      throw new Error(
        i18n.t('services:multiboot.theGbaDidNotConfirmTheMultibootTransfer')
      )
    }
    await delay(10, signal)
  }
  await link.exchange([0x0066, crc & 0xffff])
}
