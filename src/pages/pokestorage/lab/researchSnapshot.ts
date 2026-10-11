import type { PokemonSaveAdapter } from '../../../services/pkhex'
import type { Gen3GameId } from '../../../services/saveLibrary'
import type {
  StorageProvider,
  StoredCollectionResult,
  StoredSave,
} from '../../../services/storage'
import type { CollectionDefinition } from './collectionTypes'
import { mergeStatuses, toStoredResult } from './collectionResults'
import { evaluateCollection } from './evaluateCollection'
import { scanSaves } from './scanSaves'

/** Decode each selected Cabin once, then evaluate every collection against it. */
export async function scanResearchSnapshot(
  provider: StorageProvider,
  adapter: PokemonSaveAdapter,
  targets: readonly Gen3GameId[],
  files: Partial<Record<Gen3GameId, StoredSave | null>>
) {
  return scanSaves(provider, adapter, targets, files)
}

export function evaluateResearchSnapshot(
  definitions: readonly CollectionDefinition[],
  snapshot: Awaited<ReturnType<typeof scanResearchSnapshot>>,
  history: Record<string, StoredCollectionResult | null>,
  scannedAt: string
): Record<string, StoredCollectionResult> {
  return Object.fromEntries(
    definitions.map((definition) => [
      definition.id,
      toStoredResult(
        definition,
        mergeStatuses(
          definition,
          evaluateCollection(definition, snapshot.pokemon),
          history[definition.id] ?? null,
          scannedAt
        ),
        snapshot.cabins,
        scannedAt
      ),
    ])
  )
}
