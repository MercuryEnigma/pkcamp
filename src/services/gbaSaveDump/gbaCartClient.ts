import { i18n } from '../i18n'
import { delay, type GbLinkWords } from './gbLinkWords.ts'

// Port of the save, ROM and BIOS commands of GB-Link Cart Doctor's web/gba_cart.js
// (GPL-3.0); see vendor/gb-cart-doctor/PROVENANCE.md.

export const GBA_CART = {
  M_MAGIC: 0x47420000,
  M_POLL: 0x00000000,
  M_GO: 0x4742600d,
  M_CONT: 0x4742c047,
  M_FAIL: 0x4742bad0,
  M_ABORT: 0x4742ab0b,
  G_READY: 0x52454459,
  G_DONE: 0x444f4e45,
  G_OKOK: 0x4f4b4f4b,
  G_FAIL: 0x4641494c,
  CMD_DUMP_ROM: 1,
  CMD_DUMP_SAVE: 2,
  CMD_RESTORE: 3,
  CMD_DUMP_BIOS: 5,
  CMD_INFO: 6,
  SECTION_WORDS: 0x40,
  BIOS_BYTES: 0x4000,
} as const

const NO_CART = 0xffffffff
const MAX_SECTION_RETRIES = 50
const MAX_UPLOAD_RETRIES = 8

export interface GbaCartInfo {
  /** Four-character game code, e.g. `AXVE` for Pokémon Ruby (USA). */
  code: string
  title: string
  saveSize: number
}

/**
 * Host side of the 32-bit SIO protocol spoken by the Cart Doctor dumper
 * payload. Every exchange is one full-duplex word; slow phases end with a
 * DONE gate, and data moves in 256-byte sections closed by an XOR checksum.
 */
export class GbaCartClient {
  private readonly link: GbLinkWords
  private readonly signal: AbortSignal

  constructor(link: GbLinkWords, signal: AbortSignal) {
    this.link = link
    this.signal = signal
  }

  /** True when the payload answers from its idle loop within `timeoutMs`. */
  async ping(timeoutMs = 5000): Promise<boolean> {
    try {
      await this.pollReady(timeoutMs)
      return true
    } catch (error) {
      if (this.signal.aborted) throw error
      return false
    }
  }

  /** Returns null when no cartridge is inserted. */
  async readInfo(): Promise<GbaCartInfo | null> {
    await this.command(GBA_CART.CMD_INFO)
    await this.waitDone(60_000)
    const [gameSize, saveSize] = await this.readWords(2)
    if (gameSize === NO_CART) return null
    const header = new Uint8Array(0xc0)
    const view = new DataView(header.buffer)
    ;(await this.readWords(0xc0 / 4)).forEach((word, index) =>
      view.setUint32(index * 4, word, true)
    )
    const ascii = (from: number, length: number): string =>
      String.fromCharCode(
        ...header.subarray(from, from + length).filter((byte) => byte !== 0)
      ).trim()
    return { code: ascii(0xac, 4), title: ascii(0xa0, 12), saveSize }
  }

  async dumpSave(
    onProgress?: (done: number, total: number) => void
  ): Promise<Uint8Array> {
    await this.command(GBA_CART.CMD_DUMP_SAVE)
    await this.waitDone(60_000)
    const [gameSize, saveSize] = await this.readWords(2)
    if (gameSize === NO_CART)
      throw new Error(
        i18n.t('services:gbaCartClient.noGbaCartridgeWasDetected')
      )
    if (saveSize === 0)
      throw new Error(
        i18n.t('services:gbaCartClient.thisCartridgeHasNoSaveMemory')
      )
    await this.waitDone(120_000)
    return this.streamIn(saveSize, onProgress)
  }

  /** Reads the whole cartridge ROM; its size comes from the payload's probe. */
  async dumpRom(
    onProgress?: (done: number, total: number) => void
  ): Promise<Uint8Array> {
    await this.command(GBA_CART.CMD_DUMP_ROM)
    await this.waitDone(30_000)
    const [gameSize] = await this.readWords(1)
    if (gameSize === NO_CART)
      throw new Error(
        i18n.t('services:gbaCartClient.noGbaCartridgeWasDetected')
      )
    return this.streamIn(gameSize, onProgress)
  }

  /** Reads the GBA's 16 KB BIOS. No cartridge is needed. */
  async dumpBios(
    onProgress?: (done: number, total: number) => void
  ): Promise<Uint8Array> {
    await this.command(GBA_CART.CMD_DUMP_BIOS)
    await this.waitDone(30_000)
    return this.streamIn(GBA_CART.BIOS_BYTES, onProgress)
  }

  /**
   * Writes `data` over the cartridge save. Cancelling during the upload
   * leaves the cartridge untouched; once the upload completes the payload
   * commits it and cancelling is ignored, so the save is never half-written.
   */
  async restoreSave(
    data: Uint8Array,
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    await this.command(GBA_CART.CMD_RESTORE)
    await this.waitDone(60_000)
    const [gameSize, saveSize] = await this.readWords(2)
    if (gameSize === NO_CART)
      throw new Error(
        i18n.t('services:gbaCartClient.noGbaCartridgeWasDetected')
      )
    if (saveSize === 0)
      throw new Error(
        i18n.t('services:gbaCartClient.thisCartridgeHasNoSaveMemory')
      )
    if (data.length !== saveSize) {
      // Anything but M_GO sends the payload back to idle without writing.
      await this.abort()
      throw new Error(
        i18n.t(
          'services:gbaCartClient.theBackupIsBytesButTheCartridgeSaveIsBytes',
          { length: data.length, saveSize: saveSize }
        )
      )
    }
    await this.link.exchangeOne(GBA_CART.M_GO)
    await this.streamOut(data, onProgress)
    // Flash erase + program can take a minute or more.
    await this.waitDone(180_000, { ignoreAbort: true })
  }

