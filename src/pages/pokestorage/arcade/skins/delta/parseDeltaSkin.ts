import { i18n } from '../../../../../services/i18n'
import { unzipSync } from 'fflate'
import { DELTA_GBA_IDENTIFIER, type DeltaInfo } from './deltaTypes'

export type DeltaSkinErrorCode =
  | 'not-an-archive'
  | 'missing-info'
  | 'invalid-info'
  | 'unsupported-system'
  | 'missing-orientation'
  | 'missing-screen'
  | 'invalid-layout'
  | 'missing-asset'
  | 'unsupported-asset'

/** A skin problem worth telling the user about, not a bug. */
export class DeltaSkinError extends Error {
  readonly code: DeltaSkinErrorCode
  constructor(code: DeltaSkinErrorCode, message: string) {
    super(message)
    this.name = 'DeltaSkinError'
    this.code = code
  }
}

/**
 * Where a rasterized copy of a PDF is kept in an archive's files, so
 * normalizing never needs to render anything itself.
 */
export const rasterName = (pdfName: string) => `${pdfName}.raster.png`

export interface DeltaSkinArchive {
  info: DeltaInfo
  /** Archive contents by path relative to the folder holding `info.json`. */
  files: ReadonlyMap<string, Uint8Array>
}

/** Skins are a few images; refuse anything that unpacks far past that. */
const MAX_ENTRY_BYTES = 64 * 1024 * 1024

export type DeltaSkinSource = Blob | ArrayBuffer | Uint8Array

async function bytesOf(source: DeltaSkinSource): Promise<Uint8Array> {
  if (source instanceof Uint8Array) return source
  if (source instanceof ArrayBuffer) return new Uint8Array(source)
  return new Uint8Array(await source.arrayBuffer())
}

/** Unzips a `.deltaskin` in memory and validates its `info.json`. */
export async function readDeltaSkinArchive(
  source: DeltaSkinSource
): Promise<DeltaSkinArchive> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(await bytesOf(source), {
      filter: (file) =>
        file.originalSize <= MAX_ENTRY_BYTES && !file.name.endsWith('/'),
    })
  } catch {
    throw new DeltaSkinError(
      'not-an-archive',
      i18n.t('arcade:parseDeltaSkin.thisIsNotAValidDeltaskinFile')
    )
  }

  const names = Object.keys(entries).filter(
    (name) => !name.startsWith('__MACOSX/')
  )
  // Delta wants info.json at the root; tolerate one wrapping folder, which is
  // what zipping a skin's folder by hand produces.
  const infoPath =
    names.find((name) => name === 'info.json') ??
    names.find((name) => /^[^/]+\/info\.json$/.test(name))
  if (!infoPath) {
    throw new DeltaSkinError(
      'missing-info',
      i18n.t('arcade:parseDeltaSkin.theSkinHasNoInfoJson')
    )
  }
  const prefix = infoPath.slice(0, infoPath.length - 'info.json'.length)

  let raw: unknown
  try {
    raw = JSON.parse(new TextDecoder().decode(entries[infoPath]))
  } catch {
    throw new DeltaSkinError(
      'invalid-info',
      i18n.t('arcade:parseDeltaSkin.theSkinSInfoJsonIsBroken')
    )
  }
  const info = validateInfo(raw)

  const files = new Map<string, Uint8Array>()
  for (const name of names) {
    if (name.startsWith(prefix))
      files.set(name.slice(prefix.length), entries[name])
  }
  return { info, files }
}

function validateInfo(raw: unknown): DeltaInfo {
  if (
    !raw ||
    typeof raw !== 'object' ||
    typeof (raw as DeltaInfo).gameTypeIdentifier !== 'string'
  ) {
    throw new DeltaSkinError(
      'invalid-info',
      i18n.t('arcade:parseDeltaSkin.theSkinSInfoJsonDoesNotSayWhichSystem')
    )
  }
  const info = raw as DeltaInfo
  if (info.gameTypeIdentifier !== DELTA_GBA_IDENTIFIER) {
    throw new DeltaSkinError(
      'unsupported-system',
      i18n.t('arcade:parseDeltaSkin.thisSkinIsNotForGameBoyAdvance')
    )
  }
  if (!info.representations || typeof info.representations !== 'object') {
    throw new DeltaSkinError(
      'invalid-info',
      i18n.t('arcade:parseDeltaSkin.theSkinSInfoJsonHasNoLayouts')
    )
  }
  return info
}
