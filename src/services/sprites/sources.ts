import {
  POKEAPI_FEMALE_IDS,
  POKEAPI_FORMS,
  POKEAPI_SHINY_FEMALE_IDS,
  SHUFFLE_FEMALE_SPECIES,
  SHUFFLE_FORMS,
  SHUFFLE_SHINY_FEMALE_SPECIES,
  SHUFFLE_SHINY_SPECIES,
  SPRITE_FORM_ALIASES,
} from './generatedCatalog'
import type {
  SpriteFormAliases,
  SpriteManifest,
  SpriteManifestEntry,
  SpriteSourceDefinition,
} from './manifest'
import { auditSpriteManifest, spriteVariantKey } from './coverage'

const POKEAPI_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
const SHUFFLE_BASE =
  'https://raw.githubusercontent.com/nileplumb/PkmnShuffleMap/master/UICONS/pokemon'

export const UNKNOWN_POKEMON_SPRITE = `${POKEAPI_BASE}/egg.png`

const nationalDexNumbers = Array.from({ length: 1025 }, (_, index) => index + 1)

function entry(
  nationalDex: number,
  assetPath: string,
  options: Pick<SpriteManifestEntry, 'form' | 'gender' | 'shiny'>
): SpriteManifestEntry {
  return { nationalDex, egg: false, assetPath, ...options }
}

const pokemonByApiId = new Map<
  number,
  { nationalDex: number; formId?: string }
>(
  nationalDexNumbers
    .map((nationalDex) => [nationalDex, { nationalDex }] as const)
    .concat(
      POKEAPI_FORMS.map(
        ({ pokeApiId, nationalDex, formId }) =>
          [pokeApiId, { nationalDex, formId }] as const
      )
    )
)

const pokeApiEntries: SpriteManifestEntry[] = nationalDexNumbers.flatMap(
  (nationalDex) => [
    entry(nationalDex, `${POKEAPI_BASE}/${nationalDex}.png`, { shiny: false }),
    entry(nationalDex, `${POKEAPI_BASE}/shiny/${nationalDex}.png`, {
      shiny: true,
    }),
  ]
)

for (const form of POKEAPI_FORMS) {
  if (form.normal) {
    pokeApiEntries.push(
      entry(form.nationalDex, `${POKEAPI_BASE}/${form.pokeApiId}.png`, {
        form: form.formId,
        shiny: false,
      })
    )
  }
  if (form.shiny) {
    pokeApiEntries.push(
      entry(form.nationalDex, `${POKEAPI_BASE}/shiny/${form.pokeApiId}.png`, {
        form: form.formId,
        shiny: true,
      })
    )
  }
}

for (const pokeApiId of POKEAPI_FEMALE_IDS) {
  const pokemon = pokemonByApiId.get(pokeApiId)
  if (!pokemon) continue
  pokeApiEntries.push(
    entry(pokemon.nationalDex, `${POKEAPI_BASE}/female/${pokeApiId}.png`, {
      form: pokemon.formId,
      gender: 'female',
      shiny: false,
    })
  )
}

for (const pokeApiId of POKEAPI_SHINY_FEMALE_IDS) {
  const pokemon = pokemonByApiId.get(pokeApiId)
  if (!pokemon) continue
  pokeApiEntries.push(
    entry(
      pokemon.nationalDex,
      `${POKEAPI_BASE}/shiny/female/${pokeApiId}.png`,
      {
        form: pokemon.formId,
        gender: 'female',
        shiny: true,
      }
    )
  )
}

const POKEAPI_SPRITE_MANIFEST: SpriteManifest = pokeApiEntries

const shuffleEntries: SpriteManifestEntry[] = nationalDexNumbers.map(
  (nationalDex) =>
    entry(nationalDex, `${SHUFFLE_BASE}/${nationalDex}.png`, { shiny: false })
)

for (const nationalDex of SHUFFLE_SHINY_SPECIES) {
  shuffleEntries.push(
    entry(nationalDex, `${SHUFFLE_BASE}/${nationalDex}_s.png`, { shiny: true })
  )
}
for (const nationalDex of SHUFFLE_FEMALE_SPECIES) {
  shuffleEntries.push(
    entry(nationalDex, `${SHUFFLE_BASE}/${nationalDex}_g2.png`, {
      gender: 'female',
      shiny: false,
    })
  )
}
for (const nationalDex of SHUFFLE_SHINY_FEMALE_SPECIES) {
  shuffleEntries.push(
    entry(nationalDex, `${SHUFFLE_BASE}/${nationalDex}_g2_s.png`, {
      gender: 'female',
      shiny: true,
    })
  )
}
for (const form of SHUFFLE_FORMS) {
  if (form.normal) {
    shuffleEntries.push(
      entry(form.nationalDex, `${SHUFFLE_BASE}/${form.file}`, {
        form: form.formId,
        shiny: false,
      })
    )
  }
  if (form.shiny) {
    shuffleEntries.push(
      entry(form.nationalDex, `${SHUFFLE_BASE}/${form.shinyFile}`, {
        form: form.formId,
        shiny: true,
      })
    )
  }
}

const SHUFFLE_SPRITE_MANIFEST: SpriteManifest = shuffleEntries

/**
 * Shared across every source (including pokemondb/pmdcollab in their own
 * sibling files) so a "missing" coverage bucket always measures against the
 * same universe of catalogued variants, not a per-source guess.
 */
const coverageTargets = {
  forms: [
    ...POKEAPI_FORMS.map((form) =>
      spriteVariantKey(form.nationalDex, form.formId)
    ),
    ...SHUFFLE_FORMS.map((form) =>
      spriteVariantKey(form.nationalDex, form.formId)
    ),
  ],
  // Unions every source's own catalogued female variants, not just PokeAPI's
  // — otherwise a source-specific female id (e.g. Shuffle's own gender-diff
  // list) would be invisible to every source's coverage report, including
  // its own, rather than showing up as a real "available" entry.
  female: [
    ...POKEAPI_FEMALE_IDS.flatMap((pokeApiId) => {
      const pokemon = pokemonByApiId.get(pokeApiId)
      return pokemon
        ? [spriteVariantKey(pokemon.nationalDex, pokemon.formId)]
        : []
    }),
    ...SHUFFLE_FEMALE_SPECIES.map((nationalDex) =>
      spriteVariantKey(nationalDex)
    ),
  ],
}

export const POKEAPI_SOURCE: SpriteSourceDefinition = {
  id: 'pokeapi-github',
  label: 'PokeAPI/sprites',
  homepage: 'https://github.com/PokeAPI/sprites',
  manifest: POKEAPI_SPRITE_MANIFEST,
  formAliases: SPRITE_FORM_ALIASES as SpriteFormAliases,
  coverage: auditSpriteManifest(POKEAPI_SPRITE_MANIFEST, coverageTargets),
  isolationSafe: true,
}

export const SHUFFLE_SOURCE: SpriteSourceDefinition = {
  id: 'shuffle',
  label: 'nileplumb Shuffle icons',
  homepage: 'https://github.com/nileplumb/PkmnShuffleMap',
  manifest: SHUFFLE_SPRITE_MANIFEST,
  formAliases: SPRITE_FORM_ALIASES as SpriteFormAliases,
  coverage: auditSpriteManifest(SHUFFLE_SPRITE_MANIFEST, coverageTargets),
  isolationSafe: true,
}

export const SPRITE_COVERAGE_TARGETS = coverageTargets
