import { describe, expect, it, vi } from 'vitest'
import { GB_LINK_COMMAND, GB_LINK_MODE } from '../tradeDevice/gbLinkProtocol.ts'
import type { GbLinkTransport } from '../tradeDevice/gbLinkTransport.ts'
import { GBA_CART as C } from './gbaCartClient.ts'
import { encryptWord } from './multiboot.ts'
import {
  readGbaBios,
  readGbaRom,
  readGbaSave,
  writeGbaSave,
} from './readGbaSave.ts'

// The payload model mirrors Cart Doctor's web/test/gba_protocol_sim.mjs, which
// in turn mirrors the dumper's main.c state machine.

const BUSY = 0xffffffff
type Step = number | { busy: number }

interface Cart {
  code: string
  title: string
  save: Uint8Array | null
  rom?: Uint8Array
}

const bios = new Uint8Array(0x4000).map((_, index) => (index * 13 + 99) & 0xff)

function wordsOf(bytes: Uint8Array): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return Array.from({ length: bytes.length / 4 }, (_, index) =>
    view.getUint32(index * 4, true)
  )
}

function* doneGate(): Generator<Step, boolean, number> {
  for (;;) {
    const rx = yield C.G_DONE
    if (rx === C.M_CONT) return true
    if (rx === C.M_ABORT) return false
  }
}

function* streamToMaster(
  words: number[],
  log: string[]
): Generator<Step, void, number> {
  for (let offset = 0; offset < words.length;) {
    let xor = 0
    for (let index = 0; index < 64; index++) {
      xor = (xor ^ words[offset + index]) >>> 0
      if ((yield words[offset + index]) === C.M_ABORT) {
        log.push('abort')
        return
      }
    }
    yield xor
    const verdict = yield 0
    if (verdict === C.M_CONT) offset += 64
    else if (verdict === C.M_FAIL) log.push('retry')
    else return
  }
}

/** Returns the staged bytes, or null when the host aborted the upload. */
function* streamFromMaster(
  totalBytes: number,
  log: string[]
): Generator<Step, Uint8Array | null, number> {
  const out = new Uint8Array(totalBytes)
  const view = new DataView(out.buffer)
  for (let offset = 0; offset < totalBytes;) {
    const words: number[] = []
    let xor = 0
    for (let index = 0; index < 64; index++) {
      const word = (yield 0) >>> 0
      words.push(word)
      xor = (xor ^ word) >>> 0
    }
    const ok = (yield 0) >>> 0 === xor
    if ((yield ok ? C.G_OKOK : C.G_FAIL) !== C.M_CONT) {
      log.push('abort')
      return null
    }
    if (ok) {
      words.forEach((word, index) =>
        view.setUint32(offset + index * 4, word, true)
      )
      offset += 0x100
    }
  }
  return out
}

function* payload(
  cart: Cart | null,
  log: string[]
): Generator<Step, never, number> {
  for (;;) {
    let rx = yield C.G_READY
    if ((rx & 0xffff0000) >>> 0 !== C.M_MAGIC) continue
    const cmd = rx & 0xffff
    rx = yield ~(C.M_MAGIC | cmd) >>> 0
    if (rx !== C.M_GO) continue
    if (cmd === C.CMD_DUMP_BIOS) {
      yield { busy: 2 }
      if (!(yield* doneGate())) continue
      yield* streamToMaster(wordsOf(bios), log)
      continue
    }
    yield { busy: 2 }
    if (!(yield* doneGate())) continue
    yield cart ? (cart.rom?.length ?? 0x800000) : BUSY
    // A ROM dump reports only the game size.
    if (cmd !== C.CMD_DUMP_ROM) yield cart?.save?.length ?? 0
    if (!cart) continue
    if (cmd === C.CMD_INFO) {
      const header = new Uint8Array(0xc0)
      for (const [text, at] of [
        [cart.title, 0xa0],
        [cart.code, 0xac],
      ] as const) {
        for (let index = 0; index < text.length; index++) {
          header[at + index] = text.charCodeAt(index)
        }
      }
      for (const word of wordsOf(header)) yield word
    } else if (cmd === C.CMD_DUMP_ROM && cart.rom) {
      yield* streamToMaster(wordsOf(cart.rom), log)
    } else if (cmd === C.CMD_DUMP_SAVE && cart.save) {
      yield { busy: 2 }
      if (!(yield* doneGate())) continue
      yield* streamToMaster(wordsOf(cart.save), log)
    } else if (cmd === C.CMD_RESTORE && cart.save) {
      if ((yield 0) !== C.M_GO) continue
      const staged = yield* streamFromMaster(cart.save.length, log)
      if (staged === null) continue
      yield { busy: 2 }
      cart.save = staged
      log.push('committed')
      yield* doneGate()
    }
  }
}

