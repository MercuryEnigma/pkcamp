/**
 * Generation 3 game data the Pokédex offers in pickers and filters.
 */

/** Generation 3 types by national dex number, as the games show them. */
const TYPES_BY_DEX = `
Grass/Poison Grass/Poison Grass/Poison Fire Fire Fire/Flying Water Water Water
Bug Bug Bug/Flying Bug/Poison Bug/Poison Bug/Poison Normal/Flying Normal/Flying Normal/Flying
Normal Normal Normal/Flying Normal/Flying Poison Poison Electric Electric Ground Ground
Poison Poison Poison/Ground Poison Poison Poison/Ground Normal Normal Fire Fire
Normal Normal Poison/Flying Poison/Flying Grass/Poison Grass/Poison Grass/Poison Bug/Grass Bug/Grass Bug/Poison
Bug/Poison Ground Ground Normal Normal Water Water Fighting Fighting Fire
Fire Water Water Water/Fighting Psychic Psychic Psychic Fighting Fighting Fighting
Grass/Poison Grass/Poison Grass/Poison Water/Poison Water/Poison Rock/Ground Rock/Ground Rock/Ground Fire Fire
Water/Psychic Water/Psychic Electric/Steel Electric/Steel Normal/Flying Normal/Flying Normal/Flying Water Water/Ice Poison
Poison Water Water/Ice Ghost/Poison Ghost/Poison Ghost/Poison Rock/Ground Psychic Psychic Water
Water Electric Electric Grass/Psychic Grass/Psychic Ground Ground Fighting Fighting Normal
Poison Poison Ground/Rock Ground/Rock Normal Grass Normal Water Water Water
Water Water Water/Psychic Psychic Bug/Flying Ice/Psychic Electric Fire Bug Normal
Water Water/Flying Water/Ice Normal Normal Water Electric Fire Normal Rock/Water
Rock/Water Rock/Water Rock/Water Rock/Flying Normal Ice/Flying Electric/Flying Fire/Flying Dragon Dragon
Dragon/Flying Psychic Psychic Grass Grass Grass Fire Fire Fire Water
Water Water Normal Normal Normal/Flying Normal/Flying Bug/Flying Bug/Flying Bug/Poison Bug/Poison
Poison/Flying Water/Electric Water/Electric Electric Normal Normal Normal Normal/Flying Psychic/Flying Psychic/Flying
Electric Electric Electric Grass Water Water Rock Water Grass/Flying Grass/Flying
Grass/Flying Normal Grass Grass Bug/Flying Water/Ground Water/Ground Psychic Dark Dark/Flying
Water/Psychic Ghost Psychic Psychic Normal/Psychic Bug Bug/Steel Normal Ground/Flying Steel/Ground
Normal Normal Water/Poison Bug/Steel Bug/Rock Bug/Fighting Dark/Ice Normal Normal Fire
Fire/Rock Ice/Ground Ice/Ground Water/Rock Water Water Ice/Flying Water/Flying Steel/Flying Dark/Fire
Dark/Fire Water/Dragon Ground Ground Normal Normal Normal Fighting Fighting Ice/Psychic
Electric Fire Normal Normal Electric Fire Water Rock/Ground Rock/Ground Rock/Dark
Psychic/Flying Fire/Flying Psychic/Grass Grass Grass Grass Fire Fire Fire/Fighting Water
Water Water/Ground Dark Dark Normal Normal Bug Bug Bug/Flying Bug
Bug/Poison Water/Grass Water/Grass Water/Grass Grass Grass/Dark Grass/Dark Normal/Flying Normal/Flying Water/Flying
Water/Flying Psychic Psychic Psychic Bug/Water Bug/Flying Grass Grass/Fighting Normal Normal
Normal Bug/Ground Bug/Flying Bug/Ghost Normal Normal Normal Fighting Fighting Normal
Rock Normal Normal Dark/Ghost Steel Steel/Rock Steel/Rock Steel/Rock Fighting/Psychic Fighting/Psychic
Electric Electric Electric Electric Bug Bug Grass/Poison Poison Poison Water/Dark
Water/Dark Water Water Fire/Ground Fire/Ground Fire Psychic Psychic Normal Ground
Ground/Dragon Ground/Dragon Grass Grass/Dark Normal/Flying Dragon/Flying Normal Poison Rock/Psychic Rock/Psychic
Water/Ground Water/Ground Water Water/Dark Ground/Psychic Ground/Psychic Rock/Grass Rock/Grass Rock/Bug Rock/Bug
Water Water Normal Normal Ghost Ghost Ghost Ghost Grass/Flying Psychic
Dark Psychic Ice Ice Ice/Water Ice/Water Ice/Water Water Water Water
Water/Rock Water Dragon Dragon Dragon/Flying Steel/Psychic Steel/Psychic Steel/Psychic Rock Ice
Steel Dragon/Psychic Dragon/Psychic Water Ground Dragon/Flying Steel/Psychic Psychic
`
  .trim()
  .split(/\s+/)
  .map((pair) => pair.split('/'))

