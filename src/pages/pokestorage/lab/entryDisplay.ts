import type { SpriteRequest } from '../../../services/sprites'
import type { Gen3GameId, GameId } from '../../../services/saveLibrary'
import { DEX_NAME } from '../dexNames'
import { GAME_LABEL } from '../gameDisplay'
import {
  type Constraint,
  type CollectionDefinition,
  type EntryStatus,
  type ConstraintField,
  type EntryConstraints,
  type PokemonLocation,
  type Scalar,
} from './collectionTypes'

/** Unown forms 0-25 are A-Z, then `!` and `?`. */
const UNOWN_SPECIES = 201
const UNOWN_FORMS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!?'

function toList(constraint: Constraint | undefined): Scalar[] {
  if (constraint === undefined) return []
  return Array.isArray(constraint) ? constraint : [constraint]
}

export function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function speciesName(species: number): string {
  const slug = DEX_NAME[species]
  return slug ? titleCase(slug) : `#${species}`
}

function singleSpecies(constraints: EntryConstraints): number | null {
  const [first] = toList(constraints.species)
  return typeof first === 'number' ? first : null
}

function formLabel(species: number | null, form: Scalar): string {
  if (species === UNOWN_SPECIES && typeof form === 'number') {
    return UNOWN_FORMS[form] ?? String(form)
  }
  return form === 0 ? 'Default' : String(form)
}

/** The cell label: the species name, plus the letter for Unown. */
export function entryLabel(
  entryId: string,
  constraints: EntryConstraints
): string {
  const species = singleSpecies(constraints)
  if (species === null) return entryId
  const name = speciesName(species)
  const [form] = toList(constraints.form)
  if (species === UNOWN_SPECIES && form !== undefined) {
    return `${name} ${formLabel(species, form)}`
  }
  return name
}

/** Keep constrained entries with the same species/form distinguishable. */
export function collectionEntryLabel(
  definition: CollectionDefinition,
  entryId: string
): string {
  const constraints = definition.pokemon[entryId]
  if (!constraints) return entryId
  const label = entryLabel(entryId, constraints)
  const duplicate = Object.entries(definition.pokemon).some(
    ([id, candidate]) => id !== entryId && entryLabel(id, candidate) === label
  )
  return duplicate ? `${label} · ${entryId}` : label
}

/** National dex number for display and search, when the entry has one. */
export function entryDexNumber(constraints: EntryConstraints): number | null {
  return singleSpecies(constraints)
}

export function entrySpriteRequest(
  entryId: string,
  constraints: EntryConstraints
): SpriteRequest {
  const species = singleSpecies(constraints)
  const [form] = toList(constraints.form)
  const [gender] = toList(constraints.gender)
  const lowerGender = typeof gender === 'string' ? gender.toLowerCase() : null
  return {
    nationalDex: species ?? 0,
    displayName: entryLabel(entryId, constraints),
    formId: typeof form === 'number' && form !== 0 ? form : undefined,
    gender:
      lowerGender === 'male' ||
      lowerGender === 'female' ||
      lowerGender === 'genderless'
        ? lowerGender
        : undefined,
    shiny: constraints.shiny === true ? true : undefined,
    egg: constraints.isEgg === true ? true : undefined,
  }
}

function joinOr(values: string[]): string {
  return values.join(' or ')
}

const DESCRIBERS: Record<
  ConstraintField,
  (constraint: Constraint, constraints: EntryConstraints) => string
