/**
 * Structural check of a raw Gen 3 battery save, used to tell whether the
 * newest in-game save is fully written before Arcade commits it.
 *
 * A Gen 3 save holds two alternating slots of 14 sectors. Each sector ends in
 * a footer: section ID (u16 @ 0xFF4), checksum (u16 @ 0xFF6), signature
 * (u32 @ 0xFF8), and save counter (u32 @ 0xFFC). The game writes a save one
 * sector at a time into the older slot, so a snapshot taken mid-save can hold
 * a slot whose sectors mix the new counter with stale ones. PKHeX picks the
 * newest slot from section IDs and one counter alone, so it would load such a
 * slot without complaint; this check refuses it.
 */

const SECTOR_SIZE = 0x1000
const SECTOR_USED = 0xf80
const SECTIONS_PER_SLOT = 14
const SLOT_SIZE = SECTIONS_PER_SLOT * SECTOR_SIZE
const SIGNATURE = 0x08012025

const FULL_SIZE = 0x20000
/** Some emulators size Gen 3 flash at 64 KiB; only slot 0 exists then. */
/** Emulator RTC footer bounds, as accepted by PKHeX's `SaveHandlerFooterRTC`. */
const MAX_FOOTER = 0x30

const OFS_ID = 0xff4
const OFS_CHECKSUM = 0xff6
const OFS_SIGNATURE = 0xff8
const OFS_COUNTER = 0xffc

export type Gen3SaveStatus =
  /** The newest save is complete; it is safe to commit. */
  | 'ok'
  /** No signed sector exists yet, e.g. a new game before its first save. */
  | 'empty'
  /** The newest save is partly written or damaged; do not commit it. */
  | 'incomplete'
  /** Not a 128 KiB (plus optional footer) Gen 3 save. */
  | 'unsupported-size'

export interface Gen3SlotCheck {
  slot: 0 | 1
  /** Highest save counter among this slot's signed sectors, or null if none. */
  saveIndex: number | null
  /** Section IDs with no signed sector in this slot. */
  missingSections: number[]
  /** Section IDs whose newest sector carries an older counter than `saveIndex`. */
  staleSections: number[]
  /** Section IDs whose sector at `saveIndex` fails its checksum. */
  badChecksums: number[]
  complete: boolean
}

export interface Gen3SaveCheck {
  status: Gen3SaveStatus
  /** Slot holding the newest save, or null when no slot has one. */
  newestSlot: 0 | 1 | null
  /** Counter of the newest save; compare with a baseline before committing. */
  saveIndex: number | null
  /** Bytes after the save image, e.g. mGBA's 16-byte RTC footer. */
  footerBytes: number
  slots: Gen3SlotCheck[]
}

/** Reports whether the newest save in raw Gen 3 `.sav` bytes is complete. */
export function checkGen3Save(bytes: Uint8Array): Gen3SaveCheck {
  const footerBytes = bytes.length - FULL_SIZE
  if (footerBytes < 0 || footerBytes > MAX_FOOTER) {
    return {
      status: 'unsupported-size',
      newestSlot: null,
      saveIndex: null,
      footerBytes: 0,
      slots: [],
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const slots = Array.from({ length: 2 }, (_, slot) =>
    checkSlot(view, slot as 0 | 1)
  )

  const newest = slots.reduce<Gen3SlotCheck | null>(
    (best, slot) =>
      slot.saveIndex !== null &&
      (best === null || slot.saveIndex > (best.saveIndex ?? -1))
        ? slot
        : best,
    null
  )
  if (!newest) {
    return {
      status: 'empty',
      newestSlot: null,
      saveIndex: null,
      footerBytes,
      slots,
    }
  }
  return {
    status: newest.complete ? 'ok' : 'incomplete',
    newestSlot: newest.slot,
    saveIndex: newest.saveIndex,
    footerBytes,
    slots,
  }
}

function checkSlot(view: DataView, slot: 0 | 1): Gen3SlotCheck {
  // The newest signed sector seen for each section ID.
  const newestBySection = new Map<number, { offset: number; counter: number }>()
  const start = slot * SLOT_SIZE

  for (let offset = start; offset < start + SLOT_SIZE; offset += SECTOR_SIZE) {
    if (view.getUint32(offset + OFS_SIGNATURE, true) !== SIGNATURE) continue
    const id = view.getUint16(offset + OFS_ID, true)
    if (id >= SECTIONS_PER_SLOT) continue
    const counter = view.getUint32(offset + OFS_COUNTER, true)
    const seen = newestBySection.get(id)
    if (!seen || counter > seen.counter)
      newestBySection.set(id, { offset, counter })
  }

  const counters = [...newestBySection.values()].map(({ counter }) => counter)
  const saveIndex = counters.length ? Math.max(...counters) : null
  const missingSections: number[] = []
  const staleSections: number[] = []
  const badChecksums: number[] = []

  for (let id = 0; id < SECTIONS_PER_SLOT; id++) {
    const sector = newestBySection.get(id)
    if (!sector) missingSections.push(id)
    else if (sector.counter !== saveIndex) staleSections.push(id)
    else if (
      sectorChecksum(view, sector.offset) !==
      view.getUint16(sector.offset + OFS_CHECKSUM, true)
    ) {
      badChecksums.push(id)
    }
  }

  return {
    slot,
    saveIndex,
    missingSections,
    staleSections,
    badChecksums,
    complete:
      saveIndex !== null &&
      missingSections.length === 0 &&
      staleSections.length === 0 &&
      badChecksums.length === 0,
  }
}

/** PKHeX's `Checksums.CheckSum32` over a sector's used bytes. */
export function sectorChecksum(view: DataView, offset: number): number {
  let sum = 0
  for (let i = 0; i < SECTOR_USED; i += 4) {
    sum = (sum + view.getUint32(offset + i, true)) >>> 0
  }
  return (sum + (sum >>> 16)) & 0xffff
}
