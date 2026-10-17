import { useState } from 'react'
import type { PokemonNode, StatSpread } from '../../services/pkhex'
import type { SpriteResolver } from '../../services/sprites'
import { resolveSpriteDisplay, spriteDisplayImageSrc } from './spriteDisplay'
import { SpriteCredit } from './SpriteCredit'
import { DEX_NAME } from './dexNames'

const GENDER_SYMBOL: Record<PokemonNode['gender'], string> = {
  Male: '♂',
  Female: '♀',
  Genderless: '',
}

const GENDER_TO_SPRITE: Record<
  PokemonNode['gender'],
  'male' | 'female' | 'genderless'
> = {
  Male: 'male',
  Female: 'female',
  Genderless: 'genderless',
}

/** Fields not yet exposed by the adapter (see PokemonNode) — honest placeholders, not guesses. */
const NOT_YET_AVAILABLE = '—'

type StatKey = keyof StatSpread

/**
 * Every nature's boosted/lowered stat, by name (not by PKHeX's numeric
 * nature id, so this doesn't depend on assuming a particular id scheme).
 * The five neutral natures (`null`) affect no stat.
 */
const NATURE_EFFECT: Record<string, { boost: StatKey; lower: StatKey } | null> =
  {
    Hardy: null,
    Lonely: { boost: 'attack', lower: 'defense' },
    Brave: { boost: 'attack', lower: 'speed' },
    Adamant: { boost: 'attack', lower: 'specialAttack' },
    Naughty: { boost: 'attack', lower: 'specialDefense' },
    Bold: { boost: 'defense', lower: 'attack' },
    Docile: null,
    Relaxed: { boost: 'defense', lower: 'speed' },
    Impish: { boost: 'defense', lower: 'specialAttack' },
    Lax: { boost: 'defense', lower: 'specialDefense' },
    Timid: { boost: 'speed', lower: 'attack' },
    Hasty: { boost: 'speed', lower: 'defense' },
    Serious: null,
    Jolly: { boost: 'speed', lower: 'specialAttack' },
    Naive: { boost: 'speed', lower: 'specialDefense' },
    Modest: { boost: 'specialAttack', lower: 'attack' },
    Mild: { boost: 'specialAttack', lower: 'defense' },
    Quiet: { boost: 'specialAttack', lower: 'speed' },
    Bashful: null,
    Rash: { boost: 'specialAttack', lower: 'specialDefense' },
    Calm: { boost: 'specialDefense', lower: 'attack' },
    Gentle: { boost: 'specialDefense', lower: 'defense' },
    Sassy: { boost: 'specialDefense', lower: 'speed' },
    Careful: { boost: 'specialDefense', lower: 'specialAttack' },
    Quirky: null,
  }

function natureStatClass(pokemon: PokemonNode, statKey: StatKey): string {
  const effect = pokemon.nature ? NATURE_EFFECT[pokemon.nature.name] : null
  if (!effect) return ''
  if (effect.boost === statKey) return ' camp-details-stat-row--boosted'
  if (effect.lower === statKey) return ' camp-details-stat-row--lowered'
  return ''
}

type DetailsView = 'overview' | 'movesTraits' | 'statsTraining'

function speciesName(nationalDex: number): string {
  return DEX_NAME[nationalDex] ?? `#${nationalDex}`
}

function NicknameRow({ pokemon }: { pokemon: PokemonNode }) {
  return (
    <div className="camp-details-row camp-details-header">
      <span className="camp-details-nickname">
        {pokemon.nickname || speciesName(pokemon.species)}
      </span>
      <span className="camp-details-badges">
        {pokemon.shiny && <span title="Shiny">★</span>}
        <span>Lv. {pokemon.level}</span>
        <span>{GENDER_SYMBOL[pokemon.gender]}</span>
      </span>
    </div>
  )
}

function SpeciesRow({ pokemon }: { pokemon: PokemonNode }) {
  return (
    <div className="camp-details-row camp-details-species">
      <span>
        {speciesName(pokemon.species)} · #
        {String(pokemon.species).padStart(3, '0')}
      </span>
    </div>
  )
}

