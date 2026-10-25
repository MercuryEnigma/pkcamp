import type { PokedexDataset, PokedexSpecies } from './types'

export function getSpecies(
  dataset: PokedexDataset,
  nationalDexNumber: number
): PokedexSpecies | undefined {
  return dataset.species[nationalDexNumber]
}

export function getEvolutionFamily(
  dataset: PokedexDataset,
  nationalDexNumber: number
): PokedexSpecies[] {
  const family = new Set<number>([nationalDexNumber])
  let changed = true
  while (changed) {
    changed = false
    for (const species of Object.values(dataset.species)) {
      const related =
        species.evolutions.to.some((edge) =>
          family.has(edge.nationalDexNumber)
        ) || species.evolutions.from.some((id) => family.has(id))
      if (!related || family.has(species.nationalDexNumber)) continue
      family.add(species.nationalDexNumber)
      changed = true
    }
  }
  return [...family]
    .sort((a, b) => a - b)
    .map((id) => dataset.species[id])
    .filter((species): species is PokedexSpecies => Boolean(species))
}

export function getEncounters(
  dataset: PokedexDataset,
  nationalDexNumber: number
) {
  return dataset.species[nationalDexNumber]?.encounters ?? []
}

export function getLocation(dataset: PokedexDataset, mapId: string) {
  return (dataset.locations[mapId] ?? [])
    .map((id) => dataset.species[id])
    .filter((species): species is PokedexSpecies => Boolean(species))
}

export function searchSpecies(dataset: PokedexDataset, query: string) {
  const needle = query.trim().toLocaleLowerCase()
  const all = Object.values(dataset.species)
  if (!needle) return all
  return all.filter(
    (species) =>
      species.name.toLocaleLowerCase().includes(needle) ||
      String(species.nationalDexNumber).includes(needle)
  )
}

export interface EvolutionFamilyEdge {
  from: PokedexSpecies
  to: PokedexSpecies
  method: string
  parameter: number | string | null
}

/** All branches, ordered from the earliest stage, including baby Pokémon. */
export function getEvolutionFamilyEdges(
  dataset: PokedexDataset,
  nationalDexNumber: number
): EvolutionFamilyEdge[] {
  const family = getEvolutionFamily(dataset, nationalDexNumber)
  const ids = new Set(family.map((species) => species.nationalDexNumber))
  const edges: EvolutionFamilyEdge[] = []
  const visited = new Set<number>()
  const visit = (species: PokedexSpecies) => {
    if (visited.has(species.nationalDexNumber)) return
    visited.add(species.nationalDexNumber)
    for (const edge of species.evolutions.to) {
      const target = dataset.species[edge.nationalDexNumber]
      if (!target || !ids.has(target.nationalDexNumber)) continue
      edges.push({
        from: species,
        to: target,
        method: edge.method,
        parameter: edge.parameter,
      })
      visit(target)
    }
  }
  for (const species of family.filter(
    (entry) => !entry.evolutions.from.some((id) => ids.has(id))
  ))
    visit(species)
  for (const species of family) visit(species) // Also bounds cycles in custom tables.
  return edges
}

export interface InheritedEggMove {
  move: PokedexSpecies['learnsets']['egg'][number]
  hatchedAs: number[]
}

/** Evolved species can retain the egg moves of any earlier evolution stage. */
export function getEggMoves(
  dataset: PokedexDataset,
  nationalDexNumber: number
): InheritedEggMove[] {
  const result = new Map<number, InheritedEggMove>()
  const visited = new Set<number>()
  const visit = (id: number) => {
    if (visited.has(id)) return
    visited.add(id)
    const species = dataset.species[id]
    if (!species) return
    for (const previous of species.evolutions.from) visit(previous)
    for (const move of species.learnsets.egg) {
      const existing = result.get(move.romId)
      if (existing) existing.hatchedAs.push(id)
      else result.set(move.romId, { move, hatchedAs: [id] })
    }
  }
  visit(nationalDexNumber)
  return [...result.values()]
}

const UNBREEDABLE_EGG_GROUPS = new Set(['Undiscovered', 'Ditto'])

function breedableEggGroups(species: PokedexSpecies) {
  return species.breeding.eggGroups.filter(
    (group) => !UNBREEDABLE_EGG_GROUPS.has(group)
  )
}

/**
 * Male species that can pass an egg move to one of the listed hatch species.
 * Earlier-stage learnsets count because a Pokémon can retain a move after
 * evolving. Baby Pokémon use the first breedable stage in their family.
 */
export function getEggMoveFathers(
  dataset: PokedexDataset,
  moveRomId: number,
  hatchedAs: readonly number[]
): PokedexSpecies[] {
  const recipientGroups = new Set<string>()
  for (const hatchId of hatchedAs) {
    const seen = new Set<number>()
    let frontier = [hatchId]
    while (frontier.length) {
      const next: number[] = []
      let foundBreedableStage = false
      for (const id of frontier) {
        if (seen.has(id)) continue
        seen.add(id)
        const species = dataset.species[id]
        if (!species) continue
        const groups = breedableEggGroups(species)
        if (groups.length && species.breeding.genderRatio !== 255) {
          groups.forEach((group) => recipientGroups.add(group))
          foundBreedableStage = true
        }
        species.evolutions.to.forEach((edge) =>
          next.push(edge.nationalDexNumber)
        )
      }
      if (foundBreedableStage) break
      frontier = next
    }
  }

  const canKnowMove = (id: number, seen = new Set<number>()): boolean => {
    if (seen.has(id)) return false
    seen.add(id)
    const species = dataset.species[id]
    if (!species) return false
    if (
      species.nationalDexNumber === 235 ||
      [
        ...species.learnsets.levelUp.map((entry) => entry.move),
        ...species.learnsets.egg,
        ...species.learnsets.tmHm,
        ...species.learnsets.tutor,
      ].some((move) => move.romId === moveRomId)
    )
      return true
    return species.evolutions.from.some((previous) =>
      canKnowMove(previous, new Set(seen))
    )
  }

  return Object.values(dataset.species)
    .filter((species) => {
      const ratio = species.breeding.genderRatio
      if (ratio === null || ratio === 254 || ratio === 255) return false
      if (
        !breedableEggGroups(species).some((group) => recipientGroups.has(group))
      )
        return false
      return canKnowMove(species.nationalDexNumber)
    })
    .sort((a, b) => a.nationalDexNumber - b.nationalDexNumber)
}
