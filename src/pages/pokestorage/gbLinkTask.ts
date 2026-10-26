import { i18n } from '../../services/i18n'
import type { GbaCartInfo } from '../../services/gbaSaveDump/gbaCartClient'

// Shared text and helpers for GB-Link tasks (GbLinkTaskPanel and Mystery Gifts).

export const getConnectStep = () =>
  i18n.t('common:hardware.connectGbLink')
export const getBootStep = () =>
  i18n.t('camp:gbLinkTask.insertTheCartridgeAndPowerOnWhileHoldingStartSelect')

/** The player-facing text for a GB-Link failure. */
export function gbLinkErrorMessage(
  cause: unknown,
  fallback = i18n.t('camp:gbLinkTask.theOperationFailed')
): string {
  if (cause instanceof DOMException && cause.name === 'NotFoundError') {
    return i18n.t('camp:gbLinkTask.noDeviceWasChosen')
  }
  return cause instanceof Error ? cause.message : fallback
}

/** Builds a GbLinkTaskPanel `describeError`. `retry` follows a failure. */
export function taskErrorMessage({
  fallback,
  cancelled = i18n.t('common:status.cancelled'),
  retry,
}: { fallback?: string; cancelled?: string; retry?: string } = {}) {
  return (cause: unknown, wasCancelled: boolean): string => {
    if (wasCancelled) return cancelled
    const message = gbLinkErrorMessage(cause, fallback)
    return retry
      ? i18n.t('camp:gbLinkTask.errorWithRetry', {
          message: message,
          retry: retry,
        })
      : message
  }
}

/** A failed or interrupted restore may have changed the cartridge. */
export function restoreErrorMessage(
  cause: unknown,
  cancelled: boolean,
  backupNote: string
): string {
  const reason = cancelled
    ? i18n.t('camp:gbLinkTask.theRestoreWasInterrupted')
    : gbLinkErrorMessage(cause)
  return i18n.t(
    'camp:gbLinkTask.theCartridgeMayHaveBeenChangedCheckTheCartridgeBefore',
    { reason: reason, backupNote: backupNote }
  )
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
