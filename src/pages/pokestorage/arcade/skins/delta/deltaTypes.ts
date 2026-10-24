/** The `info.json` shape from https://noah978.gitbook.io/delta-docs/skins. */

export const DELTA_GBA_IDENTIFIER = 'com.rileytestut.delta.game.gba'

export interface DeltaRect {
  x: number
  y: number
  width: number
  height: number
}

export interface DeltaEdges {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

export interface DeltaAssets {
  resizable?: string
  small?: string
  medium?: string
  large?: string
}

export interface DeltaItem {
  /** Button names, or a map of D-pad side to button name. */
  inputs?: readonly string[] | Readonly<Record<string, string>>
  frame?: DeltaRect
  extendedEdges?: DeltaEdges
  thumbstick?: unknown
}

export interface DeltaScreen {
  inputFrame?: DeltaRect
  outputFrame?: DeltaRect
}

export interface DeltaRepresentation {
  assets?: DeltaAssets
  items?: readonly DeltaItem[]
  screens?: readonly DeltaScreen[]
  mappingSize?: { width?: number; height?: number }
  extendedEdges?: DeltaEdges
  translucent?: boolean
}

export type DeltaDevice = 'iphone' | 'ipad'
export type DeltaDisplayType = 'standard' | 'edgeToEdge' | 'splitView'

export interface DeltaInfo {
  name?: string
  identifier?: string
  gameTypeIdentifier: string
  debug?: boolean
  representations: Partial<
    Record<
      DeltaDevice,
      Partial<
        Record<
          DeltaDisplayType,
          Partial<Record<'portrait' | 'landscape', DeltaRepresentation>>
        >
      >
    >
  >
}
