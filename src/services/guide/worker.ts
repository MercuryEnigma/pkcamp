import { extractDirect } from './extractor'
import { UnsupportedRomError } from './types'
import type { ExtractOptions, PokedexDataset } from './types'

interface ExtractRequest {
  bytes: ArrayBuffer
  options: ExtractOptions
}

self.onmessage = async (event: MessageEvent<ExtractRequest>) => {
  try {
    const dataset = await extractDirect(event.data.bytes, event.data.options)
    self.postMessage({ dataset } satisfies { dataset: PokedexDataset })
  } catch (cause) {
    self.postMessage({
      error: cause instanceof Error ? cause.message : String(cause),
      unsupported: cause instanceof UnsupportedRomError,
    })
  }
}
