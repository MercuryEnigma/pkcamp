import type { PokemonSaveAdapter } from '../pkhex'
import type { Gen3GameId } from '../saveLibrary'
import type { Esp32TradeDevice } from './esp32TradeDevice.ts'
import type { GbLinkTradeDevice } from './gbLinkTradeDevice.ts'
import type {
  CampSiteTradeDevice,
  CampSlot,
  SaveBackupTradeDevice,
  SaveSlot,
} from './localTradeDevice.ts'
import {
  campSiteTradeDevice,
  esp32TradeDevice,
  gbLinkTradeDevice,
  saveBackupTradeDevice,
} from './service.ts'
import { TradeDeviceError, type TradeDeviceEvent } from './types.ts'

/** One side of a trade. Local sides carry the selected box slot and its PK3. */
export type TradeSide =
  | {
      device: 'save-backup'
      gameId: Gen3GameId
      slot?: { box: number; index: number; pk3: Uint8Array }
    }
  | { device: 'camp-site'; slot?: { id: string; pk3: Uint8Array } }
  | { device: 'gb-link' }
  | { device: 'esp32' }

export type TradeAvailability = 'ok' | 'blocked' | 'coming-soon'

export interface TradeDevices {
  esp32: Esp32TradeDevice
  gbLink: GbLinkTradeDevice
  saveBackup: SaveBackupTradeDevice
  campSite: CampSiteTradeDevice
}

export interface RunTradeOptions {
  adapter: PokemonSaveAdapter
  /** Stored in place of the Pokémon the GBA sent, which stock GB-Link can't return. */
  loadPlaceholder(): Promise<Uint8Array>
  onEvent?(event: TradeDeviceEvent): void
  /** Defaults to the shared app devices. */
  devices?: TradeDevices
}

type LocalSide = Extract<TradeSide, { device: 'save-backup' | 'camp-site' }>

/** One slot `runTrade` overwrote, so the trade can be reverted. */
export interface TradeWrite {
  side: LocalSide
  before: Uint8Array
  after: Uint8Array
}

/** Identifies a source: `save-backup:ruby`, `camp-site`, `gb-link`, or `esp32`. */
export function tradeSideKey(side: TradeSide): string {
  return side.device === 'save-backup'
    ? `save-backup:${side.gameId}`
    : side.device
}

function isLocal(side: TradeSide): side is LocalSide {
  return side.device === 'save-backup' || side.device === 'camp-site'
}

/** Whether two sources may be paired. Ignores selections. */
export function tradeAvailability(
  left: TradeSide,
  right: TradeSide
): TradeAvailability {
  if (tradeSideKey(left) === tradeSideKey(right)) return 'blocked'
  if (isLocal(left) || isLocal(right)) return 'ok'
  if (left.device === right.device) return 'blocked'
  return 'coming-soon'
}

export async function runTrade(
  left: TradeSide,
  right: TradeSide,
  signal: AbortSignal,
  options: RunTradeOptions
): Promise<TradeWrite[]> {
  const availability = tradeAvailability(left, right)
  if (availability === 'coming-soon') {
    throw new TradeDeviceError(
      'gb-link',
      'not-implemented',
      'GBA ↔ Switch trading is coming soon.'
    )
  }
  if (availability === 'blocked') {
    throw new Error('Those two sources cannot trade with each other.')
  }
  signal.throwIfAborted()
  const devices = options.devices ?? defaultDevices()
  const [local, other] = isLocal(left)
    ? [left, right]
    : [right as LocalSide, left]
  const pk3 = selectedPk3(local)
  const write = async (received: Uint8Array): Promise<TradeWrite[]> => {
    await writeSlot(devices, options.adapter, local, pk3, received)
    return [{ side: local, before: pk3, after: received.slice() }]
  }

  if (isLocal(other)) {
    // Swap both slots. If the second write fails, put the first one back.
    const otherPk3 = selectedPk3(other)
    await write(otherPk3)
    try {
      signal.throwIfAborted()
      await writeSlot(devices, options.adapter, other, otherPk3, pk3)
    } catch (error) {
      await writeSlot(devices, options.adapter, local, otherPk3, pk3).catch(
        () => {}
      )
      throw error
    }
    return [
      { side: local, before: pk3, after: otherPk3 },
      { side: other, before: otherPk3, after: pk3 },
    ]
  }

  if (other.device === 'esp32') {
    // Switch rooms need two Pokémon; the companion is never offered.
    const companion = await companionOf(devices, options.adapter, local, pk3)
    if (!companion) {
      throw new Error('Two Pokémon are required to enter a Switch trade.')
    }
    const result = await devices.esp32.trade({
      party: [pk3, companion, null, null, null, null],
      selectedSlot: 0,
      signal,
      onEvent: options.onEvent,
    })
    const received = result.trades.findLast(
      (trade) => trade.slot === 0
    )?.received
    if (!received)
      throw new Error('The room closed without completing a trade.')
    return write(received)
  }

  const result = await devices.gbLink.trade({
    party: [pk3, null, null, null, null, null],
    selectedSlot: 0,
    signal,
    onEvent: options.onEvent,
  })
  signal.throwIfAborted()
  return write(result.trades[0]?.received ?? (await options.loadPlaceholder()))
}

/**
 * Puts back what a trade overwrote in PkCamp. Each slot must still hold what
 * the trade wrote. Pokémon on a GBA or Switch are not affected.
 */
export async function revertTrade(
  writes: readonly TradeWrite[],
  options: Pick<RunTradeOptions, 'adapter' | 'devices'>
): Promise<void> {
  const devices = options.devices ?? defaultDevices()
  for (const { side, before, after } of [...writes].reverse()) {
    await writeSlot(devices, options.adapter, side, after, before)
  }
}

function defaultDevices(): TradeDevices {
  return {
    esp32: esp32TradeDevice,
    gbLink: gbLinkTradeDevice,
    saveBackup: saveBackupTradeDevice,
    campSite: campSiteTradeDevice,
  }
}

function selectedPk3(side: LocalSide): Uint8Array {
  if (!side.slot) throw new Error('Select one Pokémon first.')
  return side.slot.pk3.slice()
}

function writeSlot(
  devices: TradeDevices,
  adapter: PokemonSaveAdapter,
  side: LocalSide,
  expected: Uint8Array,
  received: Uint8Array
): Promise<void> {
  return side.device === 'save-backup'
    ? devices.saveBackup.write(adapter, saveSlot(side), expected, received)
    : devices.campSite.write(adapter, campSlot(side), expected, received)
}

function companionOf(
  devices: TradeDevices,
  adapter: PokemonSaveAdapter,
  side: LocalSide,
  expected: Uint8Array
): Promise<Uint8Array | null> {
  return side.device === 'save-backup'
    ? devices.saveBackup.companion(adapter, saveSlot(side), expected)
    : devices.campSite.companion(adapter, campSlot(side), expected)
}

function saveSlot(
  side: Extract<TradeSide, { device: 'save-backup' }>
): SaveSlot {
  return { gameId: side.gameId, box: side.slot!.box, index: side.slot!.index }
}

function campSlot(side: Extract<TradeSide, { device: 'camp-site' }>): CampSlot {
  return { id: side.slot!.id }
}
