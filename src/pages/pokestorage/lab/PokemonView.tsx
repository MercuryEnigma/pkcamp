import { collectionDisplay } from './collectionDisplay'
import { useTranslation } from 'react-i18next'
import { i18n } from '../../../services/i18n'
import type { SpriteResolver } from '../../../services/sprites'
import type { StoredCollectionMatch } from '../../../services/storage'
import { resolveSpriteDisplay, spriteDisplayImageSrc } from '../spriteDisplay'
import { SpriteCredit } from '../SpriteCredit'
import type { CollectionDefinition } from './collectionTypes'
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

/**
 * Screen 3: the selected entry's sprite, what the collection requires of it,
 * and every Pokémon currently matching it, each with a link to Camp.
 */
export function PokemonView({
  definition,
  entryId,
  registered,
  matches,
  resolver,
  canOpen,
  onOpenInCamp,
  onBack,
}: {
  definition: CollectionDefinition
  entryId: string
  registered: boolean
  matches: readonly StoredCollectionMatch[]
  resolver: SpriteResolver
  /** Whether a match can be opened in Camp (not for another game's save). */
  canOpen: (match: StoredCollectionMatch) => boolean
  onOpenInCamp: (match: StoredCollectionMatch) => void
  onBack: () => void
}) {
  const { t } = useTranslation(['lab', 'common'] as const)

  const constraints = definition.pokemon[entryId]
  const display = resolveSpriteDisplay(
    resolver,
    entrySpriteRequest(entryId, constraints)
  )
  const dex = entryDexNumber(constraints)
  const fields = requirementFields(constraints)
  const identity = fields.filter((field) =>
    getIdentityFields().has(field.label)
  )
  const traits = fields.filter((field) => !getIdentityFields().has(field.label))
  const name = collectionEntryLabel(definition, entryId)

  return (
    <div className="pc-screen-body">
      <button type="button" className="pc-back" onClick={onBack}>
        ‹ {collectionDisplay(definition).name}
      </button>
      <div className="pc-entry-view">
        <section
          className="pc-entry-hero"
          aria-label={t('PokemonView.pokeMon')}
        >
          <span className="pc-entry-sprite">
            <img src={spriteDisplayImageSrc(display)} alt="" />
          </span>
          <h2>
            {dex !== null &&
              t('PokemonView.dexNumber', {
                value1: String(dex).padStart(3, '0'),
              })}
            {name.toUpperCase()}
          </h2>
          {registered && (
            <span className="pc-stamp">{t('PokemonView.registered')}</span>
          )}
          <SpriteCredit display={display} />
        </section>

        <section
          className="pc-entry-section"
          aria-label={t('PokemonView.requirements')}
        >
          <h3 className="pc-label">{t('PokemonView.collectionRequirement')}</h3>
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
          <h3 className="pc-label">
            {t('PokemonView.currentlyFound', { length: matches.length })}
          </h3>
          {matches.length === 0 && (
            <p className="pc-muted">
              {t('PokemonView.youDonTHaveThisPokeMonYet')}
            </p>
          )}
          <ul className="pc-found">
            {matches.map((match, index) => {
              const matchDisplay = resolveSpriteDisplay(resolver, {
                nationalDex: match.species,
                displayName: speciesName(match.species),
                formId: match.form !== 0 ? match.form : undefined,
                shiny: match.shiny ? true : undefined,
              })
              const openable = canOpen(match)
              return (
                <li key={index} className="pc-found-card">
                  <img src={spriteDisplayImageSrc(matchDisplay)} alt="" />
                  <div>
                    <strong>
                      {(
                        match.nickname || speciesName(match.species)
                      ).toUpperCase()}
                    </strong>
                    <span>{t('PokemonView.lv', { level: match.level })}</span>
                    <p>
                      {'camp' in match
                        ? t('PokemonView.campSiteSlot', {
                            value1: match.location.site + 1,
                            value2: match.location.index + 1,
                          })
                        : describeSource(match)}
                    </p>
                    <p>
                      {t('PokemonView.ot', {
                        originalTrainerName: match.originalTrainerName,
                        originalTrainerId: match.originalTrainerId,
                      })}
                    </p>
                    {!openable && (
                      <p className="pc-muted">
                        {t('PokemonView.thisMatchBelongsToAnotherGame')}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="camp-upload-btn camp-upload-btn--primary"
                    disabled={!openable}
                    onClick={() => onOpenInCamp(match)}
                  >
                    {'camp' in match
                      ? t('PokemonView.openSite')
                      : t('PokemonView.openCabin')}{' '}
                    →
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
