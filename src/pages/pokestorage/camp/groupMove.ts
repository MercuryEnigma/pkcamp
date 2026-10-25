import { i18n } from '../../../services/i18n'
export const COLUMNS = 6
export const ROWS = 5
export const GRID_SIZE = COLUMNS * ROWS

/** The slots of the rectangle whose opposite corners are `first` and `second`. */
export function groupCells(first: number, second: number): number[] {
  const top = Math.min(
    Math.floor(first / COLUMNS),
    Math.floor(second / COLUMNS)
  )
  const bottom = Math.max(
    Math.floor(first / COLUMNS),
    Math.floor(second / COLUMNS)
  )
  const left = Math.min(first % COLUMNS, second % COLUMNS)
  const right = Math.max(first % COLUMNS, second % COLUMNS)
  const cells: number[] = []
  for (let row = top; row <= bottom; row++)
    for (let column = left; column <= right; column++)
      cells.push(row * COLUMNS + column)
  return cells
}

export interface GroupPlan {
  pairs: { from: number; to: number }[]
}

/**
 * Where each source slot lands when the group's top-left cell is dropped on
 * `destination`. Fails when the group would leave the grid.
 */
export function planGroupMove(
  sources: readonly number[],
  destination: number
): GroupPlan | { error: string } {
  const sourceTop = Math.min(
    ...sources.map((slot) => Math.floor(slot / COLUMNS))
  )
  const sourceLeft = Math.min(...sources.map((slot) => slot % COLUMNS))
  const destinationTop = Math.floor(destination / COLUMNS)
  const destinationLeft = destination % COLUMNS
  const pairs: GroupPlan['pairs'] = []
  for (const slot of sources) {
    const row = destinationTop + Math.floor(slot / COLUMNS) - sourceTop
    const column = destinationLeft + (slot % COLUMNS) - sourceLeft
    if (column >= COLUMNS || row >= ROWS)
      return {
        error: i18n.t(
          'camp:groupMove.thatGroupWouldExtendBeyondTheDestination'
        ),
      }
    pairs.push({ from: slot, to: row * COLUMNS + column })
  }
  return { pairs }
}
