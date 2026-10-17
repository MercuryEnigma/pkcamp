import type { GbaCartInfo } from '../../services/gbaSaveDump/gbaCartClient'

// Shared text and helpers for GB-Link tasks (GbLinkTaskPanel and Mystery Gifts).

export const CONNECT_STEP = 'Connect the GB-Link to this computer and your GBA.'
export const BOOT_STEP =
  'Insert the cartridge and power on while holding START + SELECT.'

/** The player-facing text for a GB-Link failure. */
export function gbLinkErrorMessage(
  cause: unknown,
  fallback = 'The operation failed.'
): string {
  if (cause instanceof DOMException && cause.name === 'NotFoundError') {
    return 'No device was chosen.'
  }
  return cause instanceof Error ? cause.message : fallback
}

/** Builds a GbLinkTaskPanel `describeError`. `retry` follows a failure. */
export function taskErrorMessage({
  fallback,
  cancelled = 'Cancelled.',
  retry,
}: { fallback?: string; cancelled?: string; retry?: string } = {}) {
  return (cause: unknown, wasCancelled: boolean): string => {
    if (wasCancelled) return cancelled
    const message = gbLinkErrorMessage(cause, fallback)
    return retry ? `${message} ${retry}` : message
  }
}

/** A failed or interrupted restore may have changed the cartridge. */
export function restoreErrorMessage(
  cause: unknown,
  cancelled: boolean,
  backupNote: string
): string {
  const reason = cancelled
    ? 'The restore was interrupted.'
    : gbLinkErrorMessage(cause)
  return `${reason} The cartridge may have been changed. ${backupNote} Check the cartridge before retrying.`
}

/** Runs a cartridge read, keeping the cartridge it reports for file naming. */
export async function readFromCartridge<
  T extends {
    onCartridge(info: GbaCartInfo): void
  },
>(
  task: T,
  read: (task: T) => Promise<Uint8Array>
): Promise<{ bytes: Uint8Array; cartridge?: GbaCartInfo }> {
  let cartridge: GbaCartInfo | undefined
  const bytes = await read({
    ...task,
    onCartridge: (info: GbaCartInfo) => {
      cartridge = info
      task.onCartridge(info)
    },
  })
  return { bytes, cartridge }
}
