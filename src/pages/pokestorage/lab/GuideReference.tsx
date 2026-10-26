import { useTranslation } from 'react-i18next'
import {
  guide,
  type GuideStatus,
  type PokedexSpecies,
  type PokedexDataset,
} from '../../../services/guide'
import { SpeciesDataPanel } from '../guide/SpeciesData'

/** The PC's Species Data panel, with the PC's loading and error states. */
export function GuideReference({
  species,
  status,
  title,
  dataset,
  onSelectSpecies,
}: {
  species: PokedexSpecies | null
  status: GuideStatus
  title: string | null
  dataset: PokedexDataset | null
  onSelectSpecies: (id: number) => void
}) {
  const { t } = useTranslation(['lab', 'pokedex', 'common'] as const)

  return (
    <SpeciesDataPanel
      species={species}
      dataset={dataset}
      title={title}
      onSelectSpecies={onSelectSpecies}
    >
      {status === 'loading' && (
        <p className="pc-muted" role="status">
          {t('pokedex:status.loading')}
        </p>
      )}
      {status === 'unsupported' && (
        <p className="pc-muted" role="status">
          {t('pokedex:status.unsupported')}
        </p>
      )}
      {(status === 'idle' || status === 'unavailable') && (
        <p className="pc-muted" role="status">
          {t('pokedex:status.missingRom')}
        </p>
      )}
      {status === 'error' && (
        <div role="status">
          <p className="pc-muted">{t('pokedex:status.loadFailed')}</p>
          <button
            type="button"
            className="pc-chip"
            onClick={() => void guide.refresh()}
          >
            {t('common:actions.retry')}
          </button>
        </div>
      )}
      {status === 'ready' && !species && (
        <p className="pc-muted">{t('pokedex:status.notInRom')}</p>
      )}
    </SpeciesDataPanel>
  )
}