  /** Tells a payload mid-stream to stop and return to idle. */
  async abort(): Promise<void> {
    await this.link.exchangeOne(GBA_CART.M_ABORT, { ignoreAbort: true })
  }

  private async pollReady(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const word = await this.link.exchangeOne(GBA_CART.M_POLL)
      if (word === GBA_CART.G_READY) return
      if (word === GBA_CART.G_DONE)
        await this.link.exchangeOne(GBA_CART.M_ABORT)
      await delay(25, this.signal)
    }
    throw new Error(
      i18n.t('services:gbaCartClient.theGbaSaveReaderIsNotResponding')
    )
  }

  private async command(cmd: number): Promise<void> {
    const echo = ~(GBA_CART.M_MAGIC | cmd) >>> 0
    for (let attempt = 0; attempt < 5; attempt++) {
      await this.pollReady(10_000)
      if (
        (await this.link.exchangeOne(GBA_CART.M_MAGIC | cmd)) !==
        GBA_CART.G_READY
      ) {
        continue
      }
      if ((await this.link.exchangeOne(GBA_CART.M_GO)) === echo) return
    }
    throw new Error(
      i18n.t('services:gbaCartClient.theGbaSaveReaderDidNotAcceptTheCommand')
    )
  }

  private async waitDone(
    timeoutMs: number,
    options: { ignoreAbort?: boolean } = {}
  ): Promise<void> {
    const signal = options.ignoreAbort
      ? new AbortController().signal
      : this.signal
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const word = await this.link.exchangeOne(GBA_CART.M_POLL, options)
      if (word === GBA_CART.G_DONE) {
        await this.link.exchangeOne(GBA_CART.M_CONT, options)
        return
      }
      if (word === GBA_CART.G_READY) {
        throw new Error(
          i18n.t('services:gbaCartClient.theGbaSaveReaderStoppedMidOperation')
        )
      }
      await delay(200, signal)
    }
    throw new Error(i18n.t('services:gbaCartClient.timedOutWaitingForTheGba'))
  }

  private readWords(count: number): Promise<number[]> {
    return this.link.exchange(new Array<number>(count).fill(GBA_CART.M_POLL))
  }

  /**
   * Per 256-byte section: 64 data words plus their XOR, then one exchange
   * that returns the payload's verdict and carries our M_CONT (or M_ABORT).
   */
  private async streamOut(
    data: Uint8Array,
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const sectionBytes = GBA_CART.SECTION_WORDS * 4
    let retries = 0
    for (let offset = 0; offset < data.length;) {
      const words: number[] = []
      for (let index = 0; index < GBA_CART.SECTION_WORDS; index++) {
        words.push(view.getUint32(offset + index * 4, true))
      }
      words.push(words.reduce((xor, word) => (xor ^ word) >>> 0, 0))
      // The payload only checks for M_ABORT in the verdict exchange, so a
      // cancelled upload still finishes its section and aborts there.
      await this.link.exchange(words, { ignoreAbort: true })
      if (this.signal.aborted) {
        await this.abort()
        this.signal.throwIfAborted()
      }
      const verdict = await this.link.exchangeOne(GBA_CART.M_CONT)
      if (verdict === GBA_CART.G_OKOK) {
        offset += sectionBytes
        retries = 0
        onProgress?.(offset, data.length)
      } else if (verdict !== GBA_CART.G_FAIL) {
        throw new Error(
          i18n.t('services:gbaCartClient.theGbaSaveWriterLostSyncTryAgain')
        )
      } else if (++retries > MAX_UPLOAD_RETRIES) {
        throw new Error(
          i18n.t(
            'services:gbaCartClient.theBackupKeptArrivingCorruptedCheckTheLinkCable'
          )
        )
      }
    }
  }

  private async streamIn(
    totalBytes: number,
    onProgress?: (done: number, total: number) => void
  ): Promise<Uint8Array> {
    const out = new Uint8Array(totalBytes)
    const view = new DataView(out.buffer)
    const sectionBytes = GBA_CART.SECTION_WORDS * 4
    let retries = 0
    for (let offset = 0; offset < totalBytes;) {
      if (this.signal.aborted) {
        await this.abort().catch(() => {})
        this.signal.throwIfAborted()
      }
      const words = await this.readWords(GBA_CART.SECTION_WORDS + 1)
      const checksum = words
        .slice(0, GBA_CART.SECTION_WORDS)
        .reduce((xor, word) => (xor ^ word) >>> 0, 0)
      if (checksum === words[GBA_CART.SECTION_WORDS]) {
        for (let index = 0; index < GBA_CART.SECTION_WORDS; index++) {
          view.setUint32(offset + index * 4, words[index], true)
        }
        await this.link.exchangeOne(GBA_CART.M_CONT)
        offset += sectionBytes
        retries = 0
        onProgress?.(offset, totalBytes)
      } else if (++retries > MAX_SECTION_RETRIES) {
        await this.abort()
        throw new Error(
          i18n.t(
            'services:gbaCartClient.theDataKeptArrivingCorruptedCheckTheLinkCable'
          )
        )
      } else {
        await this.link.exchangeOne(GBA_CART.M_FAIL)
      }
    }
    return out
  }
}
