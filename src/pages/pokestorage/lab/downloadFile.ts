import type { GbaCartInfo } from '../../../services/gbaSaveDump/gbaCartClient'
import { gen3GameIdFromCode } from '../../../services/saveLibrary'
import { GAME_LABEL } from '../gameDisplay'

/** Saves `bytes` to the player's computer through the browser's download. */
export function downloadFile(bytes: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer]))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** A readable file name for a cartridge, such as `Pokemon Emerald (BPEE).sav`. */
export function cartridgeFileName(
  info: GbaCartInfo,
  extension: string
): string {
  const gameId = gen3GameIdFromCode(info.code)
  const name = gameId ? `Pokemon ${GAME_LABEL[gameId]}` : info.title || 'GBA'
  const safe = `${name} (${info.code})`.replace(/[\\/:*?"<>|]/g, '_')
  return `${safe}.${extension}`
}
