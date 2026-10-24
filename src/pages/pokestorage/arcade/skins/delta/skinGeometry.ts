import type { GbaButton } from '../../../../../services/emulator/input'
import type {
  ControllerSkin,
  Rect,
  SkinAction,
  SkinButton,
} from './controllerSkin'

/**
 * The one transform between skin coordinates and pixels. The screen, the
 * artwork, and every touch go through it, so they cannot drift apart.
 */
export interface SkinTransform {
  scale: number
  /** Where the skin's top-left lands inside the available area. */
  offsetX: number
  offsetY: number
  width: number
  height: number
}

/** Fits the skin inside `width`×`height`, centered, keeping its aspect. */
export function fitSkin(
  skin: Pick<ControllerSkin, 'nativeWidth' | 'nativeHeight'>,
  width: number,
  height: number
): SkinTransform {
  const scale = Math.max(
    0,
    Math.min(width / skin.nativeWidth, height / skin.nativeHeight)
  )
  const fitted = {
    width: skin.nativeWidth * scale,
    height: skin.nativeHeight * scale,
  }
  return {
    scale,
    offsetX: (width - fitted.width) / 2,
    offsetY: (height - fitted.height) / 2,
    ...fitted,
  }
}

export function toPixels(transform: SkinTransform, rect: Rect): Rect {
  return {
    x: transform.offsetX + rect.x * transform.scale,
    y: transform.offsetY + rect.y * transform.scale,
    width: rect.width * transform.scale,
    height: rect.height * transform.scale,
  }
}

function contains(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x < rect.x + rect.width &&
    y >= rect.y &&
    y < rect.y + rect.height
  )
}

/** Cell (0, 1, or 2) of the pad's 3×3 grid; touches past the edge clamp. */
function cell(position: number, start: number, size: number): 0 | 1 | 2 {
  const fraction = (position - start) / size
  return fraction < 1 / 3 ? 0 : fraction >= 2 / 3 ? 2 : 1
}

export interface HeldInputs {
  buttons: GbaButton[]
  actions: SkinAction[]
}

/**
 * What a touch at (`x`, `y`) in skin coordinates. A touch
 * inside a drawn frame beats one only inside another button's extended edge;
 * among extended edges the nearest button wins.
 */
export function inputsAt(
  skin: Pick<ControllerSkin, 'buttons'>,
  x: number,
  y: number
): HeldInputs {
  let best: SkinButton | null = null
  let bestScore = Infinity
  for (const button of skin.buttons) {
    if (!contains(button.hitArea, x, y)) continue
    const inFrame = contains(button.frame, x, y)
    const centerX = button.frame.x + button.frame.width / 2
    const centerY = button.frame.y + button.frame.height / 2
    const score = (inFrame ? 0 : 1e9) + Math.hypot(x - centerX, y - centerY)
    if (score < bestScore) {
      best = button
      bestScore = score
    }
  }
  if (!best) return { buttons: [], actions: [] }
  const actions = [...best.actions]
  if (best.kind === 'button' || !best.directions) {
    return { buttons: [...best.inputs], actions }
  }

  const column = cell(x, best.frame.x, best.frame.width)
  const row = cell(y, best.frame.y, best.frame.height)
  const pressed: (GbaButton | null)[] = []
  if (row === 0) pressed.push(best.directions.up)
  if (row === 2) pressed.push(best.directions.down)
  if (column === 0) pressed.push(best.directions.left)
  if (column === 2) pressed.push(best.directions.right)
  return {
    buttons: pressed.filter((button): button is GbaButton => button !== null),
    actions,
  }
}
