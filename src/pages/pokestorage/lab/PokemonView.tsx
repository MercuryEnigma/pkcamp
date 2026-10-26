import { useId, useState, type ComponentProps } from 'react'
import { collectionDisplay } from './collectionDisplay'
import { useTranslation } from 'react-i18next'
import { i18n } from '../../../services/i18n'
import type { SpriteResolver } from '../../../services/sprites'
import type { StoredCollectionMatch } from '../../../services/storage'
import { resolveSpriteDisplay, spriteDisplayImageSrc } from '../spriteDisplay'
import type { CollectionDefinition } from './collectionTypes'
import type {
  GuideStatus,
  PokedexSpecies,
  PokedexDataset,
} from '../../../services/guide'
import { SpeciesDataView, SpeciesHero } from '../guide/SpeciesData'
import { GuideReference } from './GuideReference'
import {
  collectionEntryLabel,
  describeSource,
  entryDexNumber,
  entrySpriteRequest,
  requirementFields,
  speciesName,
} from './entryDisplay'

/** Requirements that identify the entry; the rest are moves and traits. */
const getIdentityFields = () =>
  new Set([
    i18n.t('lab:PokemonView.species'),
    i18n.t('lab:PokemonView.form'),
    i18n.t('lab:PokemonView.gender'),
    i18n.t('lab:PokemonView.shiny'),
    i18n.t('lab:PokemonView.egg'),
    i18n.t('lab:PokemonView.level'),
  ])

function CollectionEntryView(props: ComponentProps<'div'>) {
  return <div className="pc-entry-view" {...props} />
}

/**
 * Screen 3: the selected entry's sprite, what the collection requires of it,
 * and every Pokémon currently matching it, each with a link to Camp.
 */
