import type { PokemonSaveAdapter } from '../../../services/pkhex'
import type { Gen3GameId } from '../../../services/saveLibrary'
import type {
  Camp,
  StorageProvider,
  StoredCollectionResult,
  StoredSave,
} from '../../../services/storage'
import type { CollectionDefinition } from './collectionTypes'
import { mergeStatuses, toStoredResult } from './collectionResults'
import { evaluateCollection } from './evaluateCollection'
import type { CampScanStatus, ScannedPokemon } from './collectionTypes'
import { scanCamp } from './scanCamp'
import { scanSaves } from './scanSaves'

export interface ResearchSnapshot {
  pokemon: ScannedPokemon[]
  cabins: Awaited<ReturnType<typeof scanSaves>>['cabins']
  /** The Camp Sites' scan, or null when they were not a source. */
  camp?: CampScanStatus | null
}

/**
 * Decode each selected Cabin and, when selected, the Camp Sites once; then
 * every collection is evaluated against the same snapshot.
 */
export async function scanResearchSnapshot(
  provider: StorageProvider,
  adapter: PokemonSaveAdapter,
  targets: readonly Gen3GameId[],
  files: Partial<Record<Gen3GameId, StoredSave | null>>,
  camp: Camp | null = null
): Promise<ResearchSnapshot> {
  const saves =
    targets.length > 0
      ? await scanSaves(provider, adapter, targets, files)
      : { pokemon: [], cabins: [] }
  if (!camp) return { ...saves, camp: null }
  const scannedCamp = scanCamp(adapter, camp)
  return {
    pokemon: [...saves.pokemon, ...scannedCamp.pokemon],
    cabins: saves.cabins,
    camp: scannedCamp.status,
  }
}

export function evaluateResearchSnapshot(
  definitions: readonly CollectionDefinition[],
  snapshot: ResearchSnapshot,
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
        scannedAt,
        snapshot.camp ?? null
      ),
    ])
  )
}
