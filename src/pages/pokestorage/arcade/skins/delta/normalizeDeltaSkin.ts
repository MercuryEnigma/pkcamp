import { i18n } from '../../../../../services/i18n'
import type { GbaButton } from '../../../../../services/emulator/input'
import type {
  ControllerSkin,
  DpadDirection,
  Rect,
  SkinAction,
  SkinButton,
  SkinOrientation,
} from './controllerSkin'
import type {
  DeltaAssets,
  DeltaDevice,
  DeltaDisplayType,
  DeltaEdges,
  DeltaItem,
  DeltaRect,
  DeltaRepresentation,
} from './deltaTypes'
import {
  DeltaSkinError,
  rasterName,
  readDeltaSkinArchive,
  type DeltaSkinArchive,
  type DeltaSkinSource,
} from './parseDeltaSkin'

export type SkinDevice = 'phone' | 'desktop'

export interface NormalizeOptions {
  orientation?: SkinOrientation
  /** Phones favor iPhone layouts; larger windows favor iPad ones. */
  device?: SkinDevice
}

/**
 * Which layouts suit a desktop window, best first. Split-view layouts only
 * cover part of the screen, so they are never chosen.
 */
const LAYOUT_PREFERENCE: Readonly<
  Record<SkinDevice, readonly (readonly [DeltaDevice, DeltaDisplayType])[]>
> = {
  desktop: [
    ['ipad', 'standard'],
    ['iphone', 'edgeToEdge'],
    ['iphone', 'standard'],
  ],
  phone: [
    ['iphone', 'edgeToEdge'],
    ['iphone', 'standard'],
    ['ipad', 'standard'],
  ],
}

const GBA_INPUTS: Readonly<Record<string, GbaButton>> = {
  a: 'a',
  b: 'b',
  l: 'l',
  r: 'r',
  start: 'start',
  select: 'select',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
}

/** Delta's special inputs that the Arcade has an equivalent for. */
const ARCADE_ACTIONS: Readonly<Record<string, SkinAction>> = {
  menu: 'menu',
  toggleFastForward: 'speed',
  fastForward: 'fastForward',
  quickLoad: 'restart',
  quickSave: 'guide',
}

const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

const DIRECTIONS: readonly DpadDirection[] = ['up', 'down', 'left', 'right']

/** Reads a `.deltaskin` and builds the skin to render. */
export async function loadDeltaSkin(
  source: DeltaSkinSource,
  options: NormalizeOptions = {}
): Promise<ControllerSkin> {
  return normalizeDeltaSkin(await readDeltaSkinArchive(source), options)
}

export function normalizeDeltaSkin(
  archive: DeltaSkinArchive,
  {
    orientation: wanted = 'landscape',
    device = 'desktop',
  }: NormalizeOptions = {}
): ControllerSkin {
  const { info } = archive
  const { representation, orientation } = pickRepresentation(
    archive,
    wanted,
    device
  )

  const nativeWidth = representation.mappingSize?.width
  const nativeHeight = representation.mappingSize?.height
  if (!isPositive(nativeWidth) || !isPositive(nativeHeight)) {
    throw new DeltaSkinError(
      'invalid-layout',
      i18n.t('arcade:normalizeDeltaSkin.theLayoutHasNoValidMappingsize', {
        orientation: orientation,
      })
    )
  }

  const placement = placeScreen(
    representation,
    orientation,
    nativeWidth,
    nativeHeight
  )

  const warnings: string[] = []
  const buttons = (representation.items ?? []).flatMap((item, index) => {
    const button = normalizeItem(item, index, representation, warnings)
    return button ? [shiftButton(button, placement.artFrame.y)] : []
  })

  return {
    name: info.name?.trim() || i18n.t('arcade:normalizeDeltaSkin.deltaSkin'),
    identifier: info.identifier ?? '',
    system: 'gba',
    orientation,
    nativeWidth: placement.nativeWidth,
    nativeHeight: placement.nativeHeight,
    screen: placement.screen,
    artFrame: placement.artFrame,
    overlay: placement.overlay,
    translucent: representation.translucent === true,
    buttons,
    background: pickBackground(archive, representation.assets),
    debug: info.debug === true,
    warnings,
  }
}

interface Placement {
  nativeWidth: number
  nativeHeight: number
  screen: Rect
  artFrame: Rect
  overlay: boolean
}

const GBA_ASPECT = 3 / 2

/**
 * Where the game screen goes. A skin that names its screen is taken at its
 * word. One that does not leaves it to the player, as Delta does: held upright
 * the screen sits above the controller artwork, and held sideways the
 * artwork is laid over a game that fills the window.
 */
function placeScreen(
  representation: DeltaRepresentation,
  orientation: SkinOrientation,
  width: number,
  height: number
): Placement {
  const named = representation.screens
  if (named && named.length > 0) {
    const screen = rectOf(named[0]?.outputFrame)
    if (!screen) {
      throw new DeltaSkinError(
        'missing-screen',
        i18n.t('arcade:normalizeDeltaSkin.theLayoutDoesNotPlaceTheGameScreen', {
          orientation: orientation,
        })
      )
    }
    return {
      nativeWidth: width,
      nativeHeight: height,
      screen,
      artFrame: { x: 0, y: 0, width, height },
      overlay: false,
    }
  }
  if (orientation === 'portrait') {
    const screenHeight = width / GBA_ASPECT
    return {
      nativeWidth: width,
      nativeHeight: screenHeight + height,
      screen: { x: 0, y: 0, width, height: screenHeight },
      artFrame: { x: 0, y: screenHeight, width, height },
      overlay: false,
    }
  }
  const fitted = Math.min(width, height * GBA_ASPECT)
  return {
    nativeWidth: width,
    nativeHeight: height,
    screen: {
      x: (width - fitted) / 2,
      y: (height - fitted / GBA_ASPECT) / 2,
      width: fitted,
      height: fitted / GBA_ASPECT,
    },
    artFrame: { x: 0, y: 0, width, height },
    overlay: true,
  }
}

