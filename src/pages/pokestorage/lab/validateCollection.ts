import { i18n } from '../../../services/i18n'
import type {
  CollectionDefinition,
  ConstraintField,
  Scalar,
} from './collectionTypes'
import { FIELD_MATCHERS, SUPPORTED_FIELDS } from './evaluateCollection'

export { SUPPORTED_FIELDS }

export type ValidationResult =
  | { ok: true; definition: CollectionDefinition }
  | { ok: false; errors: string[] }

const TOP_LEVEL_KEYS = [
  '$schema',
  'schemaVersion',
  'id',
  'name',
  'metadata',
  'groups',
  'pokemon',
]
const OPTIONAL_METADATA_KEYS = [
  'author',
  'description',
  'details',
  'source',
  'updated',
]
const SUPPORTED_SCHEMA_VERSION = '1'
// The id becomes the file name pokedex/{id}.json.
const ID_PATTERN = /^[A-Za-z0-9-]+$/
const MAX_ID_LENGTH = 64

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isScalar(value: unknown): value is Scalar {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  )
}

function validateEntry(
  entryId: string,
  entry: unknown,
  errors: string[]
): void {
  const path = `pokemon[${JSON.stringify(entryId)}]`
  if (!isRecord(entry)) {
    errors.push(
      i18n.t('collections:validateCollection.mustBeAnObject', { path: path })
    )
    return
  }
  const keys = Object.keys(entry)
  if (keys.length === 0) {
    errors.push(
      i18n.t(
        'collections:validateCollection.needsAtLeastOneConstraintItWouldMatchAnything',
        { path: path }
      )
    )
    return
  }
  for (const key of keys) {
    const fieldPath = `${path}.${key}`
    if (!Object.hasOwn(FIELD_MATCHERS, key)) {
      errors.push(
        i18n.t('collections:validateCollection.isNotSupportedYet', {
          fieldPath: fieldPath,
          key: key,
        })
      )
      continue
    }
    const matcher = FIELD_MATCHERS[key as ConstraintField]
    const value = entry[key]
    if (matcher.list && !Array.isArray(value)) {
      errors.push(
        i18n.t(
          'collections:validateCollection.mustBeANonEmptyArrayOfUniqueStrings',
          { fieldPath: fieldPath }
        )
      )
      continue
    }
    if (Array.isArray(value) && value.length === 0) {
      errors.push(
        i18n.t('collections:validateCollection.mustNotBeAnEmptyArray', {
          fieldPath: fieldPath,
        })
      )
      continue
    }
    const values: unknown[] = Array.isArray(value) ? value : [value]
    const seen = new Set<string>()
    values.forEach((item, index) => {
      const itemPath = Array.isArray(value)
        ? `${fieldPath}[${index}]`
        : fieldPath
      if (!isScalar(item)) {
        errors.push(
          i18n.t(
            'collections:validateCollection.mustBeAStringNumberOrBoolean',
            { itemPath: itemPath }
          )
        )
        return
      }
      const problem = matcher.check(item)
      if (problem)
        errors.push(
          i18n.t('collections:validateCollection.constraintProblem', {
            itemPath: itemPath,
            problem: problem,
          })
        )
      const identity = `${typeof item}:${item}`
      if (seen.has(identity))
        errors.push(
          i18n.t('collections:validateCollection.duplicateValue', {
            itemPath: itemPath,
          })
        )
      seen.add(identity)
    })
  }
}

function validateGroups(
  groups: unknown,
  entryIds: ReadonlySet<string>,
  errors: string[]
): void {
  if (!Array.isArray(groups)) {
    errors.push(i18n.t('collections:validateCollection.groupsMustBeAnArray'))
    return
  }
  const groupIds = new Set<string>()
  groups.forEach((group: unknown, index) => {
    const path = `groups[${index}]`
    if (!isRecord(group)) {
      errors.push(
        i18n.t('collections:validateCollection.mustBeAnObject', { path: path })
      )
      return
    }
    if (typeof group.id !== 'string' || group.id === '') {
      errors.push(
        i18n.t('collections:validateCollection.idMustBeANonEmptyString', {
          path: path,
        })
      )
    } else if (groupIds.has(group.id)) {
      errors.push(
        i18n.t('collections:validateCollection.idDuplicateGroupId', {
          path: path,
          id: group.id,
        })
      )
    } else {
      groupIds.add(group.id)
    }
    if (typeof group.name !== 'string' || group.name === '') {
      errors.push(
        i18n.t('collections:validateCollection.nameMustBeANonEmptyString', {
          path: path,
        })
      )
    }
    for (const key of ['description', 'details']) {
      if (group[key] !== undefined && typeof group[key] !== 'string') {
        errors.push(
          i18n.t('collections:validateCollection.mustBeAString', {
            path: path,
            key: key,
          })
        )
      }
    }
    if (!Array.isArray(group.pokemon)) {
      errors.push(
        i18n.t(
          'collections:validateCollection.pokemonMustBeAnArrayOfEntryIds',
          { path: path }
        )
      )
      return
    }
    const seen = new Set<string>()
    group.pokemon.forEach((id: unknown, position) => {
      const idPath = `${path}.pokemon[${position}]`
      if (typeof id !== 'string') {
        errors.push(
          i18n.t('collections:validateCollection.mustBeAString2', {
            idPath: idPath,
          })
        )
        return
      }
      if (seen.has(id))
        errors.push(
          i18n.t('collections:validateCollection.duplicateEntryId', {
            idPath: idPath,
            id: id,
          })
        )
      seen.add(id)
      if (!entryIds.has(id)) {
        errors.push(
          i18n.t('collections:validateCollection.isNotAKeyOfPokemon', {
            idPath: idPath,
            id: id,
          })
        )
      }
    })
  })
}

