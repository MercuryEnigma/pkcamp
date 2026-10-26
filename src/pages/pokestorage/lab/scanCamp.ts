import type { PokemonSaveAdapter } from '../../../services/pkhex'
import type { Camp } from '../../../services/storage'
import type { CampScanStatus, ScannedPokemon } from './collectionTypes'

/** Camp Pokémon in a Camp, without reading any of them. */
function campPokemonCount(camp: Camp): number {
  return camp.sites.reduce(
    (sum, site) => sum + site.filter((pokemon) => pokemon !== null).length,
    0
  )
}

/**
 * A short digest of which Camp Pokémon sits where. Camps carry no save
 * timestamp, so a changed digest is how a stored result learns the Camp
 * moved, gained, or lost a Pokémon since it was scanned.
 */
export function campFingerprint(camp: Camp): string {
  const layout = camp.sites
    .map((site) => site.map((pokemon) => pokemon?.id ?? '').join(','))
    .join('|')
  // FNV-1a, 32-bit: stable, tiny, and plenty to notice a change.
  let hash = 0x811c9dc5
  for (let i = 0; i < layout.length; i++) {
    hash ^= layout.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${campPokemonCount(camp)}:${(hash >>> 0).toString(16)}`
}

/**
 * Reads every Pokémon at the Gen 3 Camp Sites through the adapter. A file the
 * adapter can't read is counted and skipped, like Camp Sites themselves do.
 */
export function scanCamp(
  adapter: PokemonSaveAdapter,
  camp: Camp
): { pokemon: ScannedPokemon[]; status: CampScanStatus } {
  const pokemon: ScannedPokemon[] = []
  let unreadable = 0
  camp.sites.forEach((site, siteIndex) => {
    site.forEach((stored, index) => {
      if (!stored) return
      try {
        pokemon.push({
          node: adapter.importPokemonFile(stored.bytes),
          source: { camp: true, location: { site: siteIndex, index } },
        })
      } catch {
        unreadable++
      }
    })
  })
  return {
    pokemon,
    status: {
      state: 'ok',
      count: pokemon.length,
      unreadable,
      fingerprint: campFingerprint(camp),
    },
  }
}
