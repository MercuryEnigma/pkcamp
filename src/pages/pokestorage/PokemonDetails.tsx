import {
  natureStatEffect,
  type PokemonNode,
  type StatSpread,
} from '../../services/pkhex'
import type { SpriteResolver } from '../../services/sprites'
import { resolveSpriteDisplay, spriteDisplayImageSrc } from './spriteDisplay'
import { SpriteCredit } from './SpriteCredit'
import { DEX_NAME } from './dexNames'
import type { DetailsView } from './pokemonDetailsPages'

const GENDER_SYMBOL: Record<PokemonNode['gender'], string> = {
  Male: '♂',
  Female: '♀',
  Genderless: '○',
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

function speciesName(nationalDex: number): string {
  return DEX_NAME[nationalDex] ?? `#${nationalDex}`
}

export function PokemonDetailsHeader({
  pokemon,
}: {
  pokemon: PokemonNode | null
}) {
  return (
    <div className="camp-details-view-header">
      <span className="camp-details-view-end" aria-hidden="true" />
      <span
        className="camp-details-view-shiny"
        title={pokemon?.shiny ? 'Shiny' : undefined}
        aria-label={pokemon?.shiny ? 'Shiny Pokémon' : undefined}
      >
        {pokemon?.shiny && (
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M10 4Q10 13 19 13Q10 13 10 22Q10 13 1 13Q10 13 10 4ZM19 0.5Q19 5 23.5 5Q19 5 19 9.5Q19 5 14.5 5Q19 5 19 0.5ZM19.5 16.0Q19.5 19.5 23.0 19.5Q19.5 19.5 19.5 23.0Q19.5 19.5 16.0 19.5Q19.5 19.5 19.5 16.0Z" />
          </svg>
        )}
      </span>
      <h2 className="camp-details-view-name">
        {pokemon ? pokemon.nickname || speciesName(pokemon.species) : 'Pokémon'}
      </h2>
      <span className="camp-details-view-level">
        {pokemon && (
          <>
            <span>Lv. {pokemon.level}</span>
            <span
              className="camp-details-view-gender"
              data-gender={pokemon.gender}
              aria-label={
                pokemon.gender === 'Genderless'
                  ? 'Genderless or unknown'
                  : pokemon.gender
              }
            >
              {GENDER_SYMBOL[pokemon.gender]}
            </span>
          </>
        )}
      </span>
      <span className="camp-details-view-end" aria-hidden="true" />
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

function IdentityBlock({
  pokemon,
  resolver,
}: {
  pokemon: PokemonNode
  resolver: SpriteResolver
}) {
  const display = spriteDisplay(pokemon, resolver)
  return (
    <div className="camp-details-identity">
      <div className="camp-details-identity-text">
        <div className="camp-details-species">
          {speciesName(pokemon.species)} · #
          {String(pokemon.species).padStart(3, '0')}
        </div>
      </div>
      <div className="camp-details-artwork">
        <img
          key={spriteDisplayImageSrc(display)}
          className="camp-details-sprite"
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

function Overview({ pokemon }: { pokemon: PokemonNode }) {
  return (
    <>
      <div className="camp-details-pair camp-details-pair--three">
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
        <div className="camp-details-field">
          <span className="camp-details-label">SID</span>
          <span className="camp-details-value">
            {pokemon.originalTrainerSecretId}
          </span>
        </div>
      </div>

      <div className="camp-details-section camp-details-ribbons">
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

function MovesAndTraits({ pokemon }: { pokemon: PokemonNode }) {
  return (
    <>
      <div className="camp-details-pair camp-details-pair--three">
        <div className="camp-details-field">
          <span className="camp-details-label">Ability</span>
          <span className="camp-details-value">
            {pokemon.ability?.name ?? NOT_YET_AVAILABLE}
          </span>
        </div>
        <div className="camp-details-field">
          <span className="camp-details-label">Held Item</span>
          <span className="camp-details-value">
            {pokemon.heldItemName || 'No held item'}
          </span>
        </div>
        <div className="camp-details-field">
          <span className="camp-details-label">Nature</span>
          <span className="camp-details-value">
            {pokemon.nature?.name ?? NOT_YET_AVAILABLE}
          </span>
        </div>
      </div>
      <div className="camp-details-section camp-details-moves">
        <p className="camp-details-section-title">Moves</p>
        {pokemon.moves.every((move) => move === null) ? (
          <span>No moves</span>
        ) : (
          <ul className="camp-details-move-list">
            {pokemon.moves.map((move, index) =>
              move ? (
                <li key={index}>
                  <span className="camp-details-move-name">{move.name}</span>
                  <span className="camp-details-move-pp">PP {move.pp}</span>
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
  const effect = natureStatEffect(pokemon.nature, statKey)
  return (
    <div className="camp-details-stat-row">
      <span className="camp-details-stat-name">
        <span>{label}</span>
        {effect && <span className="camp-details-stat-effect">({effect})</span>}
      </span>
      <span className="camp-details-stat-value">{pokemon.stats[statKey]}</span>
      <span className="camp-details-stat-iv">{pokemon.ivs[statKey]}</span>
      <span className="camp-details-stat-ev">{pokemon.evs[statKey]}</span>
    </div>
  )
}

const STATS: ReadonlyArray<{ label: string; statKey: StatKey }> = [
  { label: 'HP', statKey: 'hp' },
  { label: 'Attack', statKey: 'attack' },
  { label: 'Defense', statKey: 'defense' },
  { label: 'Sp. Atk', statKey: 'specialAttack' },
  { label: 'Sp. Def', statKey: 'specialDefense' },
  { label: 'Speed', statKey: 'speed' },
]

function StatsAndTraining({ pokemon }: { pokemon: PokemonNode }) {
  return (
    <div className="camp-details-section camp-details-stats-section">
      <p className="camp-details-section-title">Stats</p>
      <div className="camp-details-stats">
        <div className="camp-details-stats-header">
          <span />
          <span>Stat</span>
          <span>IV</span>
          <span>EV</span>
        </div>
        {STATS.map(({ label, statKey }) => (
          <StatRow
            key={statKey}
            label={label}
            statKey={statKey}
            pokemon={pokemon}
          />
        ))}
      </div>
    </div>
  )
}

export function PokemonDetails({
  pokemon,
  resolver,
  view,
}: {
  pokemon: PokemonNode
  resolver: SpriteResolver
  view: DetailsView
}) {
  return (
    <div className="camp-details-content">
      <IdentityBlock pokemon={pokemon} resolver={resolver} />
      {view === 'overview' && <Overview pokemon={pokemon} />}
      {view === 'movesTraits' && <MovesAndTraits pokemon={pokemon} />}
      {view === 'statsTraining' && <StatsAndTraining pokemon={pokemon} />}
    </div>
  )
}
