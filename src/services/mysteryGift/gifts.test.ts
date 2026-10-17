import { describe, expect, it } from 'vitest'
import { customWondercardEvents } from './vendor/gblink-wondercards/events/custom-events.js'
import { goppierWondercardEvents } from './vendor/gblink-wondercards/events/goppier-events.js'
import { findEvent } from '../tradeDevice/vendor/gb-link-switch-ldn/gift/events.js'
import { MYSTERY_GIFTS } from './gifts'

const gbaEvents = [...customWondercardEvents, ...goppierWondercardEvents]

describe('MYSTERY_GIFTS', () => {
  it.each(MYSTERY_GIFTS.map((gift) => [gift.label, gift.id]))(
    '%s is in the GBA and Switch catalogs',
    (_label, id) => {
      expect(gbaEvents.find((event) => event.id === id)).toBeTruthy()
      expect(findEvent(id)).toBeTruthy()
    }
  )

  it('runs every gift on Emerald and FireRed/LeafGreen over GB-Link', () => {
    for (const gift of MYSTERY_GIFTS) {
      const event = gbaEvents.find(
        (candidate) => candidate.id === gift.id
      ) as unknown as {
        roms: string[] | null
        variants: Record<string, unknown> | null
      }
      const keys = event.roms ?? Object.keys(event.variants ?? {})
      expect(
        keys.some((key) => key === 'emerald' || key.startsWith('BPE'))
      ).toBe(true)
      expect(keys.some((key) => key === 'frlg' || /^BP[RG]/.test(key))).toBe(
        true
      )
    }
  })
})