function validateMetadata(metadata: unknown, errors: string[]): void {
  if (!isRecord(metadata)) {
    errors.push(i18n.t('collections:validateCollection.metadataMustBeAnObject'))
    return
  }
  for (const key of Object.keys(metadata)) {
    if (key !== 'version' && !OPTIONAL_METADATA_KEYS.includes(key)) {
      errors.push(
        i18n.t('collections:validateCollection.metadataUnknownField', {
          key: key,
        })
      )
    }
  }
  if (typeof metadata.version !== 'string' || metadata.version === '') {
    errors.push(
      i18n.t(
        'collections:validateCollection.metadataVersionMustBeANonEmptyString'
      )
    )
  }
  for (const key of OPTIONAL_METADATA_KEYS) {
    if (metadata[key] !== undefined && typeof metadata[key] !== 'string') {
      errors.push(
        i18n.t('collections:validateCollection.metadataMustBeAString', {
          key: key,
        })
      )
    }
  }
}

/** Checks an unknown JSON value against the collection format. */
export function validateCollection(json: unknown): ValidationResult {
  const errors: string[] = []
  if (!isRecord(json)) {
    return {
      ok: false,
      errors: [i18n.t('collections:validateCollection.rootMustBeAJsonObject')],
    }
  }

  for (const key of Object.keys(json)) {
    if (!TOP_LEVEL_KEYS.includes(key))
      errors.push(
        i18n.t('collections:validateCollection.unknownField', { key: key })
      )
  }
  if (json.$schema !== undefined && typeof json.$schema !== 'string') {
    errors.push(i18n.t('collections:validateCollection.schemaMustBeAString'))
  }

  if (typeof json.schemaVersion !== 'string') {
    errors.push(
      i18n.t('collections:validateCollection.schemaversionMustBeTheString1')
    )
  } else if (json.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push(
      i18n.t(
        'collections:validateCollection.schemaversionIsNotSupportedThisVersionOfPkcampReads',
        {
          schemaVersion: json.schemaVersion,
          SUPPORTED_SCHEMA_VERSION: SUPPORTED_SCHEMA_VERSION,
        }
      )
    )
  }

  if (typeof json.id !== 'string') {
    errors.push(i18n.t('collections:validateCollection.idMustBeAString'))
  } else if (!ID_PATTERN.test(json.id) || json.id.length > MAX_ID_LENGTH) {
    errors.push(
      i18n.t(
        'collections:validateCollection.idMustBe1LettersDigitsOrHyphensItBecomes',
        { MAX_ID_LENGTH: MAX_ID_LENGTH }
      )
    )
  }
  if (typeof json.name !== 'string' || json.name.trim() === '') {
    errors.push(
      i18n.t('collections:validateCollection.nameMustBeANonEmptyString2')
    )
  }

  validateMetadata(json.metadata, errors)

  const entryIds = new Set<string>()
  if (!isRecord(json.pokemon)) {
    errors.push(
      i18n.t(
        'collections:validateCollection.pokemonMustBeAnObjectKeyedByEntryId'
      )
    )
  } else {
    for (const [entryId, entry] of Object.entries(json.pokemon)) {
      entryIds.add(entryId)
      validateEntry(entryId, entry, errors)
    }
  }
  validateGroups(json.groups, entryIds, errors)

  if (errors.length > 0) return { ok: false, errors }
  const definition = { ...json }
  delete definition.$schema
  return { ok: true, definition: definition as unknown as CollectionDefinition }
}
