#!/usr/bin/env node

/**
 * Standalone generator for a live-verified pokemondb.net sprite catalog.
 *
 * pokemondb.net serves a "home" sprite folder that uniformly covers all
 * national dex species (1-1025) plus many alternate forms, using its own
 * slug dialect that differs from PokeAPI's canonical form identifiers in
 * specific, learnable ways (region nouns become adjectives, some trailing
 * descriptor tokens get dropped, gender-diff base sprites use `-f` or
 * `-female` inconsistently per species). This script never guesses: every
 * claim below is confirmed against a live HTTP HEAD request before being
 * written to the generated output.
 *
 * CSV fetching/parsing conventions are duplicated from
 * scripts/generate-sprite-catalog.mjs on purpose -- this is a standalone
 * build script and importing across generator scripts isn't worth the
 * coupling.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(ROOT, 'src/services/sprites/generatedPokemonDb.ts')

const URLS = {
  pokemon:
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv',
  species:
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv',
  spriteTree:
    'https://api.github.com/repos/PokeAPI/sprites/git/trees/master?recursive=1',
}

const HOME_NORMAL = (slug) =>
  `https://img.pokemondb.net/sprites/home/normal/${slug}.png`
const HOME_SHINY = (slug) =>
  `https://img.pokemondb.net/sprites/home/shiny/${slug}.png`

const CONCURRENCY = 24
const REQUEST_TIMEOUT_MS = 15000

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText}: ${url}`)
  return response.text()
}

function csvRows(text) {
  return text
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.split(','))
}

function sortedNumbers(values) {
  return [...new Set(values)].sort((a, b) => a - b)
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

/**
 * Live HEAD-probe a URL, returning true only on a confirmed 200 and false
 * only on a confirmed 404/non-ok response. A single attempt against
 * img.pokemondb.net occasionally times out or resets under concurrency, so a
 * network-level failure (not an HTTP response) is retried a few times before
 * being treated as a real miss -- this generator must not report a species
 * or form as missing just because of a transient blip.
 */
async function probe(url, attempt = 0) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    })
    return response.ok
  } catch (error) {
    if (attempt < 3) {
      await sleep(250 * (attempt + 1))
      return probe(url, attempt + 1)
    }
    console.warn(`Network failure probing ${url} after retries: ${error}`)
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Run `worker` over `items` with bounded concurrency, preserving order. */
async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length)
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, run)
  )
  return results
}

// ---------------------------------------------------------------------------
// Fetch PokeAPI CSVs + sprite tree (the sprite tree is only used to recompute
// the exact same female/shiny-female pokeApiId sets that
// generate-sprite-catalog.mjs derives, so pokemondb's gender-diff probing is
// scoped to the same species that already have gender-diff art upstream).
// ---------------------------------------------------------------------------

console.log('Fetching PokeAPI CSVs + sprite tree...')
const [pokemonCsv, speciesCsv, treeText] = await Promise.all([
  fetchText(URLS.pokemon),
  fetchText(URLS.species),
  fetchText(URLS.spriteTree),
])

const treePaths = new Set(JSON.parse(treeText).tree.map(({ path }) => path))

const speciesNames = new Map(
  csvRows(speciesCsv)
    .filter(([id]) => Number(id) <= 1025)
    .map(([id, identifier]) => [Number(id), identifier])
)

const pokemonRows = csvRows(pokemonCsv)
  .map(([id, identifier, speciesId, , , , , isDefault]) => ({
    pokeApiId: Number(id),
    formId: identifier,
    nationalDex: Number(speciesId),
    isDefault: isDefault === '1',
  }))
  .filter(({ nationalDex }) => nationalDex <= 1025)

const pokeApiIdToNationalDex = new Map(
  pokemonRows.map(({ pokeApiId, nationalDex }) => [pokeApiId, nationalDex])
)

const pokeApiForms = pokemonRows.filter(({ isDefault }) => !isDefault)

const femalePokeApiIds = pokemonRows
  .filter(({ pokeApiId }) =>
    treePaths.has(`sprites/pokemon/female/${pokeApiId}.png`)
  )
  .map(({ pokeApiId }) => pokeApiId)
const shinyFemalePokeApiIds = pokemonRows
  .filter(({ pokeApiId }) =>
    treePaths.has(`sprites/pokemon/shiny/female/${pokeApiId}.png`)
  )
  .map(({ pokeApiId }) => pokeApiId)

