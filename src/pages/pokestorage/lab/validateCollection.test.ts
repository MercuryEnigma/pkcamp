import { describe, expect, it } from 'vitest'
import { BUILT_IN_COLLECTIONS } from './builtInCollections'
import { SUPPORTED_FIELDS, validateCollection } from './validateCollection'

function base(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: '1',
    id: 'test-dex',
    name: 'Test',
    metadata: { version: '1.0.0' },
    groups: [{ id: 'g', name: 'G', pokemon: ['a'] }],
    pokemon: { a: { species: 1 } },
    ...overrides,
  }
}

function errorsOf(json: unknown): string[] {
  const result = validateCollection(json)
  if (result.ok) throw new Error('expected validation to fail')
  return result.errors
}

describe('validateCollection', () => {
  it('accepts the built-in collections', () => {
    for (const def of BUILT_IN_COLLECTIONS) {
      expect(validateCollection(def).ok).toBe(true)
    }
  })

  it('accepts a minimal definition and allows $schema', () => {
    const result = validateCollection(base({ $schema: './schema.json' }))
    expect(result.ok).toBe(true)
    if (result.ok) expect('$schema' in result.definition).toBe(false)
  })

  it('rejects unsupported fields with a path', () => {
    const errors = errorsOf(
      base({
        pokemon: { 'unown-a': { species: 201, teraType: 'Fire' } },
        groups: [],
      })
    )
    expect(errors).toEqual([
      'pokemon["unown-a"].teraType: "teraType" is not supported yet',
    ])
  })

  it('rejects every field that is in the schema but not checkable', () => {
    for (const field of [
      'originGame',
      'originGeneration',
      'metLocation',
      'metLevel',
      'fatefulEncounter',
      'language',
      'ball',
      'teraType',
      'alpha',
      'gmaxFactor',
      'size',
      'stamp',
      'marks',
      'all_marks',
      'somethingElse',
    ]) {
      expect(SUPPORTED_FIELDS).not.toContain(field)
      const errors = errorsOf(base({ pokemon: { a: { [field]: 'x' } } }))
      expect(errors[0]).toContain(`"${field}" is not supported yet`)
    }
  })

  it('rejects a group that references a missing entry', () => {
    const errors = errorsOf(
      base({ groups: [{ id: 'g', name: 'G', pokemon: ['a', 'zzz'] }] })
    )
    expect(errors).toEqual([
      'groups[0].pokemon[1]: "zzz" is not a key of pokemon',
    ])
  })

  it('rejects duplicate group ids', () => {
    const group = { id: 'g', name: 'G', pokemon: ['a'] }
    expect(errorsOf(base({ groups: [group, group] }))[0]).toContain(
      'duplicate group id'
    )
  })

  it('rejects an empty entry', () => {
    expect(errorsOf(base({ pokemon: { a: {} } }))[0]).toContain(
      'at least one constraint'
    )
  })

  it('rejects duplicate and empty arrays', () => {
    expect(
      errorsOf(base({ pokemon: { a: { species: [1, 1] } } }))[0]
    ).toContain('duplicate value')
    expect(errorsOf(base({ pokemon: { a: { species: [] } } }))[0]).toContain(
      'empty array'
    )
    expect(
      errorsOf(base({ pokemon: { a: { all_moves: ['Tackle', 'Tackle'] } } }))[0]
    ).toContain('duplicate value')
    expect(
      errorsOf(base({ pokemon: { a: { all_moves: 'Tackle' } } }))[0]
    ).toContain('array')
  })

  it('rejects unknown top-level and metadata keys', () => {
    expect(errorsOf(base({ extra: 1 }))).toEqual(['extra: unknown field'])
    expect(errorsOf(base({ metadata: { version: '1', extra: 1 } }))).toEqual([
      'metadata.extra: unknown field',
    ])
  })

  it('rejects another schemaVersion', () => {
    expect(errorsOf(base({ schemaVersion: '2' }))[0]).toContain('not supported')
  })

  it('rejects ids that are unsafe as a file name', () => {
    for (const id of ['../x', 'has space', 'a/b', '', 'x'.repeat(65)]) {
      expect(errorsOf(base({ id }))[0]).toMatch(/^id:/)
    }
  })

  it('checks value types per field', () => {
    const bad = (constraints: Record<string, unknown>) =>
      errorsOf(base({ pokemon: { a: constraints } })).length > 0
    expect(bad({ shiny: 'yes' })).toBe(true)
    expect(bad({ species: 'Unown' })).toBe(true)
    expect(bad({ species: 1.5 })).toBe(true)
    expect(bad({ form: 'A' })).toBe(true)
    expect(bad({ gender: 'Other' })).toBe(true)
    expect(bad({ isEgg: 0 })).toBe(true)
    expect(bad({ species: { id: 1 } })).toBe(true)
  })

  it('limits species to Gen 3', () => {
    expect(errorsOf(base({ pokemon: { a: { species: 387 } } }))[0]).toContain(
      '1 and 386'
    )
    expect(errorsOf(base({ pokemon: { a: { species: 0 } } })).length).toBe(1)
  })

  it('reports every error at once', () => {
    const errors = errorsOf({ schemaVersion: '9', id: '../x', extra: true })
    expect(errors.length).toBeGreaterThanOrEqual(5)
  })

  it('rejects non-objects', () => {
    expect(validateCollection(null).ok).toBe(false)
    expect(validateCollection([]).ok).toBe(false)
    expect(validateCollection('x').ok).toBe(false)
  })
})
