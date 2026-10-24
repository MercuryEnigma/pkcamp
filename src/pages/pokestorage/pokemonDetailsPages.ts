export const DETAILS_VIEWS = [
  'overview',
  'movesTraits',
  'statsTraining',
] as const

export type DetailsView = (typeof DETAILS_VIEWS)[number]

export const DETAILS_VIEW_LABEL: Record<DetailsView, string> = {
  overview: 'Overview',
  movesTraits: 'Moves & Traits',
  statsTraining: 'Stats',
}
