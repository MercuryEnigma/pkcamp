import { i18n } from '../../services/i18n'
export const DETAILS_VIEWS = [
  'overview',
  'movesTraits',
  'statsTraining',
] as const

export type DetailsView = (typeof DETAILS_VIEWS)[number]

export const getDetailsViewLabel = (): Record<DetailsView, string> => ({
  overview: i18n.t('pokemon-details:pokemonDetailsPages.overview'),
  movesTraits: i18n.t('pokemon-details:pokemonDetailsPages.movesTraits'),
  statsTraining: i18n.t('pokemon-details:pokemonDetailsPages.stats'),
})
