import {
  PMDCOLLAB_BASE_DEX,
  PMDCOLLAB_FEMALE,
  PMDCOLLAB_FORMS,
  PMDCOLLAB_MALE,
  PMDCOLLAB_SHINY_DEX,
  PMDCOLLAB_SHINY_FEMALE,
  PMDCOLLAB_SHINY_FORMS,
  PMDCOLLAB_SHINY_MALE,
} from './generatedPmdCollab'
import type {
  SpriteManifest,
  SpriteManifestEntry,
  SpriteSourceDefinition,
} from './manifest'
import { auditSpriteManifest } from './coverage'
import { POKEAPI_SOURCE, SPRITE_COVERAGE_TARGETS } from './sources'

/**
 * PMD Collab's SpriteCollab portrait repository (sprites.pmdcollab.org,
 * backed by github.com/PMDCollab/SpriteCollab) — see ROADMAP.md's "Sprite
 * presentation" section for why hotlinking is an approved exception for this
 * dev preview, not the production pipeline.
 *
 * Note this is Mystery Dungeon-style chibi portrait art, not a traditional
 * front-battle sprite like the other sources — a different visual style, not
 * a bug.
 *
 * Source data comes from scripts/generate-pmdcollab-catalog.mjs, which walks
 * SpriteCollab's own tracker.json completion tree (never guessed) to find
 * every form/shiny/gender combination it actually has art for, e.g. Hisuian
 * Sneasel's shiny female portrait.
 */

const PMDCOLLAB_PORTRAIT_BASE =
  'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait'

function padded(nationalDex: number): string {
  return String(nationalDex).padStart(4, '0')
}

function entry(
  nationalDex: number,
  assetPath: string,
  options: Pick<SpriteManifestEntry, 'form' | 'gender' | 'shiny'>
): SpriteManifestEntry {
  return { nationalDex, egg: false, assetPath, ...options }
}

const baseEntries: SpriteManifestEntry[] = PMDCOLLAB_BASE_DEX.map(
  (nationalDex) =>
    entry(
      nationalDex,
      `${PMDCOLLAB_PORTRAIT_BASE}/${padded(nationalDex)}/Normal.png`,
      { shiny: false }
    )
)

// The default form's "Shiny" node is universally keyed "0001" under the
// "0000" wrapper — verified against every species in tracker.json by
// scripts/generate-pmdcollab-catalog.mjs, not assumed here.
const shinyEntries: SpriteManifestEntry[] = PMDCOLLAB_SHINY_DEX.map(
  (nationalDex) =>
    entry(
      nationalDex,
      `${PMDCOLLAB_PORTRAIT_BASE}/${padded(nationalDex)}/0000/0001/Normal.png`,
      { shiny: true }
    )
)

const formEntries: SpriteManifestEntry[] = PMDCOLLAB_FORMS.map(
  ({ nationalDex, formId, path }) =>
    entry(
      nationalDex,
      `${PMDCOLLAB_PORTRAIT_BASE}/${padded(nationalDex)}/${path}`,
      { form: formId, shiny: false }
    )
)

const shinyFormEntries: SpriteManifestEntry[] = PMDCOLLAB_SHINY_FORMS.map(
  ({ nationalDex, formId, path }) =>
    entry(
      nationalDex,
      `${PMDCOLLAB_PORTRAIT_BASE}/${padded(nationalDex)}/${path}`,
      { form: formId, shiny: true }
    )
)

function fromGenderVariant(
  variants: ReadonlyArray<{
    nationalDex: number
    formId?: string
    path: string
  }>,
  options: Pick<SpriteManifestEntry, 'gender' | 'shiny'>
): SpriteManifestEntry[] {
  return variants.map(({ nationalDex, formId, path }) =>
    entry(
      nationalDex,
      `${PMDCOLLAB_PORTRAIT_BASE}/${padded(nationalDex)}/${path}`,
      { ...options, ...(formId ? { form: formId } : {}) }
    )
  )
}

const femaleEntries = fromGenderVariant(PMDCOLLAB_FEMALE, {
  gender: 'female',
  shiny: false,
})
const shinyFemaleEntries = fromGenderVariant(PMDCOLLAB_SHINY_FEMALE, {
  gender: 'female',
  shiny: true,
})
const maleEntries = fromGenderVariant(PMDCOLLAB_MALE, {
  gender: 'male',
  shiny: false,
})
const shinyMaleEntries = fromGenderVariant(PMDCOLLAB_SHINY_MALE, {
  gender: 'male',
  shiny: true,
})

const PMDCOLLAB_SPRITE_MANIFEST: SpriteManifest = [
  ...baseEntries,
  ...shinyEntries,
  ...formEntries,
  ...shinyFormEntries,
  ...femaleEntries,
  ...shinyFemaleEntries,
  ...maleEntries,
  ...shinyMaleEntries,
]

export const PMDCOLLAB_SOURCE: SpriteSourceDefinition = {
  id: 'pmdcollab',
  label: 'sprites.pmdcollab.org',
  homepage: 'https://sprites.pmdcollab.org/',
  manifest: PMDCOLLAB_SPRITE_MANIFEST,
  formAliases: POKEAPI_SOURCE.formAliases,
  coverage: auditSpriteManifest(
    PMDCOLLAB_SPRITE_MANIFEST,
    SPRITE_COVERAGE_TARGETS
  ),
  isolationSafe: true,
}
