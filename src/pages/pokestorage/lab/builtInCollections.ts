import { i18n } from '../../../services/i18n'
import type { CollectionDefinition } from './collectionTypes'
import gen3InGameTrades from './collections/gen3-in-game-trades.json'
import gen3LivingDex from './collections/gen3-living-dex.json'
import kantoDex from './collections/kanto-dex.json'
import unownDex from './collections/unown-dex.json'
import { validateCollection } from './validateCollection'

function load(name: string, json: unknown): CollectionDefinition {
  const result = validateCollection(json)
  // Throwing at module load makes a broken built-in fail every test and build.
  if (!result.ok) {
    throw new Error(
      i18n.t('collections:builtInCollections.builtInCollectionIsInvalid', {
        name: name,
        value2: result.errors.join('\n'),
      })
    )
  }
  return result.definition
}

export const BUILT_IN_COLLECTIONS: readonly CollectionDefinition[] = [
  load('gen3-living-dex', gen3LivingDex),
  load('kanto-dex', kantoDex),
  load('unown-dex', unownDex),
  load('gen3-in-game-trades', gen3InGameTrades),
]

export function isBuiltInId(id: string): boolean {
  return BUILT_IN_COLLECTIONS.some((collection) => collection.id === id)
}
