import { i18n } from '../../../services/i18n'
import type { StoredCollectionMatch } from '../../../services/storage'
import type { EntryConstraints, ConstraintField } from './collectionTypes'
import { requirementFields, speciesName } from './entryDisplay'
import { GEN3_RIBBONS, NATURES, speciesTypes } from './gen3Data'

export type EntryFilterField =
  'name' | 'type' | 'move' | 'ability' | 'nature' | 'item' | 'ribbon' | 'ot'

/** A text search on one aspect of an entry or the Pokémon found for it. */
export interface EntryFilter {
  field: EntryFilterField
  text: string
}

export const getFilterFields = (): readonly (readonly [
  EntryFilterField,
  string,
])[] => [
  ['name', i18n.t('collections:entryFilter.name')],
  ['type', i18n.t('collections:entryFilter.type')],
  ['move', i18n.t('collections:entryFilter.move')],
  ['ability', i18n.t('collections:entryFilter.ability')],
  ['nature', i18n.t('collections:entryFilter.nature')],
  ['item', i18n.t('collections:entryFilter.heldItem')],
  ['ribbon', i18n.t('collections:entryFilter.ribbon')],
  ['ot', i18n.t('collections:entryFilter.trainerOt')],
]

/** Schema fields used for matching, independent of translated labels. */
const REQUIREMENT_FIELDS: Partial<
  Record<EntryFilterField, readonly ConstraintField[]>
> = {
  move: ['moves', 'all_moves'],
  ability: ['ability'],
  nature: ['nature'],
  item: ['item'],
  ribbon: ['ribbons', 'all_ribbons'],
  ot: ['ot'],
}

function matchValues(
  field: EntryFilterField,
  match: StoredCollectionMatch
): string[] {
  switch (field) {
    case 'move':
      return match.moves ?? []
    case 'ability':
      return match.ability ? [match.ability] : []
    case 'nature':
      return match.nature ? [match.nature] : []
    case 'item':
      return match.heldItem ? [match.heldItem] : []
    case 'ribbon':
      return match.ribbons ?? []
    case 'ot':
      return [match.originalTrainerName]
    case 'type':
      return [...speciesTypes(match.species)]
    case 'name':
      return [speciesName(match.species), match.nickname]
  }
}

/**
 * Whether an entry passes the filter. Name and type look at the entry's
 * species; the rest look at the Pokémon found for it and at what the entry
 * itself requires.
 */
export function entryMatchesFilter(
  filter: EntryFilter,
  entry: {
    label: string
    species: number | null
    constraints: EntryConstraints
    matches: readonly StoredCollectionMatch[]
  }
): boolean {
  const needle = filter.text.trim().toLowerCase()
  if (!needle) return true
  const has = (values: readonly string[]) =>
    values.some((value) => value.toLowerCase().includes(needle))
  if (filter.field === 'name')
    return (
      has([entry.label]) ||
      entry.matches.some((match) => has(matchValues('name', match)))
    )
  if (filter.field === 'type')
    return entry.species !== null && has(speciesTypes(entry.species))
  const fields = REQUIREMENT_FIELDS[filter.field] ?? []
  const constraints: EntryConstraints = Object.fromEntries(
    fields
      .filter((field) => entry.constraints[field] !== undefined)
      .map((field) => [field, entry.constraints[field]])
  )
  return (
    requirementFields(constraints).some((field) => has(field.values)) ||
    entry.matches.some((match) => has(matchValues(filter.field, match)))
  )
}

/** Every field that has text; a missing or blank field is not filtering. */
export type EntryFilters = Partial<Record<EntryFilterField, string>>

export function activeFilters(filters: EntryFilters): EntryFilter[] {
  return getFilterFields().flatMap(([field]) => {
    const text = filters[field]?.trim()
    return text ? [{ field, text }] : []
  })
}

/** Whether an entry passes every active filter. */
export function entryMatchesFilters(
  filters: readonly EntryFilter[],
  entry: Parameters<typeof entryMatchesFilter>[1]
): boolean {
  return filters.every((filter) => entryMatchesFilter(filter, entry))
}

/** The values found in a collection, to suggest in each filter field. */
export function filterOptions(
  entries: readonly Parameters<typeof entryMatchesFilter>[1][]
): Record<Exclude<EntryFilterField, 'type'>, string[]> {
  const sets = {
    name: new Set<string>(),
    move: new Set<string>(),
    ability: new Set<string>(),
    nature: new Set<string>(NATURES),
    item: new Set<string>(),
    ribbon: new Set<string>(GEN3_RIBBONS),
    ot: new Set<string>(),
  }
  for (const entry of entries) {
    sets.name.add(entry.label)
    for (const match of entry.matches)
      for (const field of Object.keys(sets) as (keyof typeof sets)[])
        if (field !== 'name')
          for (const value of matchValues(field, match))
            if (value) sets[field].add(value)
  }
  const sorted = (set: Set<string>) =>
    [...set].sort((a, b) => a.localeCompare(b))
  return {
    name: sorted(sets.name),
    move: sorted(sets.move),
    ability: sorted(sets.ability),
    nature: sorted(sets.nature),
    item: sorted(sets.item),
    ribbon: sorted(sets.ribbon),
    ot: sorted(sets.ot),
  }
}
