import type { Gen3GameId } from '../saveLibrary'
import { GB_LINK_COMMAND, GB_LINK_MODE } from '../tradeDevice/gbLinkProtocol.ts'
import type { GbLinkTransport } from '../tradeDevice/gbLinkTransport.ts'
import { GbaCartClient } from './gbaCartClient.ts'
import { delay, GbLinkWords } from './gbLinkWords.ts'
import { multiboot } from './multiboot.ts'
// Inlined (about 80 KB of base64) so starting a read needs no network
// request that could fail mid-flow.
import dumperDataUrl from './vendor/gb-cart-doctor/gba-cart-dumper_mb.gba?url&inline'

/** Game code prefixes; the fourth letter is the region. */
export const GAME_CODE_PREFIX: Record<Gen3GameId, string> = {
  ruby: 'AXV',
  sapphire: 'AXP',
  emerald: 'BPE',
  firered: 'BPR',
  leafgreen: 'BPG',
}

/** Microseconds between SPI words and bytes per word, as Cart Doctor uses. */
const TIMING_CONFIG = new Uint8Array([36, 0, 0, 4])

export interface GbaSaveOptions {
  gameId: Gen3GameId
  signal: AbortSignal
  onStatus?(message: string): void
  onProgress?(done: number, total: number): void
  /** Defaults to the vendored Cart Doctor dumper bundled with the app. */
  loadDumper?(): Promise<Uint8Array>
}

export interface WriteGbaSaveOptions extends GbaSaveOptions {
  /** The save to write over the cartridge's save. */
  save: Uint8Array
  /**
   * Keeps the save currently on the cartridge. The cartridge is only written
   * after this resolves, so a failed backup leaves it untouched.
   */
  backUpCartridgeSave(save: Uint8Array): Promise<void>
}

/** Decodes the bundled dumper from its base64 data URL. */
async function bundledDumper(): Promise<Uint8Array> {
  const base64 = dumperDataUrl.slice(dumperDataUrl.indexOf(',') + 1)
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

/**
 * Multiboots the GB-Link Cart Doctor dumper, checks the inserted cartridge is
 * `gameId`, then runs `operation`. Works with stock GB-Link firmware.
 */
async function withCartridge<T>(
  transport: GbLinkTransport,
  { gameId, signal, onStatus, loadDumper = bundledDumper }: GbaSaveOptions,
  operation: (cart: GbaCartClient) => Promise<T>
): Promise<T> {
  const dumper = await loadDumper()
  const link = new GbLinkWords(transport, signal)
  try {
    await transport.sendCommand(GB_LINK_COMMAND.cancel)
    await transport.sendCommand(GB_LINK_COMMAND.setVoltage3V3)
    await transport.sendCommand(
      GB_LINK_COMMAND.setMode,
      new Uint8Array([GB_LINK_MODE.gbLink])
    )
    await delay(100, signal)
    await transport.sendCommand(GB_LINK_COMMAND.setTimingConfig, TIMING_CONFIG)
    link.drain()

    // The GBA is already waiting: it was turned on holding START + SELECT.
    onStatus?.('Sending the save tool to the GBA…')
    await multiboot(link, dumper, signal)

    onStatus?.('Checking the cartridge…')
    const cart = new GbaCartClient(link, signal)
    await delay(800, signal)
    if (!(await cart.ping())) {
      throw new Error('The GBA save tool did not start. Try again.')
    }
    const info = await cart.readInfo()
    if (!info) throw new Error('No GBA cartridge was detected.')
    if (!info.code.startsWith(GAME_CODE_PREFIX[gameId])) {
      throw new Error(
        `This cartridge is ${info.title || info.code}, not the game for this Cabin.`
      )
    }
    return await operation(cart)
  } finally {
    link.dispose()
    await transport.sendCommand(GB_LINK_COMMAND.cancel).catch(() => {})
  }
}

/** Reads the save from the cartridge in a GBA. */
export function readGbaSave(
  transport: GbLinkTransport,
  options: GbaSaveOptions
): Promise<Uint8Array> {
  return withCartridge(transport, options, (cart) => {
    options.onStatus?.('Reading the save…')
    return cart.dumpSave(options.onProgress)
  })
}

/** Overwrites the save on the cartridge in a GBA with `options.save`. */
export function writeGbaSave(
  transport: GbLinkTransport,
  options: WriteGbaSaveOptions
): Promise<void> {
  return withCartridge(transport, options, async (cart) => {
    options.onStatus?.('Backing up the cartridge save first…')
    const cartridgeSave = await cart.dumpSave((done, total) =>
      options.onStatus?.(
        `Backing up the cartridge save first… ${Math.floor((done / total) * 100)}%`
      )
    )
    await options.backUpCartridgeSave(cartridgeSave)
    options.onStatus?.('Sending the backup…')
    await cart.restoreSave(options.save, (done, total) => {
      options.onProgress?.(done, total)
      if (done === total) {
        options.onStatus?.(
          'Writing to the cartridge. Keep the GBA on until this finishes.'
        )
      }
    })
  })
}
