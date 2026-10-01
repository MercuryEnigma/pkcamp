import {
  SUPPORTED_DEX_RANGE,
  type SpriteManifest,
  type SpriteSourceCoverage,
} from './manifest'

export interface SpriteCoverageTargets {
  forms: readonly string[]
  female: readonly string[]
}

function bucket<T extends number | string>(
  expected: readonly T[],
  available: Iterable<T>
) {
  const availableSet = new Set(available)
  return {
    available: expected.filter((value) => availableSet.has(value)),
    missing: expected.filter((value) => !availableSet.has(value)),
  }
}

export function spriteVariantKey(nationalDex: number, form?: string): string {
  return form ? `${nationalDex}:${form}` : String(nationalDex)
}

/**
 * Build the checked-in tracking list for a manifest's supported and missing
 * variants. Buckets are exclusive by axis, not by "has any art at all": an
 * entry with both a form and a gender (e.g. Hisuian Sneasel's female art)
 * lands only in `female`/`shinyFemale`, never `forms`/`shinyForms` — so a
 * form appearing in `forms.missing` can still have real gendered art, it
 * just isn't the plain form variant this bucket tracks.
 */
export function auditSpriteManifest(
  manifest: SpriteManifest,
  targets: SpriteCoverageTargets
): SpriteSourceCoverage {
  const species = Array.from(
    { length: SUPPORTED_DEX_RANGE.max - SUPPORTED_DEX_RANGE.min + 1 },
    (_, index) => index + SUPPORTED_DEX_RANGE.min
  )
  const forms = [...new Set(targets.forms)].sort()
  const female = [...new Set(targets.female)].sort()
  const regular = manifest.filter((entry) => !entry.egg)

  return {
    base: bucket(
      species,
      regular
        .filter((entry) => !entry.form && !entry.shiny && !entry.gender)
        .map((entry) => entry.nationalDex)
    ),
    shiny: bucket(
      species,
      regular
        .filter((entry) => !entry.form && entry.shiny && !entry.gender)
        .map((entry) => entry.nationalDex)
    ),
    forms: bucket(
      forms,
      regular
        .filter((entry) => entry.form && !entry.shiny && !entry.gender)
        .map((entry) => spriteVariantKey(entry.nationalDex, entry.form))
    ),
    shinyForms: bucket(
      forms,
      regular
        .filter((entry) => entry.form && entry.shiny && !entry.gender)
        .map((entry) => spriteVariantKey(entry.nationalDex, entry.form))
    ),
    female: bucket(
      female,
      regular
        .filter((entry) => !entry.shiny && entry.gender === 'female')
        .map((entry) => spriteVariantKey(entry.nationalDex, entry.form))
    ),
    shinyFemale: bucket(
      female,
      regular
        .filter((entry) => entry.shiny && entry.gender === 'female')
        .map((entry) => spriteVariantKey(entry.nationalDex, entry.form))
    ),
  }
}
