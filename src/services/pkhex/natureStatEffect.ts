import natureData from '../../../vendor/pkhex-wasm/src/ts/gen/data/natures.json'
import type { NamedRef, StatSpread } from './types.ts'

const NATURES = new Map(natureData.map((nature) => [nature.id, nature]))

/** The stat modifier applied by a Pokémon's Gen 3 nature. HP is always neutral. */
export function natureStatEffect(
  nature: NamedRef | null,
  stat: keyof StatSpread
): '+' | '-' | null {
  if (!nature || stat === 'hp') return null
  const entry = NATURES.get(nature.id)
  if (!entry || entry.name !== nature.name) return null
  const multiplier = entry.statMultipliers[stat]
  return multiplier > 1 ? '+' : multiplier < 1 ? '-' : null
}