/** The species' types (a national dex number from 1 to 386), or none. */
export function speciesTypes(species: number): readonly string[] {
  return TYPES_BY_DEX[species - 1] ?? []
}

/** Every type a Generation 3 species can have. */
export const TYPE_NAMES: readonly string[] = [
  'Normal',
  'Fire',
  'Water',
  'Electric',
  'Grass',
  'Ice',
  'Fighting',
  'Poison',
  'Ground',
  'Flying',
  'Psychic',
  'Bug',
  'Rock',
  'Ghost',
  'Dragon',
  'Dark',
  'Steel',
]

/** Each type's representative color, and the text color that reads on it. */
export const TYPE_COLORS: Record<string, { fill: string; text: string }> = {
  Normal: { fill: '#a8a77a', text: '#fff' },
  Fire: { fill: '#ee8130', text: '#fff' },
  Water: { fill: '#6390f0', text: '#fff' },
  Electric: { fill: '#f7d02c', text: '#3b3200' },
  Grass: { fill: '#7ac74c', text: '#143300' },
  Ice: { fill: '#96d9d6', text: '#0d3a38' },
  Fighting: { fill: '#c22e28', text: '#fff' },
  Poison: { fill: '#a33ea1', text: '#fff' },
  Ground: { fill: '#e2bf65', text: '#3d2f00' },
  Flying: { fill: '#a98ff3', text: '#fff' },
  Psychic: { fill: '#f95587', text: '#fff' },
  Bug: { fill: '#a6b91a', text: '#222900' },
  Rock: { fill: '#b6a136', text: '#fff' },
  Ghost: { fill: '#735797', text: '#fff' },
  Dragon: { fill: '#6f35fc', text: '#fff' },
  Dark: { fill: '#705746', text: '#fff' },
  Steel: { fill: '#b7b7ce', text: '#222233' },
}

/** The 25 natures, in PKHeX's text_Natures_en.txt order. */
export const NATURES = [
  'Hardy',
  'Lonely',
  'Brave',
  'Adamant',
  'Naughty',
  'Bold',
  'Docile',
  'Relaxed',
  'Impish',
  'Lax',
  'Timid',
  'Hasty',
  'Serious',
  'Jolly',
  'Naive',
  'Modest',
  'Mild',
  'Quiet',
  'Bashful',
  'Rash',
  'Calm',
  'Gentle',
  'Sassy',
  'Careful',
  'Quirky',
]

/** Every ribbon a Generation 3 Pokémon can hold, by PKHeX's display name. */
export const GEN3_RIBBONS = [
  'Champion (Gen3)',
  'Winning',
  'Victory',
  'Artist',
  'Effort',
  'Battle Champion',
  'Regional Champion',
  'National Champion',
  'Country',
  'National',
  'Earth',
  'World',
  ...['Cool', 'Beauty', 'Cute', 'Smart', 'Tough'].flatMap((contest) => [
    `${contest} (G3)`,
    `${contest} Super`,
    `${contest} Hyper`,
    `${contest} Master`,
  ]),
]
