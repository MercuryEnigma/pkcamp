import {
  formatDate as localizedDate,
  formatList,
  formatRelativeTime,
} from '../../../services/i18n/format'
import { i18n } from '../../../services/i18n'
import type { SpriteRequest } from '../../../services/sprites'
import type { Gen3GameId, GameId } from '../../../services/saveLibrary'
import { DEX_NAME } from '../dexNames'
import { getGameLabel } from '../gameDisplay'
import {
  type Constraint,
  type CollectionDefinition,
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
  return form === 0 ? i18n.t('common:actions.default') : String(form)
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
    return i18n.t('collections:entryDisplay.speciesFormLabel', {
      name: name,
      value2: formLabel(species, form),
    })
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
  return duplicate
    ? i18n.t('collections:entryDisplay.distinctEntryLabel', {
        label: label,
        entryId: entryId,
      })
    : label
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
  return formatList(values, 'disjunction')
}

const DESCRIBERS: Record<
  ConstraintField,
  (constraint: Constraint, constraints: EntryConstraints) => string
> = {
  species: (c) =>
    i18n.t('collections:entryDisplay.species', {
      value1: joinOr(
        toList(c).map((v) =>
          typeof v === 'number'
            ? i18n.t('collections:entryDisplay.speciesNumberAndName', {
                v: v,
                value2: speciesName(v),
              })
            : String(v)
        )
      ),
    }),
  form: (c, all) =>
    i18n.t('collections:entryDisplay.form', {
      value1: joinOr(toList(c).map((v) => formLabel(singleSpecies(all), v))),
    }),
  gender: (c) =>
    i18n.t('collections:entryDisplay.gender', {
      value1: joinOr(toList(c).map(String)),
    }),
  shiny: (c) =>
    i18n.t('collections:entryDisplay.shiny', {
      value1: joinOr(
        toList(c).map((v) =>
          v === true
            ? i18n.t('common:actions.yes')
            : i18n.t('common:actions.no')
        )
      ),
    }),
  isEgg: (c) =>
    i18n.t('collections:entryDisplay.egg', {
      value1: joinOr(
        toList(c).map((v) =>
          v === true
            ? i18n.t('common:actions.yes')
            : i18n.t('common:actions.no')
        )
      ),
    }),
  level: (c) =>
    i18n.t('collections:entryDisplay.level', {
      value1: joinOr(toList(c).map(String)),
    }),
  nickname: (c) =>
    i18n.t('collections:entryDisplay.nickname', {
      value1: joinOr(toList(c).map(String)),
    }),
  ot: (c) =>
    i18n.t('collections:entryDisplay.originalTrainer', {
      value1: joinOr(toList(c).map(String)),
    }),
  id: (c) =>
    i18n.t('collections:entryDisplay.trainerIdRequirement', {
      values: joinOr(toList(c).map(String)),
    }),
  item: (c) =>
    i18n.t('collections:entryDisplay.heldItem', {
      value1: joinOr(toList(c).map(String)),
    }),
  ability: (c) =>
    i18n.t('collections:entryDisplay.ability', {
      value1: joinOr(toList(c).map(String)),
    }),
  nature: (c) =>
    i18n.t('collections:entryDisplay.nature', {
      value1: joinOr(toList(c).map(String)),
    }),
  moves: (c) =>
    i18n.t('collections:entryDisplay.knowsMove', {
      count: toList(c).length,
      moves: formatList(toList(c).map(String), 'unit'),
    }),
  ribbons: (c) =>
    i18n.t('collections:entryDisplay.hasRibbon', {
      count: toList(c).length,
      ribbons: formatList(toList(c).map(String), 'unit'),
    }),
  all_moves: (c) =>
    i18n.t('collections:entryDisplay.knowsAllOf', {
      value1: formatList(toList(c).map(String), 'unit'),
    }),
  all_ribbons: (c) =>
    i18n.t('collections:entryDisplay.hasAllOfTheRibbons', {
      value1: formatList(toList(c).map(String), 'unit'),
    }),
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
  joinOr(
    toList(c).map((v) =>
      v === true ? i18n.t('common:actions.yes') : i18n.t('common:actions.no')
    )
  )
const anyOf = (c: Constraint) => {
  const values = toList(c).map(String)
  return values.length > 1
    ? i18n.t('collections:entryDisplay.anyOf', {
        value1: formatList(values, 'unit'),
      })
    : values.join('')
}
const allOf = (c: Constraint) => formatList(toList(c).map(String), 'unit')

/** Label and value for each field, for a key/value requirement record. */
const getFields = (): Record<
  ConstraintField,
  [string, (constraint: Constraint, constraints: EntryConstraints) => string]
> => ({
  species: [
    i18n.t('collections:entryDisplay.species2'),
    (c) =>
      joinOr(
        toList(c).map((v) =>
          typeof v === 'number' ? speciesName(v) : String(v)
        )
      ),
  ],
  form: [
    i18n.t('collections:entryDisplay.form2'),
    (c, all) => joinOr(toList(c).map((v) => formLabel(singleSpecies(all), v))),
  ],
  gender: [
    i18n.t('collections:entryDisplay.gender2'),
    (c) => joinOr(toList(c).map(String)),
  ],
  shiny: [i18n.t('collections:entryDisplay.shiny2'), yesNo],
  isEgg: [i18n.t('collections:entryDisplay.egg2'), yesNo],
  level: [
    i18n.t('collections:entryDisplay.level2'),
    (c) => joinOr(toList(c).map(String)),
  ],
  nickname: [
    i18n.t('collections:entryDisplay.nickname2'),
    (c) => joinOr(toList(c).map(String)),
  ],
  ot: [
    i18n.t('collections:entryDisplay.originalTrainer2'),
    (c) => joinOr(toList(c).map(String)),
  ],
  id: [
    i18n.t('collections:entryDisplay.trainerId'),
    (c) => joinOr(toList(c).map(String)),
  ],
  item: [
    i18n.t('collections:entryDisplay.heldItem2'),
    (c) => joinOr(toList(c).map(String)),
  ],
  ability: [
    i18n.t('collections:entryDisplay.ability2'),
    (c) => joinOr(toList(c).map(String)),
  ],
  nature: [
    i18n.t('collections:entryDisplay.nature2'),
    (c) => joinOr(toList(c).map(String)),
  ],
  moves: [i18n.t('collections:entryDisplay.move'), anyOf],
  ribbons: [i18n.t('collections:entryDisplay.ribbon'), anyOf],
  all_moves: [i18n.t('collections:entryDisplay.allMoves'), allOf],
  all_ribbons: [i18n.t('collections:entryDisplay.allRibbons'), allOf],
})

/** Only the fields the entry actually constrains, in definition order. */
export function requirementFields(
  constraints: EntryConstraints
): { label: string; value: string; values: string[] }[] {
  return (Object.keys(constraints) as ConstraintField[]).flatMap((field) => {
    const constraint = constraints[field]
    const describer = getFields()[field]
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
  const game = getGameLabel(source.gameId as Gen3GameId) ?? source.gameId
  if (source.location === 'party')
    return i18n.t('collections:entryDisplay.party', { game: game })
  const box =
    source.boxName ||
    i18n.t('collections:entryDisplay.box', { value1: source.location.box + 1 })
  return i18n.t('collections:entryDisplay.slot', {
    game: game,
    box: box,
    value3: source.location.slot + 1,
  })
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : localizedDate(date, { year: 'numeric', month: 'short', day: 'numeric' })
}

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
      return formatRelativeTime(Math.round(seconds / size), unit)
    }
  }
  return i18n.t('collections:entryDisplay.justNow')
}

export type StatusFilter = 'all' | 'registered' | 'missing' | 'visiting'

export const getStatusFilters = (): {
  value: StatusFilter
  label: string
}[] => [
  { value: 'all', label: i18n.t('collections:entryDisplay.all') },
  { value: 'registered', label: i18n.t('collections:entryDisplay.registered') },
  { value: 'missing', label: i18n.t('collections:entryDisplay.missing') },
  { value: 'visiting', label: i18n.t('collections:entryDisplay.visiting') },
]
