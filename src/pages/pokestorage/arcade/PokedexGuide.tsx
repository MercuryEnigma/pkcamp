import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Gen3GameId } from '../../../services/saveLibrary'
import { getSpecies, guide, searchSpecies } from '../../../services/guide'
import { useGuide } from '../../context/useGuide'
import {
  SpeciesDataPanel,
  SpeciesDataView,
  SpeciesHero,
} from '../guide/SpeciesData'
import { resolveSpriteDisplay } from '../spriteDisplay'
import { useSpriteResolver } from '../useStorage'
import './pokedexGuide.css'

export function PokedexGuide({
  gameId,
  onClose,
}: {
  gameId: Gen3GameId | null
  onClose: () => void
}) {
  const { t } = useTranslation(['arcade', 'pokedex', 'common'] as const)
  const reference = useGuide()
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  // Picking from the list starts on Overview; species links keep the section.
  const [listPicks, setListPicks] = useState(0)
  const resolver = useSpriteResolver()

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
    return () => {
      element?.close()
    }
  }, [])

  const dataset = reference.gameId === gameId ? reference.dataset : null
  const status = reference.gameId === gameId ? reference.status : 'loading'
  const filtered = useMemo(
    () => (dataset ? searchSpecies(dataset, query) : []),
    [dataset, query]
  )
  const species =
    dataset && selected !== null ? getSpecies(dataset, selected) : undefined

  return (
    <dialog
      ref={dialog}
      className="pokedex-guide"
      aria-labelledby="pokedex-guide-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <header className="pokedex-guide-header">
        <div>
          <p>{dataset?.game.title ?? t('actions.guide')}</p>
          <h2 id="pokedex-guide-title">{t('actions.pokedexGuide')}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('ArcadePlayer.closeGuide')}
        >
          ×
        </button>
      </header>
      {status === 'unsupported' && (
        <p role="status">{t('pokedex:status.unsupported')}</p>
      )}
      {(status === 'idle' || status === 'unavailable') && (
        <p role="status">{t('pokedex:status.missingRom')}</p>
      )}
      {status === 'error' && (
        <div role="status">
          <p>{t('pokedex:status.loadFailed')}</p>
          <button type="button" onClick={() => void guide.refresh()}>
            {t('common:actions.retry')}
          </button>
        </div>
      )}
      {!dataset && status === 'loading' && (
        <p role="status">{t('pokedex:status.loading')}</p>
      )}
      {dataset && (
        <div className="pokedex-guide-content">
          <section
            className="pokedex-guide-list"
          >
            <label>
              {t('common:searchPokemon')}
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <ul>
              {filtered.map((entry) => (
                <li key={entry.nationalDexNumber}>
                  <button
                    type="button"
                    aria-pressed={selected === entry.nationalDexNumber}
                    onClick={() => {
                      setSelected(entry.nationalDexNumber)
                      setListPicks((count) => count + 1)
                    }}
                  >
                    #{String(entry.nationalDexNumber).padStart(3, '0')}{' '}
                    {entry.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <div className="pokedex-guide-details">
            {!species && <p>{t('ArcadePlayer.chooseSpecies')}</p>}
            {species && (
              <SpeciesDataView>
                <SpeciesHero
                  display={resolveSpriteDisplay(resolver, {
                    nationalDex: species.nationalDexNumber,
                    displayName: species.name,
                  })}
                  dexNumber={species.nationalDexNumber}
                  name={species.name}
                  label={t('pokedex:species')}
                />
                <SpeciesDataPanel
                  key={listPicks}
                  species={species}
                  dataset={dataset}
                  title={dataset.game.title}
                  onSelectSpecies={setSelected}
                />
              </SpeciesDataView>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
