import { i18n } from '../i18n'
import { spriteAttribution, type SpriteAttribution } from './attribution'
import {
  SUPPORTED_DEX_RANGE,
  type SpriteGender,
  type SpriteFormAliases,
  type SpriteManifest,
  type SpriteManifestEntry,
} from './manifest'

/**
 * Normalized presentation request for a single Pokémon sprite. This is the
 * only shape the resolver understands — it never sees raw save bytes or
 * PKHeX objects.
 */
export interface SpriteRequest {
  nationalDex: number
  /** Accessible display name to fall back to in the label, e.g. "Pikachu". */
  displayName: string
  /** Canonical form id or save-data form index. Omit for the base form. */
  formId?: string | number
  gender?: SpriteGender
  shiny?: boolean
  egg?: boolean
}

/** An honest reason the resolver could not produce a verified asset. */
export type SpriteFallbackReason =
  | 'out-of-scope-generation'
  | 'missing-species'
  | 'missing-form'
  | 'shiny-unavailable'
  | 'egg-unavailable'

export interface SpriteAvailableResult {
  attribution?: SpriteAttribution
  status: 'available'
  assetPath: string
  label: string
}

export interface SpriteFallbackResult {
  status: 'fallback'
  reason: SpriteFallbackReason
  label: string
}

export type SpriteResolution = SpriteAvailableResult | SpriteFallbackResult

function buildLabel(request: SpriteRequest): string {
  const parts: string[] = [request.displayName]
  if (request.formId) parts.push(`(${request.formId})`)
  if (request.shiny) parts.push(i18n.t('services:resolver.shiny'))
  if (request.egg) parts.push(i18n.t('services:resolver.egg'))
  return parts.join(' ')
}

function matchesGender(
  entryGender: SpriteGender | undefined,
  requestGender: SpriteGender | undefined
): boolean {
  // An entry with no gender restriction applies regardless of the request.
  if (entryGender === undefined) return true
  return entryGender === requestGender
}

function normalizeFormId(
  aliases: SpriteFormAliases | undefined,
  nationalDex: number,
  formId: string | number | undefined
): string | undefined {
  if (formId === undefined || formId === '' || formId === 0 || formId === '0') {
    return undefined
  }
  const index =
    typeof formId === 'number'
      ? formId
      : /^\d+$/.test(formId)
        ? Number(formId)
        : undefined
  if (index !== undefined)
    return aliases?.[nationalDex]?.[index] ?? String(index)
  return String(formId).toLowerCase()
}

function matchesForm(
  entryForm: string | undefined,
  requestFormId: string | undefined
): boolean {
  // Treat a missing form on either side as "base form".
  return (entryForm ?? undefined) === (requestFormId ?? undefined)
}

/**
 * Resolve a single Pokémon presentation request against a manifest.
 * Exact-match only: any deviation from a verified entry produces an honest
 * fallback rather than a guess.
 */
export function resolveSpriteFromManifest(
  manifest: SpriteManifest,
  request: SpriteRequest,
  formAliases?: SpriteFormAliases
): SpriteResolution {
  const label = buildLabel(request)
  const shiny = request.shiny ?? false
  const egg = request.egg ?? false
  const formId = normalizeFormId(
    formAliases,
    request.nationalDex,
    request.formId
  )

  if (
    request.nationalDex < SUPPORTED_DEX_RANGE.min ||
    request.nationalDex > SUPPORTED_DEX_RANGE.max
  ) {
    return { status: 'fallback', reason: 'out-of-scope-generation', label }
  }

  const speciesEntries = manifest.filter(
    (entry) => entry.nationalDex === request.nationalDex
  )
  if (speciesEntries.length === 0) {
    return { status: 'fallback', reason: 'missing-species', label }
  }

  const eggMatched = speciesEntries.filter((entry) => entry.egg === egg)
  if (egg && eggMatched.length === 0) {
    return { status: 'fallback', reason: 'egg-unavailable', label }
  }
  const eggScoped = egg ? eggMatched : speciesEntries.filter((e) => !e.egg)
  if (eggScoped.length === 0) {
    return { status: 'fallback', reason: 'missing-species', label }
  }

  const shinyMatched = eggScoped.filter((entry) => entry.shiny === shiny)
  if (shiny && shinyMatched.length === 0) {
    return { status: 'fallback', reason: 'shiny-unavailable', label }
  }
  const shinyScoped = shiny ? shinyMatched : eggScoped.filter((e) => !e.shiny)
  if (shinyScoped.length === 0) {
    return { status: 'fallback', reason: 'missing-species', label }
  }

  const formScoped = shinyScoped.filter((entry) =>
    matchesForm(entry.form, formId)
  )
  // Prefer a true gender variant over the generic/default art. Generic art is
  // still valid for sources and species that do not distinguish gender.
  const exact: SpriteManifestEntry | undefined =
    formScoped.find((entry) => entry.gender === request.gender) ??
    formScoped.find((entry) => matchesGender(entry.gender, request.gender))

  if (!exact) {
    return { status: 'fallback', reason: 'missing-form', label }
  }

  const attribution = exact.attribution ?? spriteAttribution(exact.assetPath)
  return {
    status: 'available',
    assetPath: exact.assetPath,
    label,
    ...(attribution ? { attribution } : {}),
  }
}

/** Configuration used to initialize a sprite resolver instance. */
export interface SpriteResolverConfig {
  /**
   * Identifies which asset source/repo this resolver is bound to. Not used
   * for any switching logic yet — this is purely the parameterization hook
   * a future Options screen will use to let the player pick a different
   * asset source without changing the resolver's public API again.
   */
  sourceId: string
  manifest: SpriteManifest
  formAliases?: SpriteFormAliases
}

export interface SpriteResolver {
  sourceId: string
  resolvePokemonSprite: (request: SpriteRequest) => SpriteResolution
}

/**
 * Initialize a sprite resolver bound to a given source configuration. The
 * resolver is synchronous and framework-neutral: it never fetches, loads, or
 * decodes images itself, it only returns which asset descriptor to use (or
 * an honest fallback).
 */
export function initializeSpriteResolver(
  config: SpriteResolverConfig
): SpriteResolver {
  const { sourceId, manifest, formAliases } = config
  return {
    sourceId,
    resolvePokemonSprite: (request: SpriteRequest) =>
      resolveSpriteFromManifest(manifest, request, formAliases),
  }
}
