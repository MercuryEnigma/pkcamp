import type { SpriteResolver } from '../../../services/sprites'
import type { StoredCollectionMatch } from '../../../services/storage'
import { Panel } from '../../hub/Panel'
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

/** The selected entry: its sprite and constraints, the Pokémon matching it, and a link to Camp. */
export function PokemonView({
  definition,
  entryId,
  matches,
  matchIndex,
  onMatchChange,
  resolver,
  canOpen,
  onOpenInCamp,
}: {
  definition: CollectionDefinition
  entryId: string | null
  matches: readonly StoredCollectionMatch[]
  matchIndex: number
  onMatchChange: (index: number) => void
  resolver: SpriteResolver
  /** Whether a match can be opened in Camp (not for another game's save). */
  canOpen: (match: StoredCollectionMatch) => boolean
  onOpenInCamp: (match: StoredCollectionMatch) => void
}) {
  const constraints = entryId ? definition.pokemon[entryId] : undefined
  if (!entryId || !constraints)
    return (
      <Panel label="Pokémon" className="pc-view">
        <div className="pc-view-empty">
          <span className="pc-view-empty-mark" aria-hidden="true" />
          <h2>Choose a Pokémon</h2>
          <p>
            Select an entry from the collection to view its research details.
          </p>
        </div>
      </Panel>
    )

  const display = resolveSpriteDisplay(
    resolver,
    entrySpriteRequest(entryId, constraints)
  )
  const dex = entryDexNumber(constraints)
  const extra = requirementFields(constraints).filter(
    (field) => field.label !== 'Species'
  )
  const match = matches[matchIndex] ?? null

  return (
    <Panel label="Pokémon" className="pc-view">
      <div className="pc-view-header">
        <img
          className="pc-view-sprite"
          src={spriteDisplayImageSrc(display)}
          alt=""
        />
        <div>
          <h2>
            {dex !== null && `#${dex} `}
            {collectionEntryLabel(definition, entryId)}
          </h2>
          {extra.length > 0 && (
            <>
              <p>Constraints:</p>
              <ul>
                {extra.map((field) => (
                  <li key={field.label}>
                    {field.label}: {field.value}
                  </li>
                ))}
              </ul>
            </>
          )}
          <SpriteCredit display={display} />
        </div>
      </div>

      <div className="pc-view-matches">
        {match ? (
          <>
            {matches.length > 1 && (
              <div className="pc-view-stepper">
                <button
                  type="button"
                  aria-label="Previous match"
                  disabled={matchIndex === 0}
                  onClick={() => onMatchChange(matchIndex - 1)}
                >
                  ◀
                </button>
                <span>
                  Match {matchIndex + 1} of {matches.length}
                </span>
                <button
                  type="button"
                  aria-label="Next match"
                  disabled={matchIndex === matches.length - 1}
                  onClick={() => onMatchChange(matchIndex + 1)}
                >
                  ▶
                </button>
              </div>
            )}
            <dl>
              <dt>Nickname</dt>
              <dd>{match.nickname || '—'}</dd>
              <dt>OT / ID</dt>
              <dd>
                {match.originalTrainerName} / {match.originalTrainerId}
              </dd>
              <dt>Level</dt>
              <dd>{match.level}</dd>
              <dt>Species</dt>
              <dd>{speciesName(match.species)}</dd>
              <dt>Found in</dt>
              <dd>
                {'camp' in match
                  ? `Camp Site ${match.location.site + 1} · Space ${match.location.index + 1}`
                  : describeSource(match)}
              </dd>
            </dl>
          </>
        ) : (
          <p>You don't have this Pokémon yet.</p>
        )}
      </div>

      <div className="pc-view-footer">
        <button
          type="button"
          className="camp-upload-btn camp-upload-btn--primary"
          disabled={!match || !canOpen(match)}
          onClick={() => match && onOpenInCamp(match)}
        >
          View in Camp →
        </button>
        {match && !canOpen(match) && (
          <span>This match belongs to another game.</span>
        )}
      </div>
    </Panel>
  )
}
