import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Gen3GameId } from '../../services/saveLibrary'
import { i18n } from '../../services/i18n'
import { GameCartridge } from '../hub/GameCartridge'
import { PageHeader } from '../hub/PageHeader'
import { routeHref } from '../routing'
import { cartridgeFileName } from './lab/downloadFile'
import { GAME_LABEL, getGameLabel } from './gameDisplay'

// Account controls depend on browser subscriptions; isolate the game header.
vi.mock('../hub/DropboxMenu', () => ({ DropboxMenu: () => null }))

const spanishNames: Record<Gen3GameId, string> = {
  ruby: 'Rubí',
  sapphire: 'Zafiro',
  emerald: 'Esmeralda',
  firered: 'Rojo Fuego',
  leafgreen: 'Verde Hoja',
}

afterEach(async () => {
  await i18n.changeLanguage('en')
})

it('renders all five Spanish game names in the chooser, accessible labels, and shared headers', async () => {
  await i18n.changeLanguage('es')
  for (const [id, name] of Object.entries(spanishNames)) {
    const gameId = id as Gen3GameId
    const cartridge = renderToStaticMarkup(
      <GameCartridge
        gameId={gameId}
        saveStatus="Partida lista"
        romStatus="Falta la ROM"
        romReady={false}
        onSelect={() => {}}
        onRom={() => {}}
      />
    )
    expect(cartridge).toContain(`aria-hidden="true">${name}</span>`)
    expect(cartridge).toContain(`aria-label="${name}: Partida lista"`)
    expect(cartridge).toContain(
      `aria-label="${name}: Falta la ROM. Añadir una ROM."`
    )
    expect(cartridge).toContain(`data-version="${id}"`)
    const header = renderToStaticMarkup(
      <PageHeader
        gameId={gameId}
        page="Campamento"
        onBack={() => {}}
        onOpenSettings={() => {}}
      />
    )
    expect(header).toContain(`class="site-page-game">${name}</span>`)
  }
})

it('resolves labels when the language changes and keeps English fallback', async () => {
  await i18n.changeLanguage('es')
  expect(getGameLabel('firered')).toBe('Rojo Fuego')
  await i18n.changeLanguage('en')
  for (const [id, name] of Object.entries(GAME_LABEL)) {
    expect(getGameLabel(id as Gen3GameId)).toBe(name)
  }
  await i18n.changeLanguage('fr')
  expect(getGameLabel('firered')).toBe('FireRed')
})

it('keeps routes, game IDs, and download filenames language independent', async () => {
  await i18n.changeLanguage('es')
  expect(GAME_LABEL.firered).toBe('FireRed')
  expect(routeHref('camp', { gameId: 'firered', mode: 'move' })).toContain(
    'game=firered'
  )
  expect(
    cartridgeFileName(
      { code: 'BPRE', title: 'POKEMON FIRE', saveSize: 131072 },
      'sav'
    )
  ).toBe('Pokemon FireRed (BPRE).sav')
})