const normalFemaleDex = new Set(
  femalePokeApiIds
    .map((id) => pokeApiIdToNationalDex.get(id))
    .filter((dex) => dex !== undefined)
)
const shinyFemaleDex = new Set(
  shinyFemalePokeApiIds
    .map((id) => pokeApiIdToNationalDex.get(id))
    .filter((dex) => dex !== undefined)
)
const femaleCandidateDex = sortedNumbers([
  ...normalFemaleDex,
  ...shinyFemaleDex,
])

// ---------------------------------------------------------------------------
// 1. Base species: verify home/normal + home/shiny for all national dex 1-1025.
// ---------------------------------------------------------------------------

console.log('Probing base species sprites (1-1025)...')
const baseIds = Array.from({ length: 1025 }, (_, index) => index + 1)

const baseResults = await mapWithConcurrency(baseIds, CONCURRENCY, async (dex) => {
  const slug = speciesNames.get(dex)
  const [normal, shiny] = await Promise.all([
    probe(HOME_NORMAL(slug)),
    probe(HOME_SHINY(slug)),
  ])
  return { dex, slug, normal, shiny }
})

const speciesSlugs = {}
const shinyDex = []
const missingBase = []
for (const { dex, slug, normal, shiny } of baseResults) {
  if (normal) {
    speciesSlugs[dex] = slug
    if (shiny) shinyDex.push(dex)
  } else {
    missingBase.push(dex)
  }
}

if (missingBase.length > 0) {
  console.warn(
    `WARNING: base sprite missing on pokemondb for ${missingBase.length} dex: ${missingBase.join(', ')}`
  )
}

// ---------------------------------------------------------------------------
// 2. Alternate forms: derive candidate slugs, probe live, keep first hit.
// ---------------------------------------------------------------------------

// Region nouns become adjectives on pokemondb (galar -> galarian, etc.), and
// separately "gmax" (PokeAPI's token) becomes "gigantamax" (confirmed live:
// venusaur-gigantamax, charizard-gigantamax, pikachu-gigantamax,
// urshifu-single-strike-gigantamax all 200; the plain "-gmax" spelling 404s
// for all of them).
const TOKEN_REPLACEMENTS = {
  galar: 'galarian',
  alola: 'alolan',
  hisui: 'hisuian',
  paldea: 'paldean',
  gmax: 'gigantamax',
}
// Trailing descriptor tokens pokemondb's slug simply omits. Confirmed live:
// tauros-paldean-combat-breed -> drop "breed"; squawkabilly-yellow-plumage ->
// drop "plumage"; ogerpon-wellspring-mask -> drop "mask" (ogerpon-wellspring
// / -hearthflame / -cornerstone are all 200 without "-mask").
const DROPPABLE_TRAILING_TOKENS = new Set(['plumage', 'breed', 'mask'])

function applyRegionAdjective(formId) {
  const tokens = formId.split('-')
  let changed = false
  const mapped = tokens.map((token) => {
    if (TOKEN_REPLACEMENTS[token]) {
      changed = true
      return TOKEN_REPLACEMENTS[token]
    }
    return token
  })
  return changed ? mapped.join('-') : formId
}

function dropTrailingDescriptor(formId) {
  const tokens = formId.split('-')
  const last = tokens[tokens.length - 1]
  if (tokens.length > 1 && DROPPABLE_TRAILING_TOKENS.has(last)) {
    return tokens.slice(0, -1).join('-')
  }
  return null
}

function formCandidates(formId) {
  const c1 = formId
  const c2 = applyRegionAdjective(c1)
  const c3a = dropTrailingDescriptor(c1)
  const c3b = dropTrailingDescriptor(c2)
  const ordered = [c1, c2, c3a, c3b].filter((value) => value !== null)
  return [...new Set(ordered)]
}

console.log(`Probing ${pokeApiForms.length} alternate form candidates...`)
const formResults = await mapWithConcurrency(
  pokeApiForms,
  CONCURRENCY,
  async ({ nationalDex, formId }) => {
    const candidates = formCandidates(formId)
    let winningSlug = null
    for (const candidate of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await probe(HOME_NORMAL(candidate))) {
        winningSlug = candidate
        break
      }
    }
    if (!winningSlug) {
      return { nationalDex, formId, slug: null, normal: false, shiny: false }
    }
    const shiny = await probe(HOME_SHINY(winningSlug))
    return { nationalDex, formId, slug: winningSlug, normal: true, shiny }
  }
)

