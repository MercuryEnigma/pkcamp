#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(ROOT, 'src/services/sprites/generatedCatalog.ts')
const PKHEX_FORMS = resolve(ROOT, 'scripts/data/pkhex-form-names.json')

const URLS = {
  pokemonImages:
    'https://raw.githubusercontent.com/MercuryEnigma/ribbon-helper/main/src/data/pokemon_images.json',
  formIcons:
    'https://raw.githubusercontent.com/MercuryEnigma/ribbon-helper/main/src/data/form_icons.json',
  shuffleIndex:
    'https://raw.githubusercontent.com/nileplumb/PkmnShuffleMap/master/UICONS/index.json',
  pokemon:
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv',
  species:
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv',
  spriteTree:
    'https://api.github.com/repos/PokeAPI/sprites/git/trees/master?recursive=1',
}

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
  return [...values].sort((a, b) => a - b)
}

function normalize(value) {
  return value
    .toLowerCase()
    .replaceAll('♀', 'female')
    .replaceAll('♂', 'male')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formCandidates(species, label) {
  const slug = normalize(label)
  const candidates = new Set([`${species}-${slug}`])
  const replacements = {
    f: 'female',
    m: 'male',
    alola: 'alola',
    galar: 'galar',
    hisui: 'hisui',
    paldea: 'paldea',
    jumbo: 'super',
    'noice-face': 'noice',
    'family-of-four': 'family-of-three',
  }
  if (replacements[slug]) candidates.add(`${species}-${replacements[slug]}`)
  if (
    species === 'pikachu' &&
    [
      'original',
      'hoenn',
      'sinnoh',
      'unova',
      'kalos',
      'alola',
      'partner',
      'world',
    ].includes(slug)
  ) {
    candidates.add(`${species}-${slug}-cap`)
  }
  if (species === 'tauros' && slug.startsWith('paldea-'))
    candidates.add(`${species}-${slug}-breed`)
  if (species === 'basculin' && ['blue', 'white'].includes(slug))
    candidates.add(`${species}-${slug}-striped`)
  if (species === 'squawkabilly' && ['blue', 'yellow', 'white'].includes(slug))
    candidates.add(`${species}-${slug}-plumage`)
  if (species === 'ogerpon' && !slug.startsWith('teal'))
    candidates.add(`${species}-${slug.replace(/^\*/, '')}-mask`)
  if (species === 'koraidon') candidates.add(`${species}-${slug}-build`)
  if (species === 'miraidon') candidates.add(`${species}-${slug}-mode`)
  if (species === 'minior') {
    candidates.add(`${species}-${slug.replace(/^m-/, '')}-meteor`)
    candidates.add(`${species}-${slug.replace(/^c-/, '')}`)
  }
  if (species === 'zygarde')
    candidates.add(`${species}-${slug.replace('-c', '-power-construct')}`)
  return candidates
}

const [
  pokemonImagesText,
  formIconsText,
  shuffleIndexText,
  pokemonCsv,
  speciesCsv,
  treeText,
  pkhexText,
] = await Promise.all([
  fetchText(URLS.pokemonImages),
  fetchText(URLS.formIcons),
  fetchText(URLS.shuffleIndex),
  fetchText(URLS.pokemon),
  fetchText(URLS.species),
  fetchText(URLS.spriteTree),
  readFile(PKHEX_FORMS, 'utf8'),
])

const pokemonImages = JSON.parse(pokemonImagesText)
const formIcons = JSON.parse(formIconsText)
const shuffleFiles = new Set(JSON.parse(shuffleIndexText).pokemon)
const treePaths = new Set(JSON.parse(treeText).tree.map(({ path }) => path))
const pkhexForms = JSON.parse(pkhexText)

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

const baseIds = Array.from({ length: 1025 }, (_, index) => index + 1)
for (const id of baseIds) {
  if (!treePaths.has(`sprites/pokemon/${id}.png`))
    throw new Error(`PokeAPI base sprite missing: ${id}`)
  if (!treePaths.has(`sprites/pokemon/shiny/${id}.png`))
    throw new Error(`PokeAPI shiny sprite missing: ${id}`)
  if (!shuffleFiles.has(`${id}.png`))
    throw new Error(`Shuffle base icon missing: ${id}`)
  if (!(speciesNames.get(id) in pokemonImages))
    throw new Error(
      `Ribbon Helper base mapping missing: ${speciesNames.get(id)}`
    )
}

const pokeApiForms = pokemonRows
  .filter(({ isDefault }) => !isDefault)
  .map(({ pokeApiId, formId, nationalDex }) => ({
    nationalDex,
    formId,
    pokeApiId,
    normal: treePaths.has(`sprites/pokemon/${pokeApiId}.png`),
    shiny: treePaths.has(`sprites/pokemon/shiny/${pokeApiId}.png`),
    female: treePaths.has(`sprites/pokemon/female/${pokeApiId}.png`),
    shinyFemale: treePaths.has(`sprites/pokemon/shiny/female/${pokeApiId}.png`),
  }))

const pokeApiImageNames = new Set(Object.keys(pokemonImages))
const ribbonHelperFormDifferences = []
for (const form of pokeApiForms) {
  if (pokeApiImageNames.has(form.formId)) {
    const mappedId = Number(
      pokemonImages[form.formId].match(/\/(\d+)\.png$/)?.[1]
    )
    if (mappedId !== form.pokeApiId) {
      ribbonHelperFormDifferences.push({
        formId: form.formId,
        ribbonHelperPokeApiId: mappedId,
        canonicalPokeApiId: form.pokeApiId,
      })
    }
    continue
  }
  // Newly added PokeAPI forms can lead the older Ribbon Helper snapshot. They
  // remain in the catalog and are marked unavailable when the sprites repo
  // does not contain an asset yet.
}

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

const shuffleShinySpecies = baseIds.filter((id) =>
  shuffleFiles.has(`${id}_s.png`)
)
const shuffleFemaleSpecies = baseIds.filter((id) =>
  shuffleFiles.has(`${id}_g2.png`)
)
const shuffleShinyFemaleSpecies = baseIds.filter((id) =>
  shuffleFiles.has(`${id}_g2_s.png`)
)
const shuffleForms = Object.entries(formIcons).map(([formId, file]) => {
  const nationalDex = Number.parseInt(file, 10)
  const shinyFile = file.replace(/\.png$/, '_s.png')
  return {
    nationalDex,
    formId,
    file,
    normal: shuffleFiles.has(file),
    shinyFile,
    shiny: shuffleFiles.has(shinyFile),
  }
})

const formLabelsBySpecies = {}
for (const formsBySpecies of Object.values(pkhexForms)) {
  for (const [speciesIdText, labels] of Object.entries(formsBySpecies)) {
    const byIndex = (formLabelsBySpecies[speciesIdText] ??= {})
    for (let index = 1; index < labels.length; index += 1) {
      ;(byIndex[index] ??= new Set()).add(labels[index])
    }
  }
}

const formAliases = {}
for (const [speciesIdText, labelsByIndex] of Object.entries(
  formLabelsBySpecies
)) {
  const nationalDex = Number(speciesIdText)
  const species = speciesNames.get(nationalDex)
  const formIds = new Set([
    ...pokeApiForms
      .filter((form) => form.nationalDex === nationalDex)
      .map((form) => form.formId),
    ...shuffleForms
      .filter((form) => form.nationalDex === nationalDex)
      .map((form) => form.formId),
  ])
  for (const [index, labels] of Object.entries(labelsByIndex)) {
    const matches = new Set()
    let everyLabelMapped = true
    for (const label of labels) {
      const match = [...formCandidates(species, label)].find((candidate) =>
        formIds.has(candidate)
      )
      if (match) matches.add(match)
      else everyLabelMapped = false
    }
    // Numeric form indexes are only aliases when every game context that maps
    // the index to known art agrees. Canonical string ids cover ambiguous cases.
    if (matches.size === 1 && (labels.size === 1 || everyLabelMapped))
      (formAliases[nationalDex] ??= {})[index] = [...matches][0]
  }
}

const header = `/**
 * Generated by scripts/generate-sprite-catalog.mjs.
 *
 * Inputs: Ribbon Helper pokemon_images.json + form_icons.json, PokeAPI's
 * pokemon/species CSVs + sprites tree, and PkmnShuffleMap's UICONS index.
 * Do not hand-edit this file.
 */\n\n`
const emit = (name, value) =>
  `export const ${name} = ${JSON.stringify(value, null, 2)} as const\n\n`
const output =
  header +
  emit('POKEAPI_FORMS', pokeApiForms) +
  emit('RIBBON_HELPER_FORM_DIFFERENCES', ribbonHelperFormDifferences) +
  emit('POKEAPI_FEMALE_IDS', sortedNumbers(femalePokeApiIds)) +
  emit('POKEAPI_SHINY_FEMALE_IDS', sortedNumbers(shinyFemalePokeApiIds)) +
  emit('SHUFFLE_SHINY_SPECIES', shuffleShinySpecies) +
  emit('SHUFFLE_FEMALE_SPECIES', shuffleFemaleSpecies) +
  emit('SHUFFLE_SHINY_FEMALE_SPECIES', shuffleShinyFemaleSpecies) +
  emit('SHUFFLE_FORMS', shuffleForms) +
  emit('SPRITE_FORM_ALIASES', formAliases)

await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, output)
console.log(`Wrote ${OUTPUT}`)
console.log(
  `PokeAPI: 1025 base, 1025 shiny, ${pokeApiForms.filter((f) => f.normal).length}/${pokeApiForms.length} forms`
)
console.log(
  `Shuffle: 1025 base, ${shuffleShinySpecies.length} shiny, ${shuffleForms.filter((f) => f.normal).length}/${shuffleForms.length} named forms`
)
