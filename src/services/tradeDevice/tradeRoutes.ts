import { i18n } from '../i18n'
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
import {
  compareFirmwareVersions,
  MIN_GBA_SWITCH_FIRMWARE,
} from './gbLinkProtocol.ts'
import { TradeDeviceError, type TradeDeviceEvent } from './types.ts'

/** One side of a trade. Local sides carry the selected box slot and its PK3. */
export type TradeSide =
  | {
      device: 'save-backup'
      gameId: Gen3GameId
      slot?: { box: number; index: number; pk3: Uint8Array }
    }
  | {
      device: 'camp-site'
      slot?: { site: number; index: number; pk3: Uint8Array }
    }
  | {
      device: 'gb-link'
      /** Wireless for FireRed/LeafGreen/Emerald, cable for Ruby/Sapphire. GBA ↔ Switch only. */
      gbaGame?: 'wireless' | 'cable'
    }
  | { device: 'esp32' }

export type TradeAvailability = 'ok' | 'blocked'

export interface TradeDevices {
  esp32: Esp32TradeDevice
  gbLink: GbLinkTradeDevice
  saveBackup: SaveBackupTradeDevice
  campSite: CampSiteTradeDevice
}

export interface RunTradeOptions {
  adapter: PokemonSaveAdapter
  /** Called after received Pokémon have been persisted, even while the room is open. */
  onCommitted?(writes: TradeWrite[]): void
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
  return 'ok'
}

export async function runTrade(
  left: TradeSide,
  right: TradeSide,
  signal: AbortSignal,
  options: RunTradeOptions
): Promise<TradeWrite[]> {
  const availability = tradeAvailability(left, right)
  if (availability === 'blocked') {
    throw new Error(
      i18n.t('services:tradeRoutes.thoseTwoSourcesCannotTradeWithEachOther')
    )
  }
  signal.throwIfAborted()
  const devices = options.devices ?? defaultDevices()
  if (!isLocal(left) && !isLocal(right)) {
    return runLink(left, right, signal, devices, options.onEvent)
  }
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

  const party: (Uint8Array | null)[] = [pk3, null, null, null, null, null]
  if (other.device === 'esp32') {
    const companion = await companionOf(devices, options.adapter, local, pk3)
    if (!companion) {
      throw new Error(
        i18n.t('services:tradeRoutes.twoPokeMonAreRequiredToEnterASwitchTrade')
      )
    }
    party[1] = companion
  }

  // Capture received bytes immediately. Writes are serialized and drained even
  // if closing the room rejects the device session. An abort cannot discard a
  // Pokémon already received, or replace a slot with an invented placeholder.
  let pending = Promise.resolve()
  let expected = pk3
  let receivedCount = 0
  const writes: TradeWrite[] = []
  const receive = (received: Uint8Array) => {
    const bytes = received.slice()
    receivedCount++
    pending = pending.then(async () => {
      await writeSlot(devices, options.adapter, local, expected, bytes)
      expected = bytes
      writes[0] = { side: local, before: pk3, after: bytes.slice() }
      options.onCommitted?.([...writes])
    })
    // The session may stay open for minutes before we await this promise.
    void pending.catch(() => {})
  }
  let sessionError: unknown
  try {
    const device = other.device === 'esp32' ? devices.esp32 : devices.gbLink
    const result = await device.trade({
      party,
      selectedSlot: 0,
      signal,
      onEvent: (event) => {
        if (
          event.type === 'trade-completed' &&
          event.slot === 0 &&
          !signal.aborted
        )
          receive(event.received)
        options.onEvent?.(event)
      },
    })
    // Support devices that return their received PK3 without emitting events.
    if (receivedCount === 0 && !signal.aborted) {
      const received = result.trades.findLast(
        (trade) => trade.slot === 0
      )?.received
      if (received) receive(received)
    }
  } catch (error) {
    sessionError = error
  }
  await pending
  if (writes.length > 0) return writes
  if (sessionError) throw sessionError
  signal.throwIfAborted()
  throw new Error(
    i18n.t('services:tradeRoutes.theRoomClosedWithoutCompletingATrade')
  )
}

/** GBA ↔ Switch: a live relay. Nothing is written in PkCamp. */
async function runLink(
  left: TradeSide,
  right: TradeSide,
  signal: AbortSignal,
  devices: TradeDevices,
  onEvent: RunTradeOptions['onEvent']
): Promise<TradeWrite[]> {
  const gba = left.device === 'gb-link' ? left : right
  if (gba.device !== 'gb-link' || !gba.gbaGame) {
    throw new Error(i18n.t('services:tradeRoutes.chooseTheGameOnTheGba'))
  }
  const version = await devices.gbLink.firmwareVersion()
  if (
    !version ||
    compareFirmwareVersions(version, MIN_GBA_SWITCH_FIRMWARE) < 0
  ) {
    throw new TradeDeviceError(
      'gb-link',
      'unsupported',
      i18n.t('services:tradeRoutes.gbaSwitchNeedsGbLinkFirmwareOrNewer', {
        MIN_GBA_SWITCH_FIRMWARE: MIN_GBA_SWITCH_FIRMWARE,
      })
    )
  }
  const lease = await devices.gbLink.linkAdapter(signal)
  try {
    await devices.esp32.runLink(gba.gbaGame, lease.adapter, { signal, onEvent })
  } finally {
    await lease.release()
  }
  return []
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
  if (!side.slot)
    throw new Error(i18n.t('services:tradeRoutes.selectOnePokeMonFirst'))
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
  return { site: side.slot!.site, index: side.slot!.index }
}
