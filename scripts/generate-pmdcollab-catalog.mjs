#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generatePortraitCredits } from './generate-portrait-credits.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(ROOT, 'src/services/sprites/generatedPmdCollab.ts')

const URLS = {
  tracker:
    'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/tracker.json',
  pokemon:
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv',
  species:
    'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv',
  formIcons:
    'https://raw.githubusercontent.com/MercuryEnigma/ribbon-helper/main/src/data/form_icons.json',
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

// Copied verbatim from scripts/generate-sprite-catalog.mjs — keep in sync by
// hand if that script's version changes; duplication across standalone
// generators is intentional here.
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

const [trackerText, pokemonCsv, speciesCsv, formIconsText] = await Promise.all([
  fetchText(URLS.tracker),
  fetchText(URLS.pokemon),
  fetchText(URLS.species),
  fetchText(URLS.formIcons),
])

const tracker = JSON.parse(trackerText)
const formIcons = JSON.parse(formIconsText)

const speciesNames = new Map(
  csvRows(speciesCsv)
    .filter(([id]) => Number(id) <= 1025)
    .map(([id, identifier]) => [Number(id), identifier])
)

const pokemonRows = csvRows(pokemonCsv)
  .map(([id, identifier, speciesId]) => ({
    pokeApiId: Number(id),
    formId: identifier,
    nationalDex: Number(speciesId),
  }))
  .filter(({ nationalDex }) => nationalDex <= 1025)

const shuffleForms = Object.entries(formIcons).map(([formId, file]) => ({
  formId,
  nationalDex: Number.parseInt(file, 10),
}))

// Union of every canonical formId string PokeAPI or PkmnShuffleMap knows
// about for each species — the match targets for formCandidates().
const formIdsBySpecies = new Map()
for (const { nationalDex, formId } of pokemonRows) {
  if (!formIdsBySpecies.has(nationalDex))
    formIdsBySpecies.set(nationalDex, new Set())
  formIdsBySpecies.get(nationalDex).add(formId)
}
for (const { nationalDex, formId } of shuffleForms) {
  if (!formIdsBySpecies.has(nationalDex))
    formIdsBySpecies.set(nationalDex, new Set())
  formIdsBySpecies.get(nationalDex).add(formId)
}

// --- tracker.json tree walking -------------------------------------------

function findChild(node, name) {
  if (!node?.subgroups) return null
  for (const [key, child] of Object.entries(node.subgroups)) {
    if (child.name === name) return { key, node: child }
  }
  return null
}

function hasArt(node) {
  return !!node && node.canon !== false && (node.portrait_complete ?? 0) > 0
}

const baseDex = []
const shinyDex = []
const forms = []
const shinyForms = []
const female = []
const shinyFemale = []
const male = []
const shinyMale = []

let namedFormsFound = 0
let namedFormsMatched = 0
let speciesMissingFromTracker = []

for (let dex = 1; dex <= 1025; dex += 1) {
  const dex4 = String(dex).padStart(4, '0')
  const topNode = tracker[dex4]
  if (!topNode) {
    speciesMissingFromTracker.push(dex)
    continue
  }

  // Base (default form, no shiny, no gender) lives at the species root.
  if (hasArt(topNode)) baseDex.push(dex)

  // Default form's own wrapper node — always key "0000" — holds the
  // shiny and (via an empty-name wrapper) gender branches for the base form.
  const defaultFormNode = topNode.subgroups?.['0000']
  if (defaultFormNode) {
    const shinyChild = findChild(defaultFormNode, 'Shiny')
    if (shinyChild && hasArt(shinyChild.node)) {
      shinyDex.push(dex)
      for (const [genderName, bucket] of [
        ['Female', shinyFemale],
        ['Male', shinyMale],
      ]) {
        const genderChild = findChild(shinyChild.node, genderName)
        if (genderChild && hasArt(genderChild.node)) {
          bucket.push({
            nationalDex: dex,
            path: `0000/${shinyChild.key}/${genderChild.key}/Normal.png`,
          })
        }
      }
    }

    const emptyChild = findChild(defaultFormNode, '')
    if (emptyChild) {
      for (const [genderName, bucket] of [
        ['Female', female],
        ['Male', male],
      ]) {
        const genderChild = findChild(emptyChild.node, genderName)
        if (genderChild && hasArt(genderChild.node)) {
          bucket.push({
            nationalDex: dex,
            path: `0000/${emptyChild.key}/${genderChild.key}/Normal.png`,
          })
        }
      }
    }
  }

  // Named forms: every other canon:true, named depth-1 node.
  const speciesSlug = speciesNames.get(dex)
  const knownFormIds = formIdsBySpecies.get(dex) ?? new Set()
  for (const [key, node] of Object.entries(topNode.subgroups ?? {})) {
    if (key === '0000') continue
    if (node.canon === false) continue
    if (!node.name) continue // blank-name internal wrapper, not a real form

    namedFormsFound += 1
    const candidates = speciesSlug ? formCandidates(speciesSlug, node.name) : []
    const formId = [...candidates].find((candidate) =>
      knownFormIds.has(candidate)
    )
    if (!formId) continue // unmatched SpriteCollab-internal category, drop
    namedFormsMatched += 1

    if (hasArt(node)) {
      forms.push({ nationalDex: dex, formId, path: `${key}/Normal.png` })
    }

    const shinyChild = findChild(node, 'Shiny')
    if (shinyChild && hasArt(shinyChild.node)) {
      shinyForms.push({
        nationalDex: dex,
        formId,
        path: `${key}/${shinyChild.key}/Normal.png`,
      })
      for (const [genderName, bucket] of [
        ['Female', shinyFemale],
        ['Male', shinyMale],
      ]) {
        const genderChild = findChild(shinyChild.node, genderName)
        if (genderChild && hasArt(genderChild.node)) {
          bucket.push({
            nationalDex: dex,
            formId,
            path: `${key}/${shinyChild.key}/${genderChild.key}/Normal.png`,
          })
        }
      }
    }

    const emptyChild = findChild(node, '')
    if (emptyChild) {
      for (const [genderName, bucket] of [
        ['Female', female],
        ['Male', male],
      ]) {
        const genderChild = findChild(emptyChild.node, genderName)
        if (genderChild && hasArt(genderChild.node)) {
          bucket.push({
            nationalDex: dex,
            formId,
            path: `${key}/${emptyChild.key}/${genderChild.key}/Normal.png`,
          })
        }
      }
    }
  }
}

const header = `/**
 * Generated by scripts/generate-pmdcollab-catalog.mjs.
 *
 * Inputs: PMDCollab/SpriteCollab's tracker.json (art-completion tree,
 * ~10MB, fetched live and walked structurally — never hand-guessed), plus
 * PokeAPI's pokemon/species CSVs and Ribbon Helper's form_icons.json used
 * only as the canonical-formId match targets for tracker.json's
 * human-readable form names (via formCandidates(), copied verbatim from
 * scripts/generate-sprite-catalog.mjs).
 *
 * Gender variants: tracker.json rarely has a "Male" node (nearly always
 * "Female"), so both are captured generically and emitted as parallel
 * FEMALE/SHINY_FEMALE and MALE/SHINY_MALE arrays rather than folding a
 * gender field into one array — this keeps each array's shape identical
 * to POKEAPI_FEMALE_IDS-style conventions elsewhere in this codebase.
 * formId is omitted on an entry for the species' own default-form gender
 * variant, and present when the variant is nested under a named form
 * (e.g. Hisuian Sneasel's shiny female, nationalDex 215, formId
 * "sneasel-hisui", in PMDCOLLAB_SHINY_FEMALE).
 *
 * Do not hand-edit this file.
 */\n\n`
const emit = (name, value) =>
  `export const ${name} = ${JSON.stringify(value, null, 2)} as const\n\n`
const output =
  header +
  emit('PMDCOLLAB_BASE_DEX', sortedNumbers(baseDex)) +
  emit('PMDCOLLAB_SHINY_DEX', sortedNumbers(shinyDex)) +
  emit('PMDCOLLAB_FORMS', forms) +
  emit('PMDCOLLAB_SHINY_FORMS', shinyForms) +
  emit('PMDCOLLAB_FEMALE', female) +
  emit('PMDCOLLAB_SHINY_FEMALE', shinyFemale) +
  emit('PMDCOLLAB_MALE', male) +
  emit('PMDCOLLAB_SHINY_MALE', shinyMale)

await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, output)
console.log(`Wrote ${OUTPUT}`)
if (speciesMissingFromTracker.length) {
  console.log(
    `Species missing from tracker.json: ${speciesMissingFromTracker.join(', ')}`
  )
}
console.log(
  `PMDCollab: base ${baseDex.length}/1025, shiny ${shinyDex.length}, ` +
    `forms matched ${namedFormsMatched} (of ${namedFormsFound} canon named forms found in the tree), ` +
    `female ${female.length}, shinyFemale ${shinyFemale.length}, ` +
    `male ${male.length}, shinyMale ${shinyMale.length}`
)

await generatePortraitCredits(
  tracker,
  await fetchText(
    'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/credit_names.txt'
  )
)