export function PokemonView({
  definition,
  entryId,
  registered,
  matches,
  referenceSpecies,
  referenceStatus,
  referenceTitle,
  referenceDataset,
  resolver,
  canOpen,
  onOpenInCamp,
  onBack,
}: {
  definition: CollectionDefinition
  entryId: string
  registered: boolean
  matches: readonly StoredCollectionMatch[]
  referenceSpecies: PokedexSpecies | null
  referenceStatus: GuideStatus
  referenceTitle: string | null
  referenceDataset: PokedexDataset | null
  resolver: SpriteResolver
  /** Whether a match can be opened in Camp (not for another game's save). */
  canOpen: (match: StoredCollectionMatch) => boolean
  onOpenInCamp: (match: StoredCollectionMatch) => void
  onBack: () => void
}) {
  const { t } = useTranslation(['lab', 'common'] as const)

  const [view, setView] = useState<'collection' | 'reference'>('collection')
  const [matchSelection, setMatchSelection] = useState({ entryId, index: 0 })
  const originalReferenceId = referenceSpecies?.nationalDexNumber ?? null
  const [referenceSelection, setReferenceSelection] = useState({
    entryId,
    originalReferenceId,
    selectedReferenceId: originalReferenceId,
  })
  const tabsId = useId()

  const constraints = definition.pokemon[entryId]
  const entryDisplay = resolveSpriteDisplay(
    resolver,
    entrySpriteRequest(entryId, constraints)
  )
  const entryDex = entryDexNumber(constraints)
  const fields = requirementFields(constraints)
  const identity = fields.filter((field) =>
    getIdentityFields().has(field.label)
  )
  const traits = fields.filter((field) => !getIdentityFields().has(field.label))
  const entryName = collectionEntryLabel(definition, entryId)
  const selectedReferenceId =
    referenceSelection.entryId === entryId &&
    referenceSelection.originalReferenceId === originalReferenceId
      ? referenceSelection.selectedReferenceId
      : originalReferenceId
  const selectedReferenceSpecies =
    (selectedReferenceId === null
      ? null
      : referenceDataset?.species[selectedReferenceId]) ?? referenceSpecies
  const viewingDifferentSpecies =
    view === 'reference' &&
    selectedReferenceSpecies !== null &&
    selectedReferenceSpecies.nationalDexNumber !== originalReferenceId
  const display = viewingDifferentSpecies
    ? resolveSpriteDisplay(resolver, {
        nationalDex: selectedReferenceSpecies.nationalDexNumber,
        displayName: selectedReferenceSpecies.name,
      })
    : entryDisplay
  const dex = viewingDifferentSpecies
    ? selectedReferenceSpecies.nationalDexNumber
    : entryDex
  const name = viewingDifferentSpecies
    ? selectedReferenceSpecies.name
    : entryName
  const matchIndex =
    matches.length === 0 || matchSelection.entryId !== entryId
      ? 0
      : Math.min(matchSelection.index, matches.length - 1)
  const selectedMatch = matches[matchIndex]
  const selectedMatchDisplay = selectedMatch
    ? resolveSpriteDisplay(resolver, {
        nationalDex: selectedMatch.species,
        displayName: speciesName(selectedMatch.species),
        formId: selectedMatch.form !== 0 ? selectedMatch.form : undefined,
        shiny: selectedMatch.shiny ? true : undefined,
      })
    : null
  const selectedMatchOpenable = selectedMatch ? canOpen(selectedMatch) : false

  const EntryViewPanel =
    view === 'reference' ? SpeciesDataView : CollectionEntryView

  return (
    <div className="pc-screen-body">
      <div className="pc-entry-heading">
        <button type="button" className="pc-back" onClick={onBack}>
          ‹ {collectionDisplay(definition).name}
        </button>
        <div
          className="pc-entry-tabs"
          role="tablist"
          aria-label={t('PokemonView.entryViews')}
        >
          {(['collection', 'reference'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`${tabsId}-${tab}`}
              aria-selected={view === tab}
              aria-controls={`${tabsId}-panel`}
              tabIndex={view === tab ? 0 : -1}
              onKeyDown={(event) => {
                if (
                  event.key === 'ArrowLeft' ||
                  event.key === 'ArrowRight' ||
                  event.key === 'Home' ||
                  event.key === 'End'
                ) {
                  event.preventDefault()
                  const next =
                    event.key === 'Home'
                      ? 'collection'
                      : event.key === 'End'
                        ? 'reference'
                        : view === 'collection'
                          ? 'reference'
                          : 'collection'
                  setView(next)
                  document.getElementById(`${tabsId}-${next}`)?.focus()
                }
              }}
              onClick={() => setView(tab)}
            >
              {tab === 'collection'
                ? t('PokemonView.collectionAndMatches')
                : t('PokemonView.romReference')}
            </button>
          ))}
        </div>
      </div>
      <EntryViewPanel
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-${view}`}
      >
        <SpeciesHero
          display={display}
          dexNumber={dex}
          name={name}
          label={t('PokemonView.pokeMon')}
        >
          {registered && !viewingDifferentSpecies && (
            <span className="pc-stamp">{t('PokemonView.registered')}</span>
          )}
        </SpeciesHero>

        {view === 'reference' && (
          <GuideReference
            key={entryId}
            species={selectedReferenceSpecies}
            status={referenceStatus}
            title={referenceTitle}
            dataset={referenceDataset}
            onSelectSpecies={(id) =>
              setReferenceSelection({
                entryId,
                originalReferenceId,
                selectedReferenceId: id,
              })
            }
          />
        )}
        {view === 'collection' && (
          <>
            <section
              className="pc-entry-section"
              aria-label={t('PokemonView.requirements')}
            >
              <h3 className="pc-label">
                {t('PokemonView.requirements')}
              </h3>
              <dl>
                {identity.map((field) => (
                  <div key={field.label}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
              {traits.length > 0 && (
                <>
                  <h3 className="pc-label">{t('PokemonView.movesTraits')}</h3>
                  <dl>
                    {traits.map((field) => (
                      <div key={field.label}>
                        <dt>{field.label}</dt>
                        <dd>{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </section>

            <section
              className="pc-entry-section"
              aria-label={t('PokemonView.yourMatches')}
            >
              <div className="pc-found-heading">
                <h3 className="pc-label">
                  {t('PokemonView.currentlyFound', { length: matches.length })}
                </h3>
                {matches.length > 0 && (
                  <div className="pc-found-nav">
                    <button
                      type="button"
                      aria-label={t('PokemonView.previousMatch')}
                      disabled={matches.length < 2}
                      onClick={() =>
                        setMatchSelection({
                          entryId,
                          index:
                            (matchIndex - 1 + matches.length) % matches.length,
                        })
                      }
                    >
                      ‹
                    </button>
                    <span aria-live="polite">
                      {t('PokemonView.matchPosition', {
                        current: matchIndex + 1,
                        total: matches.length,
                      })}
                    </span>
                    <button
                      type="button"
                      aria-label={t('PokemonView.nextMatch')}
                      disabled={matches.length < 2}
                      onClick={() =>
                        setMatchSelection({
                          entryId,
                          index: (matchIndex + 1) % matches.length,
                        })
                      }
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
              {matches.length === 0 && (
                <p className="pc-muted">
                  {t('PokemonView.youDonTHaveThisPokeMonYet')}
                </p>
              )}
              <ul className="pc-found">
                {selectedMatch && selectedMatchDisplay && (
                  <li className="pc-found-card">
                    <img
                      src={spriteDisplayImageSrc(selectedMatchDisplay)}
                      alt=""
                    />
                    <div>
                      <strong>
                        {(
                          selectedMatch.nickname ||
                          speciesName(selectedMatch.species)
                        ).toUpperCase()}
                      </strong>
                      <span>
                        {t('PokemonView.lv', { level: selectedMatch.level })}
                      </span>
                      <p>
                        {'camp' in selectedMatch
                          ? t('PokemonView.campSiteSlot', {
                              value1: selectedMatch.location.site + 1,
                              value2: selectedMatch.location.index + 1,
                            })
                          : describeSource(selectedMatch)}
                      </p>
                      <p>
                        {t('PokemonView.ot', {
                          originalTrainerName:
                            selectedMatch.originalTrainerName,
                          originalTrainerId: selectedMatch.originalTrainerId,
                        })}
                      </p>
                      {!selectedMatchOpenable && (
                        <p className="pc-muted">
                          {t('PokemonView.thisMatchBelongsToAnotherGame')}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="camp-upload-btn camp-upload-btn--primary"
                      disabled={!selectedMatchOpenable}
                      onClick={() => onOpenInCamp(selectedMatch)}
                    >
                      {'camp' in selectedMatch
                        ? t('PokemonView.openSite')
                        : t('PokemonView.openCabin')}{' '}
                      →
                    </button>
                  </li>
                )}
              </ul>
            </section>
          </>
        )}
      </EntryViewPanel>
    </div>
  )
}
