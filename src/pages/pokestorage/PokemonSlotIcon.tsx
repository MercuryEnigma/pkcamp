import type { SaveSlot } from '../../services/pkhex'
import type { SpriteResolver } from '../../services/sprites'
import { resolveSpriteDisplay, spriteDisplayImageSrc } from './spriteDisplay'

const GENDER_TO_SPRITE: Record<
  NonNullable<SaveSlot>['gender'],
  'male' | 'female' | 'genderless'
> = {
  Male: 'male',
  Female: 'female',
  Genderless: 'genderless',
}

/**
 * One party/box slot rendered as a small icon. `slot === null` is a real,
 * positional empty slot (see PokemonNode/SaveSlot docs) — rendered as an
 * empty placeholder, not skipped, so grid positions stay faithful to the
 * save's actual layout.
 *
 * Numeric save form indexes are normalized by the sprite source's shared
 * form-alias table. Unmapped indexes still fall back honestly.
 */
/**
 * A slot's selection highlight. `true` is a plain "this is selected" state
 * (red); `'moveOne'`/`'groupMove'` color-code the highlight to match the
 * active storage mode, so it's visually obvious which mode is live while a
 * slot is picked.
 */
export type SlotSelection = boolean | 'moveOne' | 'groupMove'

function selectionClass(selected: SlotSelection): string {
  if (!selected) return ''
  if (selected === 'moveOne') return ' camp-slot--selected-blue'
  if (selected === 'groupMove') return ' camp-slot--selected-green'
  return ' camp-slot--selected-red'
}

export function PokemonSlotIcon({
  slot,
  resolver,
  size = 40,
  selected = false,
  onClick,
}: {
  slot: SaveSlot
  resolver: SpriteResolver
  size?: number
  selected?: SlotSelection
  onClick?: () => void
}) {
  if (slot === null) {
    if (onClick) {
      return (
        <button
          type="button"
          className={`camp-slot camp-slot--empty camp-slot--interactive${selectionClass(selected)}`}
          title="Empty slot"
          aria-label="Empty slot"
          onClick={onClick}
          style={{ width: size, height: size }}
        />
      )
    }
    return (
      <div
        className="camp-slot camp-slot--empty"
        title="Empty slot"
        style={{ width: size, height: size }}
      />
    )
  }

  const display = resolveSpriteDisplay(resolver, {
    nationalDex: slot.species,
    displayName: slot.nickname || `#${slot.species}`,
    formId: slot.form === 0 ? undefined : slot.form,
    gender: GENDER_TO_SPRITE[slot.gender],
    shiny: slot.shiny,
    egg: slot.isEgg,
  })

  const title = [
    slot.nickname || display.label,
    slot.isEgg ? 'Egg' : `Lv. ${slot.level}`,
    slot.shiny ? 'Shiny' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      type="button"
      className={`camp-slot camp-slot--pokemon${selectionClass(selected)}`}
      title={title}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={spriteDisplayImageSrc(display)}
        alt={title}
        style={{ maxWidth: '100%', maxHeight: '100%' }}
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    </button>
  )
}
