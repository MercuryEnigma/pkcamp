import { PORTRAIT_CREDITS } from './generatedPortraitCredits'

export interface SpriteAttribution {
  name: string
  sourceUrl: string
}

const PMD_COLLAB = 'PMDCollab/SpriteCollab'

/** Raw-asset prefix, credited repository, and browsable source prefix. */
const REPOSITORIES = [
    [
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/',
      'PokeAPI/sprites',
      'https://github.com/PokeAPI/sprites/blob/master/',
    ],
    [
      'https://raw.githubusercontent.com/nileplumb/PkmnShuffleMap/master/',
      'PkmnShuffleMap',
      'https://github.com/nileplumb/PkmnShuffleMap/blob/master/',
    ],
    [
      'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/',
      PMD_COLLAB,
      'https://github.com/PMDCollab/SpriteCollab/blob/master/',
    ],
] as const

/**
 * Credit the actual asset URL, including substituted base art and egg
 * placeholders. Pokémon Database entries carry their own manifest attribution.
 */
export function spriteAttribution(
  assetPath: string
): SpriteAttribution | undefined {
  for (const [prefix, repository, page] of REPOSITORIES) {
    if (!assetPath.startsWith(prefix)) continue
    const path = assetPath.slice(prefix.length)
    return {
      name:
        repository === PMD_COLLAB
          ? (PORTRAIT_CREDITS[path.replace(/^portrait\//, '')] ?? repository)
          : repository,
      sourceUrl: `${page}${path}`,
    }
  }
  return undefined
}