function spriteDisplay(pokemon: PokemonNode, resolver: SpriteResolver) {
  return resolveSpriteDisplay(resolver, {
    nationalDex: pokemon.species,
    displayName: pokemon.nickname || speciesName(pokemon.species),
    formId: pokemon.form === 0 ? undefined : pokemon.form,
    gender: GENDER_TO_SPRITE[pokemon.gender],
    shiny: pokemon.shiny,
    egg: pokemon.isEgg,
  })
}

/**
 * The species row plus sprite, in the same size/position on every view --
 * only its transparency changes (full on Overview, where it's the subject;
 * faint on Moves & Traits / Stats, where it's a quiet constant
 * behind the page's actual new content) so flipping between views doesn't
 * jump the image around.
 */
function TopRow({
  pokemon,
  resolver,
  faint = false,
}: {
  pokemon: PokemonNode
  resolver: SpriteResolver
  faint?: boolean
}) {
  const display = spriteDisplay(pokemon, resolver)
  return (
    <div className="camp-details-top">
      <div className="camp-details-top-text">
        <SpeciesRow pokemon={pokemon} />
      </div>
      <div className="camp-details-artwork">
        <img
          key={spriteDisplayImageSrc(display)}
          className={`camp-details-sprite${faint ? ' camp-details-sprite--faint' : ''}`}
          src={spriteDisplayImageSrc(display)}
          alt={pokemon.nickname || speciesName(pokemon.species)}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <SpriteCredit display={display} />
      </div>
    </div>
  )
}

