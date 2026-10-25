import { i18n } from '../../../services/i18n'
import { BUILT_IN_COLLECTIONS } from './builtInCollections'
import type { CollectionDefinition } from './collectionTypes'

/** Localize built-in copy for display only; uploaded content and serialized data stay intact. */
export function collectionDisplay(
  definition: CollectionDefinition
): CollectionDefinition {
  if (!BUILT_IN_COLLECTIONS.includes(definition)) return definition
  switch (definition.id) {
    case 'gen3-in-game-trades':
      return {
        ...definition,
        name: i18n.t('collections:builtIn.gen3-in-game-trades.name'),
        metadata: {
          ...definition.metadata,
          description: i18n.t(
            'collections:builtIn.gen3-in-game-trades.metadata.description'
          ),
        },
        groups: definition.groups.map((group) => {
          switch (group.id) {
            case 'ruby-sapphire':
              return {
                ...group,
                name: i18n.t(
                  'collections:builtIn.gen3-in-game-trades.groups.ruby-sapphire.name'
                ),
              }
            case 'emerald':
              return {
                ...group,
                name: i18n.t(
                  'collections:builtIn.gen3-in-game-trades.groups.emerald.name'
                ),
              }
            case 'firered-leafgreen':
              return {
                ...group,
                name: i18n.t(
                  'collections:builtIn.gen3-in-game-trades.groups.firered-leafgreen.name'
                ),
                details: i18n.t(
                  'collections:builtIn.gen3-in-game-trades.groups.firered-leafgreen.details'
                ),
              }
            case 'firered':
              return {
                ...group,
                name: i18n.t(
                  'collections:builtIn.gen3-in-game-trades.groups.firered.name'
                ),
              }
            case 'leafgreen':
              return {
                ...group,
                name: i18n.t(
                  'collections:builtIn.gen3-in-game-trades.groups.leafgreen.name'
                ),
              }
            default:
              return group
          }
        }),
      }
    case 'gen3-living-dex':
      return {
        ...definition,
        name: i18n.t('collections:builtIn.gen3-living-dex.name'),
        metadata: {
          ...definition.metadata,
          description: i18n.t(
            'collections:builtIn.gen3-living-dex.metadata.description'
          ),
        },
        groups: definition.groups.map((group) => {
          switch (group.id) {
            case 'kanto':
              return {
                ...group,
                name: i18n.t(
                  'collections:builtIn.gen3-living-dex.groups.kanto.name'
                ),
              }
            case 'johto':
              return {
                ...group,
                name: i18n.t(
                  'collections:builtIn.gen3-living-dex.groups.johto.name'
                ),
              }
            case 'hoenn':
              return {
                ...group,
                name: i18n.t(
                  'collections:builtIn.gen3-living-dex.groups.hoenn.name'
                ),
              }
            default:
              return group
          }
        }),
      }
    case 'kanto-dex':
      return {
        ...definition,
        name: i18n.t('collections:builtIn.kanto-dex.name'),
        metadata: {
          ...definition.metadata,
          description: i18n.t(
            'collections:builtIn.kanto-dex.metadata.description'
          ),
        },
        groups: definition.groups.map((group) => {
          switch (group.id) {
            case 'kanto':
              return {
                ...group,
                name: i18n.t('collections:builtIn.kanto-dex.groups.kanto.name'),
              }
            default:
              return group
          }
        }),
      }
    case 'unown-dex':
      return {
        ...definition,
        name: i18n.t('collections:builtIn.unown-dex.name'),
        metadata: {
          ...definition.metadata,
          description: i18n.t(
            'collections:builtIn.unown-dex.metadata.description'
          ),
        },
        groups: definition.groups.map((group) => {
          switch (group.id) {
            case 'unown':
              return {
                ...group,
                name: i18n.t('collections:builtIn.unown-dex.groups.unown.name'),
              }
            default:
              return group
          }
        }),
      }
    default:
      return definition
  }
}
