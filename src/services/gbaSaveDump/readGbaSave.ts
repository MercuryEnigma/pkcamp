import type { Gen3GameId } from '../saveLibrary'
import { GB_LINK_COMMAND, GB_LINK_MODE } from '../tradeDevice/gbLinkProtocol.ts'
import type { GbLinkTransport } from '../tradeDevice/gbLinkTransport.ts'
import { GbaCartClient } from './gbaCartClient.ts'
import { delay, GbLinkWords } from './gbLinkWords.ts'
import { multiboot } from './multiboot.ts'
import dumperUrl from './vendor/gb-cart-doctor/gba-cart-dumper_mb.gba?url'

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
  /** Defaults to fetching the vendored Cart Doctor dumper. */
  loadDumper?(): Promise<Uint8Array>
}

export interface WriteGbaSaveOptions extends GbaSaveOptions {
  /** The save to write over the cartridge's save. */
  save: Uint8Array
}

async function fetchDumper(): Promise<Uint8Array> {
  const response = await fetch(dumperUrl)
  if (!response.ok) throw new Error('Could not load the GBA save tool.')
  return new Uint8Array(await response.arrayBuffer())
}

/**
 * Multiboots the GB-Link Cart Doctor dumper, checks the inserted cartridge is
 * `gameId`, then runs `operation`. Works with stock GB-Link firmware.
 */
async function withCartridge<T>(
  transport: GbLinkTransport,
  { gameId, signal, onStatus, loadDumper = fetchDumper }: GbaSaveOptions,
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

    onStatus?.(
      'Turn on the GBA with the cartridge inserted while holding START + SELECT.'
    )
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