function Overview({
  pokemon,
  resolver,
}: {
  pokemon: PokemonNode
  resolver: SpriteResolver
}) {
  return (
    <>
      <NicknameRow pokemon={pokemon} />
      <TopRow pokemon={pokemon} resolver={resolver} />

      {/* Same position/size as Moves & Traits' Nature/Ability row below. */}
      <div className="camp-details-row">
        <div className="camp-details-field">
          <span className="camp-details-label">Held Item</span>
          <span className="camp-details-value">
            {pokemon.heldItemName || 'No held item'}
          </span>
        </div>
      </div>

      <div className="camp-details-row">
        <div className="camp-details-field">
          <span className="camp-details-label">Original Trainer</span>
          <span className="camp-details-value">
            {pokemon.originalTrainerName || NOT_YET_AVAILABLE}
          </span>
        </div>
        <div className="camp-details-field">
          <span className="camp-details-label">Trainer ID</span>
          <span className="camp-details-value">
            {pokemon.originalTrainerId}
          </span>
        </div>
      </div>

      <div className="camp-details-row camp-details-ribbons">
        <div className="camp-details-field">
          <span className="camp-details-label">Ribbons</span>
          {pokemon.ribbons.length === 0 ? (
            <span className="camp-details-value">No ribbons</span>
          ) : (
            <ul className="camp-details-ribbon-list">
              {pokemon.ribbons.map((ribbon) => (
                <li key={ribbon.id >= 0 ? ribbon.id : ribbon.name}>
                  <img
                    className="camp-details-ribbon-icon"
                    src={`${import.meta.env.BASE_URL}ribbons/${ribbon.iconFile}`}
                    alt={ribbon.shortName}
                    title={ribbon.shortName}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

function MovesAndTraits({
  pokemon,
  resolver,
}: {
  pokemon: PokemonNode
  resolver: SpriteResolver
}) {
  return (
    <>
      <NicknameRow pokemon={pokemon} />
      <TopRow pokemon={pokemon} resolver={resolver} faint />

      {/* Same position/size as Overview's Held Item row above. */}
      <div className="camp-details-row">
        <div className="camp-details-field">
          <span className="camp-details-label">Nature</span>
          <span className="camp-details-value">
            {pokemon.nature?.name ?? NOT_YET_AVAILABLE}
          </span>
        </div>
        <div className="camp-details-field">
          <span className="camp-details-label">Ability</span>
          <span className="camp-details-value">
            {pokemon.ability?.name ?? NOT_YET_AVAILABLE}
          </span>
        </div>
      </div>

      <p className="camp-details-section-title">Moves</p>
      <div className="camp-details-row camp-details-moves">
        {pokemon.moves.every((move) => move === null) ? (
          <span>No moves</span>
        ) : (
          <ul className="camp-details-move-list">
            {pokemon.moves.map((move, index) =>
              move ? (
                <li key={index}>
                  <span>{move.name}</span>
                  <span className="camp-card-sub">PP {move.pp}</span>
                </li>
              ) : (
                <li key={index} className="camp-card-sub">
                  —
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </>
  )
}

function StatRow({
  label,
  statKey,
  pokemon,
}: {
  label: string
  statKey: StatKey
  pokemon: PokemonNode
}) {
  return (
    <div
      className={`camp-details-stat-row${natureStatClass(pokemon, statKey)}`}
    >
      <span className="camp-details-stat-name">{label}</span>
      <span className="camp-details-stat-value">{pokemon.stats[statKey]}</span>
      <span className="camp-details-stat-iv">{pokemon.ivs[statKey]}</span>
      <span className="camp-details-stat-ev">{pokemon.evs[statKey]}</span>
    </div>
  )
}

const STAT_GROUPS: ReadonlyArray<
  ReadonlyArray<{ label: string; statKey: StatKey }>
> = [
  [
    { label: 'HP', statKey: 'hp' },
    { label: 'Attack', statKey: 'attack' },
    { label: 'Defense', statKey: 'defense' },
  ],
  [
    { label: 'Sp. Atk', statKey: 'specialAttack' },
    { label: 'Sp. Def', statKey: 'specialDefense' },
    { label: 'Speed', statKey: 'speed' },
  ],
]

function StatsAndTraining({
  pokemon,
  resolver,
}: {
  pokemon: PokemonNode
  resolver: SpriteResolver
}) {
  return (
    <>
      <NicknameRow pokemon={pokemon} />
      <TopRow pokemon={pokemon} resolver={resolver} faint />

      <p className="camp-details-section-title">Stats</p>
      <div className="camp-details-stats-columns">
        {STAT_GROUPS.map((group) => (
          <div className="camp-details-stats" key={group[0].statKey}>
            <div className="camp-details-stats-header">
              <span />
              <span>Stat</span>
              <span>IV</span>
              <span>EV</span>
            </div>
            {group.map(({ label, statKey }) => (
              <StatRow
                key={statKey}
                label={label}
                statKey={statKey}
                pokemon={pokemon}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

const NEXT_VIEW: Record<DetailsView, DetailsView | null> = {
  overview: 'movesTraits',
  movesTraits: 'statsTraining',
  statsTraining: null,
}
const PREVIOUS_VIEW: Record<DetailsView, DetailsView | null> = {
  overview: null,
  movesTraits: 'overview',
  statsTraining: 'movesTraits',
}
const VIEW_LABEL: Record<DetailsView, string> = {
  overview: 'Overview',
  movesTraits: 'Moves & Traits',
  statsTraining: 'Stats',
}

export function PokemonDetails({
  pokemon,
  resolver,
}: {
  pokemon: PokemonNode
  resolver: SpriteResolver
}) {
  // Deliberately not reset when `pokemon` changes — clicking a different
  // Pokémon while viewing e.g. Stats & Training should stay on that view.
  const [view, setView] = useState<DetailsView>('overview')
  const previousView = PREVIOUS_VIEW[view]
  const nextView = NEXT_VIEW[view]

  return (
    <div className="camp-panel camp-details">
      {view === 'overview' && (
        <Overview pokemon={pokemon} resolver={resolver} />
      )}
      {view === 'movesTraits' && (
        <MovesAndTraits pokemon={pokemon} resolver={resolver} />
      )}
      {view === 'statsTraining' && (
        <StatsAndTraining pokemon={pokemon} resolver={resolver} />
      )}

      <div className="camp-details-nav">
        {previousView ? (
          <button
            type="button"
            className="camp-details-nav-link"
            onClick={() => setView(previousView)}
          >
            ← {VIEW_LABEL[previousView]}
          </button>
        ) : (
          <span />
        )}
        {nextView ? (
          <button
            type="button"
            className="camp-details-nav-link"
            onClick={() => setView(nextView)}
          >
            {VIEW_LABEL[nextView]} →
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  )
}
