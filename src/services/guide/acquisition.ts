import type { PokedexDataset, PokedexEncounter, PokedexSpecies } from './types'

export type AcquisitionStep =
  | {
      kind: 'evolve'
      from: number
      to: number
      method: string
      parameter: number | string | null
    }
  | {
      kind: 'breed'
      from: number
      to: number
      partner: 'ditto' | 'compatible-or-ditto'
      incenseItemId?: number
      excludeIncenseItemId?: number
      mixedOffspring?: boolean
    }

export interface AcquisitionRoute {
  source: number
  encounters: PokedexEncounter[]
  /** Chronological steps after obtaining the source Pokémon. */
  steps: AcquisitionStep[]
}

/** Gen III breeding rules, applied only to mapped species and readable egg groups. */
function breedingSteps(
  dataset: PokedexDataset,
  target: number
): AcquisitionStep[] {
  const bases = new Map<number, number | null>()
  const base = (id: number, seen = new Set<number>()): number | null => {
    if (bases.has(id)) return bases.get(id)!
    if (seen.has(id)) return null
    const species = dataset.species[id]
    if (!species || species.evolutions.from.length > 1) return null
    const root = species.evolutions.from.length
      ? base(species.evolutions.from[0], new Set([...seen, id]))
      : id
    bases.set(id, root)
    return root
  }
  const steps: AcquisitionStep[] = []
  for (const parent of Object.values(dataset.species)) {
    const { eggGroups, genderRatio } = parent.breeding
    if (
      !eggGroups.length ||
      eggGroups.some(
        (group) => group === 'Undiscovered' || group === 'Ditto'
      ) ||
      genderRatio === null
    )
      continue
    const root = base(parent.nationalDexNumber)
    if (root === null) continue
    let offspring = root
    const incense = root === 298 ? 220 : root === 360 ? 221 : undefined
    if (incense) offspring = target === root ? root : root === 298 ? 183 : 202
    const mixedOffspring =
      (root === 29 && (target === 29 || target === 32)) ||
      (root === 314 && (target === 313 || target === 314))
    if (offspring !== target && !mixedOffspring) continue
    steps.push({
      kind: 'breed',
      from: parent.nationalDexNumber,
      to: target,
      partner:
        genderRatio === 0 || genderRatio === 255
          ? 'ditto'
          : 'compatible-or-ditto',
      ...(incense
        ? target === root
          ? { incenseItemId: incense }
          : { excludeIncenseItemId: incense }
        : {}),
      ...(mixedOffspring ? { mixedOffspring: true } : {}),
    })
  }
  return steps
}

/**
 * Prefer wild sources. When none are known, still show direct evolution or
 * breeding methods without claiming that an unparsed gift is a wild location.
 */
export function getAcquisitionRoutes(
  dataset: PokedexDataset,
  nationalDexNumber: number
): AcquisitionRoute[] {
  const selected = dataset.species[nationalDexNumber]
  if (!selected) return []
  const stepCache = new Map<number, AcquisitionStep[]>()
  const stepsFor = (species: PokedexSpecies): AcquisitionStep[] => {
    const id = species.nationalDexNumber
    const cached = stepCache.get(id)
    if (cached) return cached
    const steps: AcquisitionStep[] = []
    for (const from of species.evolutions.from) {
      for (const edge of dataset.species[from]?.evolutions.to ?? []) {
        if (edge.nationalDexNumber === id)
          steps.push({
            kind: 'evolve',
            from,
            to: id,
            method: edge.method,
            parameter: edge.parameter,
          })
      }
    }
    steps.push(...breedingSteps(dataset, id))
    stepCache.set(id, steps)
    return steps
  }
  const resolve = (
    species: PokedexSpecies,
    seen: Set<number>
  ): AcquisitionRoute[] => {
    const id = species.nationalDexNumber
    if (seen.has(id) || seen.size > 8) return []
    if (species.encounters.length)
      return [{ source: id, encounters: species.encounters, steps: [] }]
    const next = new Set([...seen, id])
    const routes: AcquisitionRoute[] = []
    for (const step of stepsFor(species)) {
      const source = dataset.species[step.from]
      if (!source) continue
      for (const route of resolve(source, next))
        routes.push({ ...route, steps: [...route.steps, step] })
    }
    return routes
      .sort((a, b) => a.steps.length - b.steps.length || a.source - b.source)
      .slice(0, 12)
  }
  const known = resolve(selected, new Set())
  const routes = known.length
    ? known
    : stepsFor(selected).map((step) => ({
        source: step.from,
        encounters: [],
        steps: [step],
      }))
  const unique = new Map<string, AcquisitionRoute>()
  for (const route of routes)
    unique.set(`${route.source}:${JSON.stringify(route.steps)}`, route)
  return [...unique.values()].slice(0, 12)
}
