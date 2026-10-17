import type { GiftTarget } from './types'

export interface MysteryGift {
  /** Shared by the GBA and Switch senders' catalogs. */
  id: string
  label: string
  description: string
}

/**
 * The gifts PkCamp offers. Each is a Wonder Card from the GB-Link Team or
 * Project Wonder, built for Emerald, FireRed and LeafGreen.
 */
export const MYSTERY_GIFTS: readonly MysteryGift[] = [
  {
    id: 'goppier-altering-cave',
    label: 'Altering Cave',
    description:
      'Changes the wild Pokémon in Altering Cave. Each delivery moves it to the next one.',
  },
  {
    id: 'custom-speed-4',
    label: 'Fast Forward ×4',
    description:
      'Press R to run the game up to four times as fast, and R again to play normally.',
  },
  {
    id: 'custom-pokemon-follow',
    label: 'Pokémon Follow',
    description:
      'Your lead Pokémon walks behind you in the overworld, when the game has a sprite for it.',
  },
  {
    id: 'custom-pc-anywhere',
    label: 'PC Anywhere',
    description:
      'Press R in the field to open the Pokémon Storage System from anywhere.',
  },
  {
    id: 'custom-reusable-tms',
    label: 'Reusable TMs',
    description: 'Teaching a move with a TM no longer uses the TM up.',
  },
  {
    id: 'custom-trade-evolution',
    label: 'Trader',
    description:
      'Evolves a party Pokémon that normally evolves by trading, such as Kadabra or Machoke.',
  },
]

/** GB-Link's own pages, with every other card for each target. */
export const MORE_GIFTS_URL: Record<GiftTarget, string> = {
  gba: 'https://wondercard.gblink.io/?from=gblink-launcher',
  switch: 'https://switch.gblink.io/?from=gblink-launcher#gift',
}
