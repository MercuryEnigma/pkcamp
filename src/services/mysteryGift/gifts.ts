import { i18n } from '../i18n'
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
export const getMysteryGifts = (): readonly MysteryGift[] => [
  {
    id: 'goppier-altering-cave',
    label: i18n.t('services:gifts.alteringCave'),
    description: i18n.t(
      'services:gifts.changesTheWildPokeMonInAlteringCaveEachDelivery'
    ),
  },
  {
    id: 'custom-speed-4',
    label: i18n.t('services:gifts.fastForward4'),
    description: i18n.t('services:gifts.pressRToRunTheGameUpToFourTimes'),
  },
  {
    id: 'custom-pokemon-follow',
    label: i18n.t('services:gifts.pokeMonFollow'),
    description: i18n.t(
      'services:gifts.yourLeadPokeMonWalksBehindYouInTheOverworld'
    ),
  },
  {
    id: 'custom-pc-anywhere',
    label: i18n.t('services:gifts.pcAnywhere'),
    description: i18n.t('services:gifts.pressRInTheFieldToOpenThePokeMon'),
  },
  {
    id: 'custom-reusable-tms',
    label: i18n.t('services:gifts.reusableTms'),
    description: i18n.t('services:gifts.teachingAMoveWithATmNoLongerUsesThe'),
  },
  {
    id: 'custom-trade-evolution',
    label: i18n.t('services:gifts.trader'),
    description: i18n.t(
      'services:gifts.evolvesAPartyPokeMonThatNormallyEvolvesByTrading'
    ),
  },
]

/** GB-Link's own pages, with every other card for each target. */
export const MORE_GIFTS_URL: Record<GiftTarget, string> = {
  gba: 'https://wondercard.gblink.io/?from=gblink-launcher',
  switch: 'https://switch.gblink.io/?from=gblink-launcher#gift',
}
