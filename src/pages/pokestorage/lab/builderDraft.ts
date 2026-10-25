import { i18n } from '../../../services/i18n'
import { DEX_NAME } from '../dexNames'
import type { CollectionDefinition, EntryConstraints } from './collectionTypes'
import { speciesName } from './entryDisplay'
import { validateCollection } from './validateCollection'

/** Every species the builder offers, and each Unown form on its own. */
export interface SpeciesOption {
  label: string
  species: number
  /** `null` accepts any form. */
  form: number | null
  /** The entry id this option gets, before de-duplication. */
  slug: string
}

const UNOWN = 201
const UNOWN_FORMS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!?'

export const getSpeciesOptions = (): readonly SpeciesOption[] =>
  Array.from({ length: 386 }, (_, index) => index + 1).flatMap(
    (species): SpeciesOption[] => {
      const slug = DEX_NAME[species] ?? String(species)
      const name = speciesName(species)
      if (species !== UNOWN) return [{ label: name, species, form: null, slug }]
      return [
        {
          label: i18n.t('collections:builderDraft.any', { name: name }),
          species,
          form: null,
          slug: `${slug}-any`,
        },
        ...[...UNOWN_FORMS].map((letter, form) => ({
          label: i18n.t('collections:builderDraft.unownFormLabel', {
            name: name,
            letter: letter,
          }),
          species,
          form,
          slug: `${slug}-${
            letter === '!'
              ? 'exclamation'
              : letter === '?'
                ? 'question'
                : letter.toLowerCase()
          }`,
        })),
      ]
    }
  )

export type ShinyRule = 'any' | 'yes' | 'no'

/** One Pokémon the collection asks for, as the player filled it in. */
export interface DraftEntry {
  id: string
  species: SpeciesOption
  shiny: ShinyRule
  /** All of these must be held. */
  ribbons: string[]
  nature: string
  ability: string
  move: string
  ot: string
  trainerId: string
}

export interface CollectionDraft {
  name: string
  description: string
  author: string
  source: string
  details: string
  updated: string
  entries: DraftEntry[]
}

const COLLECTION_VERSION = '1.0.0'
const MAX_ID_LENGTH = 64

export function emptyDraft(today = new Date()): CollectionDraft {
  return {
    name: '',
    description: '',
    author: '',
    source: '',
    details: '',
    updated: today.toISOString().slice(0, 10),
    entries: [],
  }
}

/** Letters, digits and hyphens only, as a collection id must be. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_ID_LENGTH)
    .replace(/-+$/, '')
}

/** The species' slug, numbered when the collection already uses it. */
export function entryIdFor(
  species: SpeciesOption,
  entries: readonly DraftEntry[]
): string {
  const used = new Set(entries.map((entry) => entry.id))
  if (!used.has(species.slug)) return species.slug
  for (let n = 2; ; n++) {
    const id = `${species.slug}-${n}`
    if (!used.has(id)) return id
  }
}

/** Name or game-data id, as the collection format reads either. */
function idOrName(text: string): string | number {
  const trimmed = text.trim()
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed
}

function entryConstraints(entry: DraftEntry): EntryConstraints {
  const constraints: EntryConstraints = {
    species: entry.species.species,
    // An egg has not hatched into the Pokémon yet, as in the built-ins.
    isEgg: false,
  }
  if (entry.species.form !== null) constraints.form = entry.species.form
  if (entry.shiny !== 'any') constraints.shiny = entry.shiny === 'yes'
  if (entry.ribbons.length > 0) constraints.all_ribbons = [...entry.ribbons]
  if (entry.nature.trim()) constraints.nature = idOrName(entry.nature)
  if (entry.ability.trim()) constraints.ability = idOrName(entry.ability)
  if (entry.move.trim()) constraints.moves = idOrName(entry.move)
  if (entry.ot.trim()) constraints.ot = entry.ot.trim()
  if (entry.trainerId.trim()) {
    const id = entry.trainerId.trim()
    constraints.id = /^\d+$/.test(id) ? Number(id) : id
  }
  return constraints
}

/** The collection file the draft describes: one group holding every entry. */
export function toDefinition(draft: CollectionDraft): CollectionDefinition {
  const name = draft.name.trim()
  const optional = (key: string, value: string) =>
    value.trim() ? { [key]: value.trim() } : {}
  return {
    schemaVersion: '1',
    id: slugify(name),
    name,
    metadata: {
      version: COLLECTION_VERSION,
      ...optional('author', draft.author),
      ...optional('description', draft.description),
      ...optional('details', draft.details),
      ...optional('source', draft.source),
      ...optional('updated', draft.updated),
    },
    groups: [
      {
        id: 'all',
        name: name || 'All',
        pokemon: draft.entries.map((entry) => entry.id),
      },
    ],
    pokemon: Object.fromEntries(
      draft.entries.map((entry) => [entry.id, entryConstraints(entry)])
    ),
  }
}

/** What stops the draft from becoming a collection, if anything. */
export function draftProblems(draft: CollectionDraft): string[] {
  const problems: string[] = []
  if (draft.name.trim() === '')
    problems.push(i18n.t('collections:builderDraft.giveTheCollectionAName'))
  else if (slugify(draft.name) === '')
    problems.push(
      i18n.t('collections:builderDraft.theNameNeedsAtLeastOneLetterOrDigit')
    )
  if (draft.entries.length === 0)
    problems.push(i18n.t('collections:builderDraft.addAtLeastOnePokeMon'))
  if (problems.length > 0) return problems
  const result = validateCollection(toDefinition(draft))
  return result.ok ? [] : result.errors
}

/** "Shiny · Nature Adamant · OT Chase", for the entries list. */
export function summarizeEntry(entry: DraftEntry): string {
  return [
    entry.shiny === 'yes'
      ? i18n.t('collections:builderDraft.shiny')
      : entry.shiny === 'no'
        ? i18n.t('collections:builderDraft.notShiny')
        : '',
    ...entry.ribbons.map((ribbon) =>
      i18n.t('collections:builderDraft.ribbon', { ribbon: ribbon })
    ),
    entry.nature &&
      i18n.t('collections:builderDraft.nature', { nature: entry.nature }),
    entry.ability &&
      i18n.t('collections:builderDraft.ability', { ability: entry.ability }),
    entry.move &&
      i18n.t('collections:builderDraft.knows', { move: entry.move }),
    entry.ot && i18n.t('collections:builderDraft.ot', { ot: entry.ot }),
    entry.trainerId &&
      i18n.t('collections:builderDraft.id', { trainerId: entry.trainerId }),
  ]
    .filter(Boolean)
    .join(' · ')
}
