import type { ExtractOptions, PokedexDataset } from './types'
import { UnsupportedRomError } from './types'
import { readGen3RomHeader } from './rom'

export async function digest(bytes: Uint8Array): Promise<string> {
  const result = await crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(bytes).buffer
  )
  return [...new Uint8Array(result)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

const utf8 = new TextEncoder()

/**
 * Extract ROM reference data. The parser only accepts validated known table
 * layouts; unsupported layouts fail explicitly rather than producing a
 * misleading empty or vanilla dataset.
 */
export async function extractDirect(
  rom: Uint8Array | ArrayBuffer | File,
  options: ExtractOptions = {}
): Promise<PokedexDataset> {
  const bytes =
    rom instanceof Uint8Array
      ? rom
      : rom instanceof ArrayBuffer
        ? new Uint8Array(rom)
        : new Uint8Array(await rom.arrayBuffer())
  const header = readGen3RomHeader(bytes)
  if (!header)
    throw new UnsupportedRomError(
      'The ROM header is not a supported Gen III Pokémon game.'
    )
  const romSha256 = await digest(bytes)
  const metadataFingerprint = options.metadata
    ? await digest(utf8.encode(options.metadata))
    : null

  // Table readers are registered per verified revision. Never infer data
  // from a header alone: hacks frequently retain the original game code.
  const parser = await import('./vanilla')
  return parser.extractKnownRom(
    bytes,
    header,
    romSha256,
    metadataFingerprint,
    options
  )
}

export async function extract(
  rom: Uint8Array | ArrayBuffer | File,
  options: ExtractOptions = {},
  signal?: AbortSignal
): Promise<PokedexDataset> {
  signal?.throwIfAborted()
  const bytes =
    rom instanceof Uint8Array
      ? rom.slice()
      : rom instanceof ArrayBuffer
        ? new Uint8Array(rom.slice(0))
        : new Uint8Array(await rom.arrayBuffer())
  if (typeof Worker === 'undefined' || typeof document === 'undefined') {
    const dataset = await extractDirect(bytes, options)
    signal?.throwIfAborted()
    return dataset
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../../../arcade/guide-worker.ts', import.meta.url),
      { type: 'module' }
    )
    const cleanup = () => {
      worker.terminate()
      signal?.removeEventListener('abort', abort)
    }
    const abort = () => {
      cleanup()
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) {
      abort()
      return
    }
    worker.onmessage = (
      event: MessageEvent<{
        dataset?: PokedexDataset
        error?: string
        unsupported?: boolean
      }>
    ) => {
      cleanup()
      if (event.data.dataset) resolve(event.data.dataset)
      else if (event.data.unsupported)
        reject(new UnsupportedRomError(event.data.error))
      else reject(new Error(event.data.error ?? 'Pokédex extraction failed.'))
    }
    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || 'Pokédex worker failed.'))
    }
    worker.postMessage({ bytes: bytes.buffer, options }, [bytes.buffer])
  })
}