const pokemonDbForms = formResults
  .filter((form) => form.normal)
  .map(({ nationalDex, formId, slug, normal, shiny }) => ({
    nationalDex,
    formId,
    slug,
    normal,
    shiny,
  }))
const unmappedForms = formResults.filter((form) => !form.normal)

// ---------------------------------------------------------------------------
// 3. Base-species gender-diff sprites (`-f` vs `-female`), scoped to species
//    already known to have gender-diff art upstream.
// ---------------------------------------------------------------------------

console.log(
  `Probing gender-diff suffixes for ${femaleCandidateDex.length} species...`
)
const femaleSuffixes = ['-f', '-female']

const femaleResults = await mapWithConcurrency(
  femaleCandidateDex,
  CONCURRENCY,
  async (dex) => {
    const slug = speciesSlugs[dex]
    if (!slug) return { dex, normal: false, shiny: false, suffix: null }

    const isNormalTarget = normalFemaleDex.has(dex)
    const isShinyTarget = shinyFemaleDex.has(dex)

    let winningSuffix = null
    if (isNormalTarget) {
      for (const suffix of femaleSuffixes) {
        // eslint-disable-next-line no-await-in-loop
        if (await probe(HOME_NORMAL(`${slug}${suffix}`))) {
          winningSuffix = suffix
          break
        }
      }
    }

    let shinyOk = false
    let shinySuffix = null
    if (isShinyTarget) {
      if (winningSuffix) {
        shinyOk = await probe(HOME_SHINY(`${slug}${winningSuffix}`))
        shinySuffix = winningSuffix
      } else {
        for (const suffix of femaleSuffixes) {
          // eslint-disable-next-line no-await-in-loop
          if (await probe(HOME_SHINY(`${slug}${suffix}`))) {
            shinyOk = true
            shinySuffix = suffix
            break
          }
        }
      }
    }

    return {
      dex,
      normal: Boolean(winningSuffix),
      shiny: shinyOk,
      suffix: winningSuffix ?? shinySuffix,
    }
  }
)

const femaleDex = []
const shinyFemaleDexOut = []
const femaleSuffixMap = {}
for (const { dex, normal, shiny, suffix } of femaleResults) {
  if (normal) femaleDex.push(dex)
  if (shiny) shinyFemaleDexOut.push(dex)
  if ((normal || shiny) && suffix === '-female') femaleSuffixMap[dex] = suffix
}

// ---------------------------------------------------------------------------
// Emit output
// ---------------------------------------------------------------------------

const header = `/**
 * Generated by scripts/generate-pokemondb-catalog.mjs.
 *
 * Inputs: PokeAPI's pokemon/species CSVs + sprites tree (for scoping which
 * species have gender-diff art upstream) and live HTTP verification against
 * img.pokemondb.net's "home" sprite folder, which covers all national dex
 * species (1-1025) plus many alternate forms. Every slug here is confirmed
 * with a live request -- nothing is guessed. Do not hand-edit this file.
 */\n\n`
const emit = (name, value) =>
  `export const ${name} = ${JSON.stringify(value, null, 2)} as const\n\n`

const output =
  header +
  emit('POKEMONDB_SPECIES_SLUGS', speciesSlugs) +
  emit('POKEMONDB_SHINY_DEX', sortedNumbers(shinyDex)) +
  emit('POKEMONDB_FORMS', pokemonDbForms) +
  emit('POKEMONDB_FEMALE_IDS', sortedNumbers(femaleDex)) +
  emit('POKEMONDB_SHINY_FEMALE_IDS', sortedNumbers(shinyFemaleDexOut)) +
  emit('POKEMONDB_FEMALE_SUFFIX', femaleSuffixMap)

await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, output)
console.log(`Wrote ${OUTPUT}`)
console.log(
  `Base: ${Object.keys(speciesSlugs).length}/1025, shiny: ${shinyDex.length}/1025`
)
console.log(
  `Forms: ${pokemonDbForms.length}/${pokeApiForms.length} available (${unmappedForms.length} unmapped)`
)
console.log(
  `Female: ${femaleDex.length}/${femaleCandidateDex.length}, shinyFemale: ${shinyFemaleDexOut.length}`
)
if (missingBase.length > 0) {
  console.warn(`Missing base dex: ${missingBase.join(', ')}`)
}
if (unmappedForms.length > 0) {
  console.log(
    `Unmapped forms: ${unmappedForms.map((f) => f.formId).join(', ')}`
  )
}