/** The GBA BIOS multiboot receiver, reduced to what the host checks. */
class FakeBios {
  done = false
  received: number[] = []
  private seed = 0
  private crc = 0xc387
  private offset = 0xc0
  private length = 0
  private handshake = false
  private stage: 'wait' | 'length' | 'body' | 'ack' | 'crc' = 'wait'

  exchange(word: number): number {
    switch (this.stage) {
      case 'wait':
        if (word === 0x6202) return 0x72020000
        if (word === 0x63d1) {
          this.handshake = true
          this.seed = (0xffff00d1 | (0x5a << 8)) >>> 0
          return 0x735a0000
        }
        if (this.handshake && (word & 0xff00) === 0x6400) this.stage = 'length'
        return 0
      case 'length':
        this.length = word * 4 + 0x190
        this.stage = 'body'
        return 0x00330000
      case 'body': {
        // Undo the host's encryption using the same keystream.
        const next = encryptWord(0, this.offset, this.seed, 0)
        const plain = (word ^ next.word) >>> 0
        this.seed = next.seed
        this.crc = encryptWord(plain, 0, 0, this.crc).crc
        this.received.push(plain)
        const reply = (this.offset & 0xffff) << 16
        this.offset += 4
        if (this.offset >= this.length) this.stage = 'ack'
        return reply >>> 0
      }
      case 'ack':
        if (word === 0x0066) this.stage = 'crc'
        return word === 0x0065 ? 0x00750000 : 0
      case 'crc':
        this.done = true
        return 0
    }
  }
}

class FakeGbLink implements GbLinkTransport {
  readonly attached = true
  readonly kind = 'webusb' as const
  commands: number[][] = []
  log: string[] = []
  bios = new FakeBios()
  private program: Generator<Step, never, number>
  private pending: IteratorResult<Step>
  private busyLeft = 0
  private exchanges = 0
  private readonly listeners = new Set<(payload: Uint8Array) => void>()

  private readonly corruptAt: number

  constructor(cart: Cart | null, corruptAt = -1) {
    this.corruptAt = corruptAt
    this.program = payload(cart, this.log)
    this.pending = this.program.next()
  }

