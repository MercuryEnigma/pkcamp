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
const IDENTITY_FIELDS = new Set([
  'Species',
  'Form',
  'Gender',
  'Shiny',
  'Egg',
  'Level',
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
  const constraints = definition.pokemon[entryId]
  const display = resolveSpriteDisplay(
    resolver,
    entrySpriteRequest(entryId, constraints)
  )
  const dex = entryDexNumber(constraints)
  const fields = requirementFields(constraints)
  const identity = fields.filter((field) => IDENTITY_FIELDS.has(field.label))
  const traits = fields.filter((field) => !IDENTITY_FIELDS.has(field.label))
  const name = collectionEntryLabel(definition, entryId)

  return (
    <div className="pc-screen-body">
      <button type="button" className="pc-back" onClick={onBack}>
        ‹ {definition.name}
      </button>
      <div className="pc-entry-view">
        <section className="pc-entry-hero" aria-label="Pokémon">
          <span className="pc-entry-sprite">
            <img src={spriteDisplayImageSrc(display)} alt="" />
          </span>
          <h2>
            {dex !== null && `#${String(dex).padStart(3, '0')} `}
            {name.toUpperCase()}
          </h2>
          {registered && <span className="pc-stamp">Registered</span>}
          <SpriteCredit display={display} />
        </section>

        <section className="pc-entry-section" aria-label="Requirements">
          <h3 className="pc-label">Collection requirement</h3>
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
              <h3 className="pc-label">Moves &amp; traits</h3>
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

        <section className="pc-entry-section" aria-label="Your matches">
          <h3 className="pc-label">Currently found ({matches.length})</h3>
          {matches.length === 0 && (
            <p className="pc-muted">You don't have this Pokémon yet.</p>
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
                    <span> Lv. {match.level}</span>
                    <p>
                      {'camp' in match
                        ? `Camp Site ${match.location.site + 1} · Slot ${match.location.index + 1}`
                        : describeSource(match)}
                    </p>
                    <p>
                      OT {match.originalTrainerName} · {match.originalTrainerId}
                    </p>
                    {!openable && (
                      <p className="pc-muted">
                        This match belongs to another game.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="camp-upload-btn camp-upload-btn--primary"
                    disabled={!openable}
                    onClick={() => onOpenInCamp(match)}
                  >
                    {'camp' in match ? 'Open Site' : 'Open Cabin'} →
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
