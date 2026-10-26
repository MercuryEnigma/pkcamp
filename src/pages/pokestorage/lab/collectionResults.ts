import type { StoredCollectionResult } from '../../../services/storage'
import type { ScannedPokemon } from './collectionTypes'

type StoredEntry = StoredCollectionResult['entries'][string]
type StoredMatch = StoredEntry['matches'][number]

/** Only the summary of a match is stored, never the whole Pokémon. */
export function toStoredMatch(scanned: ScannedPokemon): StoredMatch {
  const { node, source } = scanned
  const where =
    'camp' in source
      ? { camp: true as const, location: source.location }
      : {
          gameId: source.gameId,
          location: source.location,
          ...(source.boxName !== undefined ? { boxName: source.boxName } : {}),
        }
  return {
    ...where,
    species: node.species,
    form: node.form,
    nickname: node.nickname,
    originalTrainerName: node.originalTrainerName,
    originalTrainerId: node.originalTrainerId,
    level: node.level,
    shiny: node.shiny,
    moves: node.moves.flatMap((move) => (move ? [move.name] : [])),
    ...(node.ability ? { ability: node.ability.name } : {}),
    ...(node.nature ? { nature: node.nature.name } : {}),
    ...(node.heldItemName ? { heldItem: node.heldItemName } : {}),
    ribbons: node.ribbons.map((ribbon) => ribbon.name),
  }
}
