import moves from '../../../vendor/pkhex-wasm/src/ts/gen/data/moves.json'
import items from '../../../vendor/pkhex-wasm/src/ts/gen/data/items-Gen3.json'
import i18n from './config'

const GEN_3_MOVE_MAX = 354
const gen3Moves = new Map(
  (moves as { id: number; name: string }[])
    .filter((move) => move.id > 0 && move.id <= GEN_3_MOVE_MAX)
    .map((move) => [move.id, move.name])
)
const gen3Items = new Map(
  (items as { id: number; name: string }[]).map((item) => [item.id, item.name])
)

function translate(key: string, options: Record<string, unknown> = {}): string {
  return i18n.t(key as never, options as never) as unknown as string
}

export function itemName(itemId: number): string {
  return translate(`pokedex:items.${itemId}`, {
    defaultValue: gen3Items.get(itemId) ?? String(itemId),
  })
}

/** Resolve an extracted move in the current language, preserving hack names. */
export function moveName(
  nationalMoveId: number | null,
  romName?: string | null
): string {
  if (nationalMoveId === null) return i18n.t('pokedex:unknownMove')
  const standard = gen3Moves.get(nationalMoveId)
  if (!standard) return romName || i18n.t('pokedex:unknownMove')
  if (romName && romName !== standard) return romName
  return translate(`pokedex:moves.${nationalMoveId}`, {
    defaultValue: standard,
  })
}

/** Format the parser's stable evolution method and parameter at display time. */
export function evolutionDescription(
  method: string,
  parameter: number | string | null
): string {
  const key = `pokedex:evolutions.${method}`
  const fallback = method.replaceAll('-', ' ')
  const itemId =
    typeof parameter === 'number' && /item/.test(method) ? parameter : null
  const resolvedParameter = itemId === null ? parameter : itemName(itemId)
  return translate(key, {
    defaultValue:
      resolvedParameter === null
        ? fallback
        : `${fallback}: ${resolvedParameter}`,
    parameter: resolvedParameter === null ? '' : String(resolvedParameter),
  })
}
