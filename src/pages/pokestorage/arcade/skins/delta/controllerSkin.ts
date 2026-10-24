import type { GbaButton } from '../../../../../services/emulator/input'

/**
 * The format-independent skin the Arcade renders. Nothing outside
 * `skins/delta/` parsing needs to know what a `.deltaskin` looks like.
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type SkinOrientation = 'landscape' | 'portrait'

export type DpadDirection = 'up' | 'down' | 'left' | 'right'

/** What a skin button can ask of the Arcade besides pressing a GBA button. */
export type SkinAction = 'menu' | 'speed' | 'fastForward' | 'restart' | 'guide'

export interface SkinButton {
  /** Stable within a skin, for keys and debugging. */
  id: string
  /** Where the button is drawn, in skin coordinates. */
  frame: Rect
  /** The touchable area: `frame` plus the skin's extended edges. */
  hitArea: Rect
  /** A `dpad` splits its frame into a 3×3 grid; a `button` presses `inputs`. */
  kind: 'button' | 'dpad'
  /** Held together while a `button` is touched. */
  inputs: readonly GbaButton[]
  /** Arcade actions triggered while it is touched. */
  actions: readonly SkinAction[]
  /** What each side of a `dpad` presses; null when the skin leaves it out. */
  directions: Readonly<Record<DpadDirection, GbaButton | null>> | null
}

export interface ControllerSkin {
  name: string
  identifier: string
  system: 'gba'
  orientation: SkinOrientation
  /** Skin coordinate space; every `Rect` below is relative to it. */
  nativeWidth: number
  nativeHeight: number
  /** Where the emulator display goes. */
  screen: Rect
  /** Where the artwork is drawn; a skin may cover only part of the space. */
  artFrame: Rect
  /**
   * True when the artwork is drawn over the screen (a controller laid over a
   * full-window game); false when the screen sits above the artwork.
   */
  overlay: boolean
  /** The artwork is meant to show the game through it. */
  translucent: boolean
  buttons: readonly SkinButton[]
  /** The controller artwork, a raster image. */
  background: Blob
  /** Skins can ask for their touch areas to be drawn while being authored. */
  debug: boolean
  /** Unsupported-but-ignorable details, safe to show the user. */
  warnings: readonly string[]
}
