import { checkGen3Save } from '../../../services/emulator/gen3SaveSlots'

/** A complete in-game save taken from the running emulator. */
export interface SessionSave {
  bytes: Uint8Array
  saveIndex: number
}

/** What a stored or imported save means for booting the emulator. */
export type BootSave =
  | { kind: 'new-game' }
  | { kind: 'save'; bytes: Uint8Array; saveIndex: number }
  | { kind: 'invalid'; message: string }

export function equalBytes(
  left: Uint8Array | null,
  right: Uint8Array | null
): boolean {
  if (left === right) return true
  if (!left || !right || left.length !== right.length) return false
  return left.every((byte, index) => byte === right[index])
}

/**
 * Checks a save's structure before boot. A missing or blank file starts a new
 * game; a partly written or foreign-sized file is refused. This does not tell
 * the five games apart: PKHeX game matching is not loaded in the player.
 */
export function bootSaveFor(bytes: Uint8Array | null): BootSave {
  if (!bytes) return { kind: 'new-game' }
  const checked = checkGen3Save(bytes)
  switch (checked.status) {
    case 'ok':
      return { kind: 'save', bytes, saveIndex: checked.saveIndex ?? 0 }
    case 'empty':
      return { kind: 'new-game' }
    case 'incomplete':
      return {
        kind: 'invalid',
        message:
          'The newest save in this file is incomplete or damaged, so it cannot be played safely.',
      }
    case 'unsupported-size':
      return {
        kind: 'invalid',
        message: `This is not a Gen 3 battery save (${bytes.length} bytes).`,
      }
  }
}

/** The emulator's save when it holds a complete in-game save, else null. */
export function completeSnapshot(bytes: Uint8Array | null): SessionSave | null {
  if (!bytes) return null
  const checked = checkGen3Save(bytes)
  return checked.status === 'ok' && checked.saveIndex !== null
    ? { bytes, saveIndex: checked.saveIndex }
    : null
}
