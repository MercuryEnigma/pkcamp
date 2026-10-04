import type { PokemonNode, PokemonSaveAdapter } from '../../services/pkhex'
import {
  CAMP_SITE_SIZE,
  DEFAULT_CAMP_SITE_COUNT,
  type Camp,
  type CampPokemon,
  type CampPosition,
} from '../../services/storage'

export const MIN_CAMP_SITE_COUNT = 1
/** Upper bound for the site-count setting; a typo must not allocate millions of positions. */
export const MAX_CAMP_SITE_COUNT = 1000
export { CAMP_SITE_SIZE, DEFAULT_CAMP_SITE_COUNT }

/** Camp Sites flattened to one array, where index = site × 30 + slot. */
export function flattenCamp<T>(sites: readonly (readonly T[])[]): T[] {
  return sites.flat()
}

/** Splits a flat array back into complete 30-position Camp Sites. */
export function sitesFromFlat<T>(flat: readonly (T | null)[]): (T | null)[][] {
  const sites: (T | null)[][] = []
  for (let start = 0; start < flat.length; start += CAMP_SITE_SIZE) {
    const site = flat.slice(start, start + CAMP_SITE_SIZE)
    while (site.length < CAMP_SITE_SIZE) site.push(null)
    sites.push(site)
  }
  return sites
}

export function positionOf(flatIndex: number): CampPosition {
  return {
    site: Math.floor(flatIndex / CAMP_SITE_SIZE),
    index: flatIndex % CAMP_SITE_SIZE,
  }
}

export function flatIndexOf(position: CampPosition): number {
  return position.site * CAMP_SITE_SIZE + position.index
}

/** Fewest Camp Sites that keep every occupied position: last occupied + 1. */
export function minimumCampSiteCount(
  sites: readonly (readonly unknown[])[]
): number {
  let last = -1
  for (const [site, positions] of sites.entries()) {
    if (positions.some((pokemon) => pokemon != null)) last = site
  }
  return Math.max(MIN_CAMP_SITE_COUNT, last + 1)
}

/**
 * Returns `sites` with exactly `requestedCount` sites, never fewer than
 * `minimumCampSiteCount`. Pokémon never move: removed sites are empty.
 */
export function resizeCampSites<T>(
  sites: readonly (readonly (T | null)[])[],
  requestedCount: number
): (T | null)[][] {
  const minimum = minimumCampSiteCount(sites)
  const count = Math.max(
    Number.isSafeInteger(requestedCount)
      ? Math.min(requestedCount, MAX_CAMP_SITE_COUNT)
      : DEFAULT_CAMP_SITE_COUNT,
    minimum
  )
  return Array.from({ length: count }, (_, index) =>
    sites[index]
      ? [...sites[index]]
      : new Array<T | null>(CAMP_SITE_SIZE).fill(null)
  )
}

/**
 * First empty position in `preferredSite`, else the first empty position
 * anywhere, else null when every Camp Site is full.
 */
export function firstEmptyPosition(
  sites: readonly (readonly unknown[])[],
  preferredSite: number
): CampPosition | null {
  const inSite = sites[preferredSite]?.indexOf(null) ?? -1
  if (inSite >= 0) return { site: preferredSite, index: inSite }
  for (const [site, positions] of sites.entries()) {
    const index = positions.indexOf(null)
    if (index >= 0) return { site, index }
  }
  return null
}

export function isSamePosition(
  left: CampPosition | null,
  right: CampPosition | null
): boolean {
  return left?.site === right?.site && left?.index === right?.index
}

/** A stored Camp Pokémon together with its parsed form. */
export interface CampEntry {
  file: CampPokemon
  pokemon: PokemonNode
}

/** A Camp as flat entries (index = site × 30 + slot) plus unreadable files. */
export interface LoadedCamp {
  entries: (CampEntry | null)[]
  /** Files the adapter could not parse, by flat index. Kept on save. */
  unreadable: Map<number, CampPokemon>
}

export function loadCampEntries(
  camp: Camp,
  adapter: PokemonSaveAdapter
): LoadedCamp {
  const flat = flattenCamp(camp.sites)
  const unreadable = new Map<number, CampPokemon>()
  const entries = flat.map((file, index): CampEntry | null => {
    if (!file) return null
    try {
      return { file, pokemon: adapter.importPokemonFile(file.bytes) }
    } catch {
      unreadable.set(index, file)
      return null
    }
  })
  return { entries, unreadable }
}

/** Camp to save: unreadable files stay put unless something replaced them. */
export function campFromEntries(
  entries: readonly (CampEntry | null)[],
  unreadable: ReadonlyMap<number, CampPokemon> = new Map()
): Camp {
  return {
    sites: sitesFromFlat(
      entries.map(
        (entry, index) => entry?.file ?? unreadable.get(index) ?? null
      )
    ),
  }
}

export type { Camp, CampPosition }
