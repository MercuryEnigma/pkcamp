import type { PokemonSaveAdapter } from '../../services/pkhex'
import type { StorageProvider } from '../../services/storage'
import { i18n } from '../../services/i18n'
import { firstEmptyPosition } from './campPositions'

/** Validates a standalone Gen 3 Pokémon, then fills the first persisted gap. */
export async function importCampPokemon(
  provider: Pick<StorageProvider, 'getCamp' | 'saveCamp'>,
  adapter: PokemonSaveAdapter,
  fileName: string,
  bytes: Uint8Array
) {
  if (!/\.pk3$/i.test(fileName) || ![80, 100].includes(bytes.length))
    throw new Error(i18n.t('settings:useSettingsForm.chooseValidPk3'))
  const pokemon = adapter.importPokemonFile(bytes)
  if (
    !Number.isInteger(pokemon.species) ||
    pokemon.species < 1 ||
    pokemon.species > 386
  )
    throw new Error(i18n.t('settings:useSettingsForm.chooseValidPk3'))

  // Read fresh storage so importing never restores an outdated settings copy.
  const camp = await provider.getCamp(3)
  const position = firstEmptyPosition(camp.sites, 0)
  if (!position) throw new Error(i18n.t('settings:useSettingsForm.campFull'))
  const sites = camp.sites.map((site) => [...site])
  sites[position.site][position.index] = {
    id: `camp-${crypto.randomUUID()}`,
    fileName,
    bytes: bytes.slice(),
    importedAt: new Date().toISOString(),
  }
  const next = { sites }
  await provider.saveCamp(3, next)
  return { camp: next, position }
}
