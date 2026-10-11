import type { PokemonNode } from '../../../services/pkhex'
import type {
  CollectionDefinition,
  ConstraintField,
  EntryConstraints,
  EntryMatch,
  Scalar,
  ScannedPokemon,
} from './collectionTypes'

/**
 * One checker per supported field. Validation and evaluation both read this
 * table, so a field can never be accepted by one and ignored by the other.
 * `check` returns an error message for a bad value, or null.
 */
type FieldMatcher =
  | {
      list?: false
      check(value: Scalar): string | null
      test(node: PokemonNode, value: Scalar): boolean
    }
  | {
      /** The constraint is an array that must all hold, not a "one of". */
      list: true
      check(value: Scalar): string | null
      test(node: PokemonNode, values: Scalar[]): boolean
    }

const lower = (value: string) => value.trim().toLowerCase()

function integer(min: number, max = Number.MAX_SAFE_INTEGER) {
  return (value: Scalar): string | null =>
    typeof value === 'number' && Number.isInteger(value)
      ? value >= min && value <= max
        ? null
        : `must be between ${min} and ${max}`
      : 'must be an integer'
}

function boolean(value: Scalar): string | null {
  return typeof value === 'boolean' ? null : 'must be true or false'
}

function text(value: Scalar): string | null {
  return typeof value === 'string' ? null : 'must be a string'
}

/** A game-data id (number) or its English name (string). */
function idOrName(value: Scalar): string | null {
  if (typeof value === 'number') return integer(0)(value)
  return typeof value === 'string' && value.trim() !== ''
    ? null
    : 'must be an id number or a name'
}

function matchesRef(
  ref: { id: number; name: string } | null,
  value: Scalar
): boolean {
  if (!ref) return false
  if (typeof value === 'number') return ref.id === value
  return typeof value === 'string' && lower(ref.name) === lower(value)
}

function knowsMove(node: PokemonNode, value: Scalar): boolean {
  return node.moves.some((move) => move !== null && matchesRef(move, value))
}

function hasRibbon(node: PokemonNode, value: Scalar): boolean {
  if (typeof value !== 'string') return false
  const wanted = lower(value)
  return node.ribbons.some(
    (ribbon) =>
      lower(ribbon.name) === wanted || lower(ribbon.shortName) === wanted
  )
}

const GENDERS = ['male', 'female', 'genderless']

export const FIELD_MATCHERS: Record<ConstraintField, FieldMatcher> = {
  // TODO: this limit grows when more generations are supported.
  species: { check: integer(1, 386), test: (n, v) => n.species === v },
  form: { check: integer(0), test: (n, v) => n.form === v },
  gender: {
    check: (v) =>
      typeof v === 'string' && GENDERS.includes(lower(v))
        ? null
        : 'must be "Male", "Female", or "Genderless"',
    test: (n, v) => typeof v === 'string' && lower(n.gender) === lower(v),
  },
  shiny: { check: boolean, test: (n, v) => n.shiny === v },
  isEgg: { check: boolean, test: (n, v) => n.isEgg === v },
  level: { check: integer(1, 100), test: (n, v) => n.level === v },
  nickname: { check: text, test: (n, v) => n.nickname === v },
  ot: { check: text, test: (n, v) => n.originalTrainerName === v },
  id: { check: integer(0), test: (n, v) => n.originalTrainerId === v },
  item: {
    check: idOrName,
    test: (n, v) =>
      typeof v === 'number'
        ? n.heldItem === v
        : typeof v === 'string' && lower(n.heldItemName) === lower(v),
  },
  ability: { check: idOrName, test: (n, v) => matchesRef(n.ability, v) },
  nature: { check: idOrName, test: (n, v) => matchesRef(n.nature, v) },
  moves: { check: idOrName, test: knowsMove },
  ribbons: { check: nonEmptyText, test: hasRibbon },
  all_moves: {
    list: true,
    check: nonEmptyText,
    test: (n, values) => values.every((v) => knowsMove(n, v)),
  },
  all_ribbons: {
    list: true,
    check: nonEmptyText,
    test: (n, values) => values.every((v) => hasRibbon(n, v)),
  },
}

function nonEmptyText(value: Scalar): string | null {
  return typeof value === 'string' && value.trim() !== ''
    ? null
    : 'must be a non-empty string'
}

/** Every field an entry may use; single source for validation. */
export const SUPPORTED_FIELDS = Object.keys(FIELD_MATCHERS) as ConstraintField[]

export function satisfies(
  node: PokemonNode,
  constraints: EntryConstraints
): boolean {
  // Validation rejects these; failing here too keeps an unchecked field from
  // ever marking an entry as owned.
  const keys = Object.keys(constraints)
  if (keys.length === 0) throw new Error('An entry has no constraints.')
  const unsupported = keys.find((key) => !Object.hasOwn(FIELD_MATCHERS, key))
  if (unsupported) throw new Error(`"${unsupported}" is not supported yet.`)
  for (const field of SUPPORTED_FIELDS) {
    const constraint = constraints[field]
    if (constraint === undefined) continue
    const matcher = FIELD_MATCHERS[field]
    const values = Array.isArray(constraint) ? constraint : [constraint]
    if (matcher.list) {
      if (!matcher.test(node, values)) return false
    } else if (!values.some((value) => matcher.test(node, value))) {
      return false
    }
  }
  return true
}

/**
 * Which entries this scan matches. An entry matches when any scanned Pokémon
 * satisfies every constraint; one Pokémon may satisfy several entries.
 */
export function evaluateCollection(
  definition: CollectionDefinition,
  scanned: readonly ScannedPokemon[]
): Record<string, EntryMatch> {
  const result: Record<string, EntryMatch> = {}
  for (const [entryId, constraints] of Object.entries(definition.pokemon)) {
    const matches = scanned.filter((item) => satisfies(item.node, constraints))
    result[entryId] = { entryId, matched: matches.length > 0, matches }
  }
  return result
}
