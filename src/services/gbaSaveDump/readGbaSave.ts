import { i18n } from '../i18n'
import { gen3GameIdFromCode, type Gen3GameId } from '../saveLibrary'
import { GB_LINK_COMMAND, GB_LINK_MODE } from '../tradeDevice/gbLinkProtocol.ts'
import type { GbLinkTransport } from '../tradeDevice/gbLinkTransport.ts'
import { GbaCartClient, type GbaCartInfo } from './gbaCartClient.ts'
import { delay, GbLinkWords } from './gbLinkWords.ts'
import { multiboot } from './multiboot.ts'
// Inlined (about 80 KB of base64) so starting a read needs no network
// request that could fail mid-flow.
import dumperDataUrl from './vendor/gb-cart-doctor/gba-cart-dumper_mb.gba?url&inline'

/** Microseconds between SPI words and bytes per word, as Cart Doctor uses. */
const TIMING_CONFIG = new Uint8Array([36, 0, 0, 4])

export interface GbaDumperOptions {
  signal: AbortSignal
  onStatus?(message: string): void
  onProgress?(done: number, total: number): void
  /** Defaults to the vendored Cart Doctor dumper bundled with the app. */
  loadDumper?(): Promise<Uint8Array>
}

export interface GbaSaveOptions extends GbaDumperOptions {
  /**
   * When set, a cartridge for any other game is refused before reading. A
   * list accepts any of its games (Ruby and Sapphire saves are interchangeable).
   */
  gameId?: Gen3GameId | readonly Gen3GameId[]
  /** Called with the inserted cartridge's header once it has been read. */
  onCartridge?(info: GbaCartInfo): void
}

export interface WriteGbaSaveOptions extends GbaSaveOptions {
  /** The game (or games) `save` belongs to; the cartridge must match. */
  gameId: Gen3GameId | readonly Gen3GameId[]
  /** The save to write over the cartridge's save. */
  save: Uint8Array
  /**
   * Keeps the save currently on the cartridge. The cartridge is only written
   * after this resolves, so a failed backup leaves it untouched. `gameId` is
   * the cartridge's game, read from its header.
   */
  backUpCartridgeSave(save: Uint8Array, gameId: Gen3GameId): Promise<void>
}

/** Decodes the bundled dumper from its base64 data URL. */
async function bundledDumper(): Promise<Uint8Array> {
  const base64 = dumperDataUrl.slice(dumperDataUrl.indexOf(',') + 1)
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

/**
 * Multiboots the GB-Link Cart Doctor dumper onto the waiting GBA, then runs
 * `operation`. Works with stock GB-Link firmware.
 */
async function withDumper<T>(
  transport: GbLinkTransport,
  { signal, onStatus, loadDumper = bundledDumper }: GbaDumperOptions,
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
    onStatus?.(i18n.t('services:readGbaSave.sendingTheCartridgeToolToTheGba'))
    await multiboot(link, dumper, signal)

    const cart = new GbaCartClient(link, signal)
    await delay(800, signal)
    if (!(await cart.ping())) {
      throw new Error(
        i18n.t('services:readGbaSave.theGbaCartridgeToolDidNotStartTryAgain')
      )
    }
    return await operation(cart)
  } finally {
    link.dispose()
    await transport.sendCommand(GB_LINK_COMMAND.cancel).catch(() => {})
  }
}

/**
 * Like `withDumper`, but first reads the cartridge header, reports it, and
 * refuses a cartridge for a game other than `gameId` when one is given.
 * `operation` receives the cartridge's game, or null for a non-Gen 3 game.
 */
function withCartridge<T>(
  transport: GbLinkTransport,
  options: GbaSaveOptions,
  operation: (cart: GbaCartClient, game: Gen3GameId | null) => Promise<T>
): Promise<T> {
  return withDumper(transport, options, async (cart) => {
    options.onStatus?.(i18n.t('services:readGbaSave.checkingTheCartridge'))
    const info = await cart.readInfo()
    if (!info)
      throw new Error(i18n.t('services:gbaCartClient.noGbaCartridgeWasDetected'))
    options.onCartridge?.(info)
    const game = gen3GameIdFromCode(info.code)
    const { gameId } = options
    const expected = typeof gameId === 'string' ? [gameId] : gameId
    if (expected && !(game && expected.includes(game))) {
      throw new Error(
        i18n.t(
          'services:readGbaSave.thisCartridgeIsWhichDoesnTMatchTheExpectedGame',
          { value1: info.title || info.code }
        )
      )
    }
    return operation(cart, game)
  })
}

/** Reads the save from the cartridge in a GBA. */
export function readGbaSave(
  transport: GbLinkTransport,
  options: GbaSaveOptions
): Promise<Uint8Array> {
  return withCartridge(transport, options, (cart) => {
    options.onStatus?.(i18n.t('services:readGbaSave.readingTheSave'))
    return cart.dumpSave(options.onProgress)
  })
}

/** Overwrites the save on the cartridge in a GBA with `options.save`. */
export function writeGbaSave(
  transport: GbLinkTransport,
  options: WriteGbaSaveOptions
): Promise<void> {
  return withCartridge(transport, options, async (cart, game) => {
    // withCartridge has refused any cartridge outside the required `gameId`.
    if (!game)
      throw new Error(
        i18n.t('services:readGbaSave.thisCartridgeIsNotASupportedGame')
      )
    options.onStatus?.(
      i18n.t('services:readGbaSave.backingUpTheCartridgeSaveFirst')
    )
    const cartridgeSave = await cart.dumpSave((done, total) =>
      options.onStatus?.(
        i18n.t('services:readGbaSave.backingUpTheCartridgeSaveFirst2', {
          value1: Math.floor((done / total) * 100),
        })
      )
    )
    await options.backUpCartridgeSave(cartridgeSave, game)
    options.onStatus?.(i18n.t('services:readGbaSave.sendingTheBackup'))
    await cart.restoreSave(options.save, (done, total) => {
      options.onProgress?.(done, total)
      if (done === total) {
        options.onStatus?.(
          i18n.t(
            'services:readGbaSave.writingToTheCartridgeKeepTheGbaOnUntilThis'
          )
        )
      }
    })
  })
}

/** Reads the whole ROM of the cartridge in a GBA. */
export function readGbaRom(
  transport: GbLinkTransport,
  options: GbaSaveOptions
): Promise<Uint8Array> {
  return withCartridge(transport, options, (cart) => {
    options.onStatus?.(i18n.t('services:readGbaSave.readingTheRom'))
    return cart.dumpRom(options.onProgress)
  })
}

/** Reads the 16 KB BIOS of a GBA. No cartridge is needed. */
export function readGbaBios(
  transport: GbLinkTransport,
  options: GbaDumperOptions
): Promise<Uint8Array> {
  return withDumper(transport, options, (cart) => {
    options.onStatus?.(i18n.t('services:readGbaSave.readingTheBios'))
    return cart.dumpBios(options.onProgress)
  })
}