function shiftButton(button: SkinButton, dy: number): SkinButton {
  if (dy === 0) return button
  const shift = (rect: Rect): Rect => ({ ...rect, y: rect.y + dy })
  return {
    ...button,
    frame: shift(button.frame),
    hitArea: shift(button.hitArea),
  }
}

/**
 * The best layout for the window: the wanted orientation first, then the
 * other one, since a landscape-only skin still beats nothing on a phone held
 * upright. Within an orientation, layouts follow the device's preference.
 */
function pickRepresentation(
  { info }: DeltaSkinArchive,
  orientation: SkinOrientation,
  device: SkinDevice
): { representation: DeltaRepresentation; orientation: SkinOrientation } {
  const other: SkinOrientation =
    orientation === 'landscape' ? 'portrait' : 'landscape'
  for (const candidate of [orientation, other] as const) {
    for (const [deviceKey, display] of LAYOUT_PREFERENCE[device]) {
      const found = info.representations[deviceKey]?.[display]?.[candidate]
      if (found && typeof found === 'object') {
        return { representation: found, orientation: candidate }
      }
    }
  }
  throw new DeltaSkinError(
    'missing-orientation',
    i18n.t('arcade:normalizeDeltaSkin.theSkinHasNoLayoutThisPlayerCanUse')
  )
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function rectOf(frame: DeltaRect | undefined): Rect | null {
  if (!frame || typeof frame !== 'object') return null
  const { x, y, width, height } = frame
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !isPositive(width) ||
    !isPositive(height)
  ) {
    return null
  }
  return { x, y, width, height }
}

function edge(edges: DeltaEdges | undefined, side: keyof DeltaEdges): number {
  const value = edges?.[side]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeItem(
  item: DeltaItem,
  index: number,
  representation: DeltaRepresentation,
  warnings: string[]
): SkinButton | null {
  const frame = rectOf(item.frame)
  const id = `item-${index}`
  if (!frame || !item.inputs) {
    warnings.push(
      i18n.t('arcade:normalizeDeltaSkin.ignoredItemItHasNoUsableFrame', {
        value1: index + 1,
      })
    )
    return null
  }
  const edges = item.extendedEdges ?? representation.extendedEdges
  const hitArea: Rect = {
    x: frame.x - edge(edges, 'left'),
    y: frame.y - edge(edges, 'top'),
    width: frame.width + edge(edges, 'left') + edge(edges, 'right'),
    height: frame.height + edge(edges, 'top') + edge(edges, 'bottom'),
  }

  if (Array.isArray(item.inputs)) {
    const inputs: GbaButton[] = []
    const actions: SkinAction[] = []
    for (const name of item.inputs as readonly string[]) {
      if (GBA_INPUTS[name]) inputs.push(GBA_INPUTS[name])
      else if (ARCADE_ACTIONS[name]) actions.push(ARCADE_ACTIONS[name])
      else
        warnings.push(
          i18n.t('arcade:normalizeDeltaSkin.ignoredUnsupportedInput', {
            name: name,
          })
        )
    }
    if (inputs.length === 0 && actions.length === 0) return null
    return {
      id,
      kind: 'button',
      frame,
      hitArea,
      inputs,
      actions,
      directions: null,
    }
  }

  const map = item.inputs as Readonly<Record<string, string>>
  if (DIRECTIONS.some((side) => side in map)) {
    const directions = Object.fromEntries(
      DIRECTIONS.map((side) => [side, GBA_INPUTS[map[side] ?? ''] ?? null])
    ) as Record<DpadDirection, GbaButton | null>
    return {
      id,
      kind: 'dpad',
      frame,
      hitArea,
      inputs: [],
      actions: [],
      directions,
    }
  }
  warnings.push(
    i18n.t('arcade:normalizeDeltaSkin.ignoredItemUnsupportedControls', {
      value1: index + 1,
    })
  )
  return null
}

function pickBackground(
  { files }: DeltaSkinArchive,
  assets: DeltaAssets | undefined
): Blob {
  // Images draw as-is; a PDF counts only once it has been rasterized.
  const named = [
    assets?.large,
    assets?.medium,
    assets?.small,
    assets?.resizable,
  ].filter((name): name is string => typeof name === 'string')
  if (named.length === 0) {
    throw new DeltaSkinError(
      'missing-asset',
      i18n.t('arcade:normalizeDeltaSkin.theLayoutHasNoArtwork')
    )
  }
  let sawPdf = false
  for (const name of named) {
    const extension = name.split('.').pop()?.toLowerCase() ?? ''
    if (extension === 'pdf') {
      const raster = files.get(rasterName(name))
      if (raster) return new Blob([raster as BlobPart], { type: 'image/png' })
      sawPdf = true
      continue
    }
    const type = IMAGE_TYPES[extension]
    const bytes = files.get(name)
    if (type && bytes) return new Blob([bytes as BlobPart], { type })
  }
  throw sawPdf
    ? new DeltaSkinError(
        'unsupported-asset',
        i18n.t('arcade:normalizeDeltaSkin.thisSkinSPdfArtworkCouldNotBeDrawn')
      )
    : new DeltaSkinError(
        'missing-asset',
        i18n.t('arcade:normalizeDeltaSkin.theSkinSArtworkFileIsMissing')
      )
}
