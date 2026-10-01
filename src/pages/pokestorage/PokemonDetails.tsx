import { useState } from 'react'
import type { PokemonNode, StatSpread } from '../../services/pkhex'
import { DEX_NAME } from './dexNames'

const GENDER_SYMBOL: Record<PokemonNode['gender'], string> = {
  Male: '♂',
  Female: '♀',
  Genderless: '',
}

/** Fields not yet exposed by the adapter (see PokemonNode) — honest placeholders, not guesses. */
const NOT_YET_AVAILABLE = '—'

function speciesName(nationalDex: number): string {
  return DEX_NAME[nationalDex] ?? `#${nationalDex}`
}

function Header({ pokemon }: { pokemon: PokemonNode }) {
  return (
    <>
      <div className="camp-details-row camp-details-header">
        <span className="camp-details-nickname">{pokemon.nickname || speciesName(pokemon.species)}</span>
        <span className="camp-details-badges">
          {pokemon.shiny && <span title="Shiny">★</span>}
          <span>Lv. {pokemon.level}</span>
          <span>{GENDER_SYMBOL[pokemon.gender]}</span>
        </span>
      </div>
      <div className="camp-details-row camp-details-species">
        <span>#{String(pokemon.species).padStart(3, '0')}</span>
        <span>{speciesName(pokemon.species)}</span>
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
  statKey: keyof StatSpread
  pokemon: PokemonNode
}) {
  return (
    <div className="camp-details-stat-row">
      <span className="camp-details-stat-name">{label}</span>
      <span className="camp-details-stat-value">{pokemon.stats[statKey]}</span>
      <span className="camp-details-stat-sub">
        IV: {pokemon.ivs[statKey]} EV: {pokemon.evs[statKey]}
      </span>
    </div>
  )
}

export function PokemonDetails({ pokemon }: { pokemon: PokemonNode }) {
  // Deliberately not reset when `pokemon` changes — clicking a different
  // Pokémon while viewing e.g. page 2 should stay on page 2.
  const [page, setPage] = useState<1 | 2 | 3>(1)

  return (
    <div className="camp-panel camp-details">
      <Header pokemon={pokemon} />

      {page === 1 && (
        <>
          <div className="camp-details-row">
            <span>{pokemon.heldItemName || 'No held item'}</span>
          </div>
          <div className="camp-details-row">
            <span>OT: {pokemon.originalTrainerName || NOT_YET_AVAILABLE}</span>
            <span>ID: {pokemon.originalTrainerId}</span>
          </div>
          <div className="camp-details-row camp-details-ribbons">
            {pokemon.ribbons.length === 0 ? (
              <span>No ribbons</span>
            ) : (
              <>
                <span>Ribbons:</span>
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
              </>
            )}
          </div>
        </>
      )}

      {page === 2 && (
        <>
          <div className="camp-details-row">
            <span>{pokemon.heldItemName || 'No held item'}</span>
          </div>
          <div className="camp-details-row">
            <span>Nature: {pokemon.nature?.name ?? NOT_YET_AVAILABLE}</span>
            <span>Ability: {pokemon.ability?.name ?? NOT_YET_AVAILABLE}</span>
          </div>
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
                  ),
                )}
              </ul>
            )}
          </div>
        </>
      )}

      {page === 3 && (
        <div className="camp-details-stats">
          <StatRow label="HP" statKey="hp" pokemon={pokemon} />
          <StatRow label="Atk" statKey="attack" pokemon={pokemon} />
          <StatRow label="Def" statKey="defense" pokemon={pokemon} />
          <StatRow label="SpA" statKey="specialAttack" pokemon={pokemon} />
          <StatRow label="SpD" statKey="specialDefense" pokemon={pokemon} />
          <StatRow label="Speed" statKey="speed" pokemon={pokemon} />
        </div>
      )}

      <div className="camp-details-nav">
        {page > 1 ? (
          <button type="button" className="camp-details-nav-link" onClick={() => setPage((p) => (p - 1) as 1 | 2)}>
            ← Page {page - 1}
          </button>
        ) : (
          <span />
        )}
        {page < 3 && (
          <button type="button" className="camp-details-nav-link" onClick={() => setPage((p) => (p + 1) as 2 | 3)}>
            Page {page + 1} →
          </button>
        )}
      </div>
    </div>
  )
}
