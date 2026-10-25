import type { NamedRef } from '../pkhex'
import i18n from './config'

// PKHeX's text_Natures_en.txt order. Catalogs use the same stable English keys;
// only the displayed value is localized, never the parsed Pokémon data.
const NATURE_NAMES = [
  'Hardy',
  'Lonely',
  'Brave',
  'Adamant',
  'Naughty',
  'Bold',
  'Docile',
  'Relaxed',
  'Impish',
  'Lax',
  'Timid',
  'Hasty',
  'Serious',
  'Jolly',
  'Naive',
  'Modest',
  'Mild',
  'Quiet',
  'Bashful',
  'Rash',
  'Calm',
  'Gentle',
  'Sassy',
  'Careful',
  'Quirky',
] as const

export function natureName(nature: NamedRef | null): string | null {
  if (!nature) return null
  const name = NATURE_NAMES[nature.id]
  // Keep unknown/custom data readable rather than showing the wrong nature.
  if (!name || name !== nature.name) return nature.name
  return i18n.t(`pokemon-details:natures.${name}`)
}