  async open() {}
  async close() {}
  onStatus() {
    return () => {}
  }
  onFrame() {
    return () => {}
  }
  onData(listener: (payload: Uint8Array) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  async sendCommand(command: number, args = new Uint8Array(0)) {
    this.commands.push([command, ...args])
  }
  async sendData(tx: Uint8Array) {
    expect(tx.length).toBeLessThanOrEqual(64)
    const view = new DataView(tx.buffer, tx.byteOffset, tx.byteLength)
    const rx = new Uint8Array(tx.length)
    const rxView = new DataView(rx.buffer)
    for (let at = 0; at < tx.length; at += 4) {
      const word = view.getUint32(at)
      let reply = this.bios.done
        ? this.payloadExchange(word)
        : this.bios.exchange(word)
      if (this.bios.done && ++this.exchanges === this.corruptAt) reply ^= 1
      rxView.setUint32(at, reply >>> 0)
    }
    queueMicrotask(() => this.listeners.forEach((listener) => listener(rx)))
  }

  private payloadExchange(word: number): number {
    const step = this.pending.value
    if (this.busyLeft === 0 && typeof step === 'object')
      this.busyLeft = step.busy
    if (this.busyLeft > 0) {
      if (--this.busyLeft === 0) this.pending = this.program.next(0)
      return BUSY
    }
    const armed = (step as number) >>> 0
    this.pending = this.program.next(word >>> 0)
    return armed
  }
}

const rom = new Uint8Array(0x200).map((_, index) => (index * 7 + 3) & 0xff)
const save = new Uint8Array(0x20000).map((_, index) => (index * 31 + 5) & 0xff)
const ruby: Cart = { code: 'AXVE', title: 'POKEMON RUBY', save }

function read(link: FakeGbLink, signal = new AbortController().signal) {
  return readGbaSave(link, {
    gameId: 'ruby',
    signal,
    loadDumper: async () => rom,
  })
}

describe('readGbaSave', () => {
  it('multiboots the dumper and reads the cartridge save', async () => {
    const link = new FakeGbLink(ruby)
    const progress: number[] = []
    const bytes = await readGbaSave(link, {
      gameId: 'ruby',
      signal: new AbortController().signal,
      loadDumper: async () => rom,
      onProgress: (done) => progress.push(done),
    })

    expect(bytes).toEqual(save)
    expect(link.bios.received).toEqual(wordsOf(rom).slice(0xc0 / 4))
    expect(progress.at(-1)).toBe(save.length)
    expect(link.commands).toEqual([
      [GB_LINK_COMMAND.cancel],
      [GB_LINK_COMMAND.setVoltage3V3],
      [GB_LINK_COMMAND.setMode, GB_LINK_MODE.gbLink],
      [GB_LINK_COMMAND.setTimingConfig, 36, 0, 0, 4],
      [GB_LINK_COMMAND.cancel],
    ])
  })

  it('retries a section that fails its checksum', async () => {
    const link = new FakeGbLink(ruby, 5000)
    expect(await read(link)).toEqual(save)
    expect(link.log).toContain('retry')
  })

  it('rejects a cartridge for a different game', async () => {
    const link = new FakeGbLink({
      ...ruby,
      code: 'BPEE',
      title: 'POKEMON EMER',
    })
    await expect(read(link)).rejects.toThrow('POKEMON EMER')
    expect(link.commands.at(-1)).toEqual([GB_LINK_COMMAND.cancel])
  })

  it('reports a missing cartridge', async () => {
    await expect(read(new FakeGbLink(null))).rejects.toThrow('No GBA cartridge')
  })

  it('tells the dumper to stop when cancelled mid-read', async () => {
    const link = new FakeGbLink(ruby)
    const controller = new AbortController()
    const reading = readGbaSave(link, {
      gameId: 'ruby',
      signal: controller.signal,
      loadDumper: async () => rom,
      onProgress: (done) => {
        if (done >= 0x1000) controller.abort()
      },
    })
    await expect(reading).rejects.toThrow()
    expect(link.log).toContain('abort')
    expect(link.commands.at(-1)).toEqual([GB_LINK_COMMAND.cancel])
  })
})

describe('game detection', () => {
  it('reads any cartridge when no game is expected and reports its header', async () => {
    const emerald: Cart = { code: 'BPEE', title: 'POKEMON EMER', save }
    const seen: string[] = []
    const bytes = await readGbaSave(new FakeGbLink(emerald), {
      signal: new AbortController().signal,
      loadDumper: async () => rom,
      onCartridge: (info) => seen.push(info.code),
    })
    expect(bytes).toEqual(save)
    expect(seen).toEqual(['BPEE'])
  })
})

describe('readGbaRom', () => {
  const cartRom = new Uint8Array(0x1000).map(
    (_, index) => (index * 17 + 1) & 0xff
  )

  it('reads the whole cartridge ROM', async () => {
    const progress: number[] = []
    const bytes = await readGbaRom(new FakeGbLink({ ...ruby, rom: cartRom }), {
      signal: new AbortController().signal,
      loadDumper: async () => rom,
      onProgress: (done) => progress.push(done),
    })
    expect(bytes).toEqual(cartRom)
    expect(progress.at(-1)).toBe(cartRom.length)
  })

  it('refuses a cartridge for a different expected game', async () => {
    const link = new FakeGbLink({ ...ruby, rom: cartRom })
    await expect(
      readGbaRom(link, {
        gameId: 'emerald',
        signal: new AbortController().signal,
        loadDumper: async () => rom,
      })
    ).rejects.toThrow('POKEMON RUBY')
  })
})

describe('readGbaBios', () => {
  it('reads the 16 KB BIOS without a cartridge', async () => {
    const bytes = await readGbaBios(new FakeGbLink(null), {
      signal: new AbortController().signal,
      loadDumper: async () => rom,
    })
    expect(bytes).toEqual(bios)
  })
})

describe('writeGbaSave', () => {
  const backup = save.map((byte) => byte ^ 0xff)
  const cartFor = (): Cart => ({ ...ruby, save: save.slice() })

  function write(
    link: FakeGbLink,
    data: Uint8Array,
    backUpCartridgeSave: (save: Uint8Array) => Promise<void> = async () => {}
  ) {
    return writeGbaSave(link, {
      gameId: 'ruby',
      save: data,
      signal: new AbortController().signal,
      loadDumper: async () => rom,
      backUpCartridgeSave,
    })
  }

  it('overwrites the cartridge save', async () => {
    const cart = cartFor()
    const link = new FakeGbLink(cart)
    await write(link, backup)
    expect(cart.save).toEqual(backup)
    expect(link.commands.at(-1)).toEqual([GB_LINK_COMMAND.cancel])
  })

  it('stores the cartridge save before writing over it', async () => {
    const cart = cartFor()
    const stored: Uint8Array[] = []
    let cartridgeWhenStored: Uint8Array | null = null
    await write(new FakeGbLink(cart), backup, async (cartridgeSave) => {
      stored.push(cartridgeSave)
      cartridgeWhenStored = cart.save
    })
    expect(stored).toEqual([save])
    // The cartridge still held its own save while the backup was stored.
    expect(cartridgeWhenStored).toEqual(save)
    expect(cart.save).toEqual(backup)
  })

  it('leaves the cartridge untouched when the backup cannot be stored', async () => {
    const cart = cartFor()
    const link = new FakeGbLink(cart)
    await expect(
      write(link, backup, async () => {
        throw new Error('Dropbox could not be reached.')
      })
    ).rejects.toThrow('Dropbox could not be reached.')
    expect(cart.save).toEqual(save)
    expect(link.log).not.toContain('committed')
  })

  it('refuses a backup whose size differs from the cartridge save', async () => {
    const cart = cartFor()
    await expect(
      write(new FakeGbLink(cart), backup.subarray(0, 0x10000))
    ).rejects.toThrow('65536 bytes')
    expect(cart.save).toEqual(save)
  })

  it('leaves the cartridge untouched when cancelled during upload', async () => {
    const cart = cartFor()
    const link = new FakeGbLink(cart)
    const controller = new AbortController()
    const writing = writeGbaSave(link, {
      gameId: 'ruby',
      save: backup,
      signal: controller.signal,
      loadDumper: async () => rom,
      backUpCartridgeSave: async () => {},
      onProgress: (done) => {
        if (done >= 0x1000) controller.abort()
      },
    })
    await expect(writing).rejects.toThrow()
    expect(link.log).toContain('abort')
    expect(link.log).not.toContain('committed')
    expect(cart.save).toEqual(save)
  })

  it('rejects a cartridge for a different game without writing', async () => {
    const cart = { ...cartFor(), code: 'BPRE', title: 'POKEMON FIRE' }
    const backUp = vi.fn(async () => {})
    await expect(write(new FakeGbLink(cart), backup, backUp)).rejects.toThrow(
      'POKEMON FIRE'
    )
    expect(backUp).not.toHaveBeenCalled()
    expect(cart.save).toEqual(save)
  })

  it('accepts any listed game and backs up under the cartridge header game', async () => {
    const cart = { ...cartFor(), code: 'AXPE', title: 'POKEMON SAPP' }
    const backUp = vi.fn(async () => {})
    await writeGbaSave(new FakeGbLink(cart), {
      gameId: ['ruby', 'sapphire'],
      save: backup,
      signal: new AbortController().signal,
      loadDumper: async () => rom,
      backUpCartridgeSave: backUp,
    })
    expect(backUp).toHaveBeenCalledWith(save, 'sapphire')
    expect(cart.save).toEqual(backup)
  })
})
