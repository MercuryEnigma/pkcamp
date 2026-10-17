import {
  spriteAttribution,
  type SpriteAttribution,
} from '../../services/sprites/attribution'
import {
  type SpriteFallbackReason,
  type SpriteRequest,
  type SpriteResolver,
} from '../../services/sprites'
import { UNKNOWN_POKEMON_SPRITE } from '../../services/sprites'

/**
 * Page-level display decision, not a resolver behavior: `resolvePokemonSprite`
 * itself always stays exact-match-only and never substitutes art (see
 * services/sprites/resolver.ts). Pages using this additionally decide, purely
 * for what to *show*:
 *  - exact match -> that asset.
 *  - variant missing (wrong form/shiny/egg/gender) but the species' base
 *    form IS in the manifest -> show the base form, clearly labeled
 *    approximate, with the real fallback reason kept visible.
 *  - species not in the manifest at all (or out of scope) -> show the
 *    generic "unseen Pokémon" egg placeholder, labeled unknown.
 */
type DisplayCredit = { attribution?: SpriteAttribution }

export type SpriteDisplay = DisplayCredit &
  (
    | { kind: 'exact'; assetPath: string; label: string }
    | {
        kind: 'approximate'
        assetPath: string
        label: string
        reason: SpriteFallbackReason
      }
    | { kind: 'unknown'; label: string; reason: SpriteFallbackReason }
  )

export function resolveSpriteDisplay(
  resolver: SpriteResolver,
  request: SpriteRequest
): SpriteDisplay {
  const exact = resolver.resolvePokemonSprite(request)
  if (exact.status === 'available') {
    return {
      kind: 'exact',
      assetPath: exact.assetPath,
      label: exact.label,
      ...(exact.attribution ? { attribution: exact.attribution } : {}),
    }
  }

  const base = resolver.resolvePokemonSprite({
    nationalDex: request.nationalDex,
    displayName: request.displayName,
  })
  if (base.status === 'available') {
    return {
      kind: 'approximate',
      assetPath: base.assetPath,
      label: exact.label,
      reason: exact.reason,
      ...(base.attribution ? { attribution: base.attribution } : {}),
    }
  }

  return {
    kind: 'unknown',
    label: exact.label,
    reason: exact.reason,
    attribution: spriteAttribution(UNKNOWN_POKEMON_SPRITE),
  }
}

/** Resolves the `<img src>` for a display result, including the unknown placeholder. */
export function spriteDisplayImageSrc(display: SpriteDisplay): string {
  const path =
    display.kind === 'unknown' ? UNKNOWN_POKEMON_SPRITE : display.assetPath
  return /^https?:\/\//.test(path) ? path : `${import.meta.env.BASE_URL}${path}`
}