> = {
  species: (c) =>
    `Species: ${joinOr(
      toList(c).map((v) =>
        typeof v === 'number' ? `#${v} ${speciesName(v)}` : String(v)
      )
    )}`,
  form: (c, all) =>
    `Form: ${joinOr(toList(c).map((v) => formLabel(singleSpecies(all), v)))}`,
  gender: (c) => `Gender: ${joinOr(toList(c).map(String))}`,
  shiny: (c) =>
    `Shiny: ${joinOr(toList(c).map((v) => (v === true ? 'Yes' : 'No')))}`,
  isEgg: (c) =>
    `Egg: ${joinOr(toList(c).map((v) => (v === true ? 'Yes' : 'No')))}`,
  level: (c) => `Level: ${joinOr(toList(c).map(String))}`,
  nickname: (c) => `Nickname: ${joinOr(toList(c).map(String))}`,
  ot: (c) => `Original trainer: ${joinOr(toList(c).map(String))}`,
  id: (c) => `Trainer ID: ${joinOr(toList(c).map(String))}`,
  item: (c) => `Held item: ${joinOr(toList(c).map(String))}`,
  ability: (c) => `Ability: ${joinOr(toList(c).map(String))}`,
  nature: (c) => `Nature: ${joinOr(toList(c).map(String))}`,
  moves: (c) =>
    `Knows ${toList(c).length > 1 ? 'any of' : 'the move'}: ${toList(c).join(', ')}`,
  ribbons: (c) =>
    `Has ${toList(c).length > 1 ? 'any of the ribbons' : 'the ribbon'}: ${toList(c).join(', ')}`,
  all_moves: (c) => `Knows all of: ${toList(c).join(', ')}`,
  all_ribbons: (c) => `Has all of the ribbons: ${toList(c).join(', ')}`,
}

/** Every requirement of an entry, in readable form. */
export function describeRequirements(constraints: EntryConstraints): string[] {
  return (Object.keys(constraints) as ConstraintField[]).flatMap((field) => {
    const constraint = constraints[field]
    return constraint === undefined
      ? []
      : [DESCRIBERS[field](constraint, constraints)]
  })
}

const yesNo = (c: Constraint) =>
  joinOr(toList(c).map((v) => (v === true ? 'Yes' : 'No')))
const anyOf = (c: Constraint) => {
  const values = toList(c).map(String)
  return values.length > 1 ? `Any of ${values.join(', ')}` : values.join('')
}
const allOf = (c: Constraint) => toList(c).map(String).join(', ')

/** Label and value for each field, for a key/value requirement record. */
const FIELDS: Record<
  ConstraintField,
  [string, (constraint: Constraint, constraints: EntryConstraints) => string]
> = {
  species: [
    'Species',
    (c) =>
      joinOr(
        toList(c).map((v) =>
          typeof v === 'number' ? speciesName(v) : String(v)
        )
      ),
  ],
  form: [
    'Form',
    (c, all) => joinOr(toList(c).map((v) => formLabel(singleSpecies(all), v))),
  ],
  gender: ['Gender', (c) => joinOr(toList(c).map(String))],
  shiny: ['Shiny', yesNo],
  isEgg: ['Egg', yesNo],
  level: ['Level', (c) => joinOr(toList(c).map(String))],
  nickname: ['Nickname', (c) => joinOr(toList(c).map(String))],
  ot: ['Original trainer', (c) => joinOr(toList(c).map(String))],
  id: ['Trainer ID', (c) => joinOr(toList(c).map(String))],
  item: ['Held item', (c) => joinOr(toList(c).map(String))],
  ability: ['Ability', (c) => joinOr(toList(c).map(String))],
  nature: ['Nature', (c) => joinOr(toList(c).map(String))],
  moves: ['Move', anyOf],
  ribbons: ['Ribbon', anyOf],
  all_moves: ['All moves', allOf],
  all_ribbons: ['All ribbons', allOf],
}

/** Only the fields the entry actually constrains, in definition order. */
export function requirementFields(
  constraints: EntryConstraints
): { label: string; value: string; values: string[] }[] {
  return (Object.keys(constraints) as ConstraintField[]).flatMap((field) => {
    const constraint = constraints[field]
    const describer = FIELDS[field]
    if (constraint === undefined || !describer) return []
    const [label, describe] = describer
    return [
      {
        label,
        value: describe(constraint, constraints),
        // Each value on its own, so a long list can show just the first.
        values: toList(constraint).map((v) => describe(v, constraints)),
      },
    ]
  })
}

/** "Emerald · Party" or "Emerald · BOX 1 slot 4". */
export function describeSource(source: {
  gameId: GameId
  location: PokemonLocation
  boxName?: string
}): string {
  const game = GAME_LABEL[source.gameId as Gen3GameId] ?? source.gameId
  if (source.location === 'party') return `${game} · Party`
  const box = source.boxName || `Box ${source.location.box + 1}`
  return `${game} · ${box} slot ${source.location.slot + 1}`
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : dateFormat.format(date)
}

const relativeFormat = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
})

export function formatRelative(iso: string, now = Date.now()): string {
  const seconds = (Date.parse(iso) - now) / 1000
  if (Number.isNaN(seconds)) return iso
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return relativeFormat.format(Math.round(seconds / size), unit)
    }
  }
  return 'just now'
}

export type StatusFilter = 'all' | 'missing' | EntryStatus

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'owned', label: 'Registered' },
  { value: 'missing', label: 'Missing' },
]
