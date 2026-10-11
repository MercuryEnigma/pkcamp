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
    errors.push(`${path}: must be an object`)
    return
  }
  const keys = Object.keys(entry)
  if (keys.length === 0) {
    errors.push(
      `${path}: needs at least one constraint (it would match anything)`
    )
    return
  }
  for (const key of keys) {
    const fieldPath = `${path}.${key}`
    if (!Object.hasOwn(FIELD_MATCHERS, key)) {
      errors.push(`${fieldPath}: "${key}" is not supported yet`)
      continue
    }
    const matcher = FIELD_MATCHERS[key as ConstraintField]
    const value = entry[key]
    if (matcher.list && !Array.isArray(value)) {
      errors.push(`${fieldPath}: must be a non-empty array of unique strings`)
      continue
    }
    if (Array.isArray(value) && value.length === 0) {
      errors.push(`${fieldPath}: must not be an empty array`)
      continue
    }
    const values: unknown[] = Array.isArray(value) ? value : [value]
    const seen = new Set<string>()
    values.forEach((item, index) => {
      const itemPath = Array.isArray(value)
        ? `${fieldPath}[${index}]`
        : fieldPath
      if (!isScalar(item)) {
        errors.push(`${itemPath}: must be a string, number, or boolean`)
        return
      }
      const problem = matcher.check(item)
      if (problem) errors.push(`${itemPath}: ${problem}`)
      const identity = `${typeof item}:${item}`
      if (seen.has(identity)) errors.push(`${itemPath}: duplicate value`)
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
    errors.push('groups: must be an array')
    return
  }
  const groupIds = new Set<string>()
  groups.forEach((group: unknown, index) => {
    const path = `groups[${index}]`
    if (!isRecord(group)) {
      errors.push(`${path}: must be an object`)
      return
    }
    if (typeof group.id !== 'string' || group.id === '') {
      errors.push(`${path}.id: must be a non-empty string`)
    } else if (groupIds.has(group.id)) {
      errors.push(`${path}.id: duplicate group id "${group.id}"`)
    } else {
      groupIds.add(group.id)
    }
    if (typeof group.name !== 'string' || group.name === '') {
      errors.push(`${path}.name: must be a non-empty string`)
    }
    for (const key of ['description', 'details']) {
      if (group[key] !== undefined && typeof group[key] !== 'string') {
        errors.push(`${path}.${key}: must be a string`)
      }
    }
    if (!Array.isArray(group.pokemon)) {
      errors.push(`${path}.pokemon: must be an array of entry ids`)
      return
    }
    const seen = new Set<string>()
    group.pokemon.forEach((id: unknown, position) => {
      const idPath = `${path}.pokemon[${position}]`
      if (typeof id !== 'string') {
        errors.push(`${idPath}: must be a string`)
        return
      }
      if (seen.has(id)) errors.push(`${idPath}: duplicate entry id "${id}"`)
      seen.add(id)
      if (!entryIds.has(id)) {
        errors.push(`${idPath}: "${id}" is not a key of pokemon`)
      }
    })
  })
}

function validateMetadata(metadata: unknown, errors: string[]): void {
  if (!isRecord(metadata)) {
    errors.push('metadata: must be an object')
    return
  }
  for (const key of Object.keys(metadata)) {
    if (key !== 'version' && !OPTIONAL_METADATA_KEYS.includes(key)) {
      errors.push(`metadata.${key}: unknown field`)
    }
  }
  if (typeof metadata.version !== 'string' || metadata.version === '') {
    errors.push('metadata.version: must be a non-empty string')
  }
  for (const key of OPTIONAL_METADATA_KEYS) {
    if (metadata[key] !== undefined && typeof metadata[key] !== 'string') {
      errors.push(`metadata.${key}: must be a string`)
    }
  }
}

/** Checks an unknown JSON value against the collection format. */
export function validateCollection(json: unknown): ValidationResult {
  const errors: string[] = []
  if (!isRecord(json)) {
    return { ok: false, errors: ['(root): must be a JSON object'] }
  }

  for (const key of Object.keys(json)) {
    if (!TOP_LEVEL_KEYS.includes(key)) errors.push(`${key}: unknown field`)
  }
  if (json.$schema !== undefined && typeof json.$schema !== 'string') {
    errors.push('$schema: must be a string')
  }

  if (typeof json.schemaVersion !== 'string') {
    errors.push('schemaVersion: must be the string "1"')
  } else if (json.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion: "${json.schemaVersion}" is not supported (this version of PkCamp reads "${SUPPORTED_SCHEMA_VERSION}")`
    )
  }

  if (typeof json.id !== 'string') {
    errors.push('id: must be a string')
  } else if (!ID_PATTERN.test(json.id) || json.id.length > MAX_ID_LENGTH) {
    errors.push(
      `id: must be 1-${MAX_ID_LENGTH} letters, digits, or hyphens (it becomes a file name)`
    )
  }
  if (typeof json.name !== 'string' || json.name.trim() === '') {
    errors.push('name: must be a non-empty string')
  }

  validateMetadata(json.metadata, errors)

  const entryIds = new Set<string>()
  if (!isRecord(json.pokemon)) {
    errors.push('pokemon: must be an object keyed by entry id')
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
