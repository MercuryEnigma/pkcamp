import {
  POKEMONDB_FEMALE_IDS,
  POKEMONDB_FEMALE_SUFFIX,
  POKEMONDB_FORMS,
  POKEMONDB_SHINY_DEX,
  POKEMONDB_SHINY_FEMALE_IDS,
  POKEMONDB_SPECIES_SLUGS,
} from './generatedPokemonDb'
import type {
  SpriteManifest,
  SpriteManifestEntry,
  SpriteSourceDefinition,
} from './manifest'
import { auditSpriteManifest } from './coverage'
import { POKEAPI_SOURCE, SPRITE_COVERAGE_TARGETS } from './sources'

/**
 * pokemondb.net's sprite hosting — see ROADMAP.md's "Sprite presentation"
 * section for why hotlinking is an approved exception for this dev preview,
 * not the production pipeline.
 *
 * Source data comes from scripts/generate-pokemondb-catalog.mjs, which
 * live-verifies every slug against img.pokemondb.net's "home" sprite folder
 * (covers all generations uniformly, unlike the old single-game "emerald"
 * folder this replaced). Form slugs follow pokemondb's own dialect — e.g.
 * region names become adjectives ("hisui" -> "hisuian") and some descriptor
 * suffixes are dropped ("-plumage", "-breed") — never guessed here; only
 * live-confirmed slugs make it into the generated catalog.
 */

const POKEMONDB_HOME = 'https://img.pokemondb.net/sprites/home'

const speciesSlugs = POKEMONDB_SPECIES_SLUGS as Record<string, string>
const femaleSuffixes = POKEMONDB_FEMALE_SUFFIX as Record<string, string>

function entry(
  nationalDex: number,
  assetPath: string,
  options: Pick<SpriteManifestEntry, 'form' | 'gender' | 'shiny'>
): SpriteManifestEntry {
  return { nationalDex, egg: false, assetPath, ...options }
}

const baseEntries: SpriteManifestEntry[] = Object.entries(speciesSlugs).map(
  ([dexStr, slug]) =>
    entry(Number(dexStr), `${POKEMONDB_HOME}/normal/${slug}.png`, {
      shiny: false,
    })
)

const shinyEntries: SpriteManifestEntry[] = POKEMONDB_SHINY_DEX.flatMap(
  (nationalDex) => {
    const slug = speciesSlugs[nationalDex]
    if (!slug) return []
    return [
      entry(nationalDex, `${POKEMONDB_HOME}/shiny/${slug}.png`, {
        shiny: true,
      }),
    ]
  }
)

const formEntries: SpriteManifestEntry[] = POKEMONDB_FORMS.flatMap((form) => {
  const entries: SpriteManifestEntry[] = []
  if (form.normal)
    entries.push(
      entry(form.nationalDex, `${POKEMONDB_HOME}/normal/${form.slug}.png`, {
        form: form.formId,
        shiny: false,
      })
    )
  if (form.shiny)
    entries.push(
      entry(form.nationalDex, `${POKEMONDB_HOME}/shiny/${form.slug}.png`, {
        form: form.formId,
        shiny: true,
      })
    )
  return entries
})

function femaleSlug(nationalDex: number): string | undefined {
  const slug = speciesSlugs[nationalDex]
  if (!slug) return undefined
  return `${slug}${femaleSuffixes[nationalDex] ?? '-f'}`
}

const femaleEntries: SpriteManifestEntry[] = POKEMONDB_FEMALE_IDS.flatMap(
  (nationalDex) => {
    const slug = femaleSlug(nationalDex)
    if (!slug) return []
    return [
      entry(nationalDex, `${POKEMONDB_HOME}/normal/${slug}.png`, {
        gender: 'female',
        shiny: false,
      }),
    ]
  }
)

const shinyFemaleEntries: SpriteManifestEntry[] =
  POKEMONDB_SHINY_FEMALE_IDS.flatMap((nationalDex) => {
    const slug = femaleSlug(nationalDex)
    if (!slug) return []
    return [
      entry(nationalDex, `${POKEMONDB_HOME}/shiny/${slug}.png`, {
        gender: 'female',
        shiny: true,
      }),
    ]
  })

const POKEMONDB_SPRITE_MANIFEST: SpriteManifest = [
  ...baseEntries,
  ...shinyEntries,
  ...formEntries,
  ...femaleEntries,
  ...shinyFemaleEntries,
]

export const POKEMONDB_SOURCE: SpriteSourceDefinition = {
  id: 'pokemondb',
  label: 'pokemondb.net/sprites',
  homepage: 'https://pokemondb.net/sprites',
  manifest: POKEMONDB_SPRITE_MANIFEST,
  formAliases: POKEAPI_SOURCE.formAliases,
  coverage: auditSpriteManifest(
    POKEMONDB_SPRITE_MANIFEST,
    SPRITE_COVERAGE_TARGETS
  ),
}
