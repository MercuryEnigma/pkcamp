import type { GbaButton } from '../../../services/emulator/input'

/** Fraction of the D-pad radius around the center that presses nothing. */
const DEAD_ZONE = 0.2
/** tan(22.5°): splits the pad into eight equal 45° sectors. */
const DIAGONAL = Math.tan(Math.PI / 8)

/**
 * The directions held by a touch at (`dx`, `dy`) from the D-pad's center,
 * with screen coordinates (down is positive). One thumb can roll between
 * cardinals and diagonals without lifting.
 */
export function dpadDirections(
  dx: number,
  dy: number,
  radius: number
): GbaButton[] {
  if (radius <= 0 || Math.hypot(dx, dy) < radius * DEAD_ZONE) return []
  const directions: GbaButton[] = []
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ay > ax * DIAGONAL) directions.push(dy < 0 ? 'up' : 'down')
  if (ax > ay * DIAGONAL) directions.push(dx < 0 ? 'left' : 'right')
  return directions
}
