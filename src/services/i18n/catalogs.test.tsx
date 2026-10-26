import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PokeTransporter } from '../../pages/pokestorage/lab/PokeTransporter'
import { PokemonDetailsHeader } from '../../pages/pokestorage/PokemonDetails'
import { makeNode } from '../../pages/pokestorage/lab/testHelpers'
import { i18n } from './index'
import { english, resources } from './resources'

function strings(value: unknown, prefix = ''): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key
      return typeof child === 'string'
        ? [[path, child]]
        : Object.entries(strings(child, path))
    })
  )
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*-?\s*([^},\s]+)[^}]*\}\}/g)]
    .map((match) => match[1])
    .sort()
}

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('translated catalogs', () => {
  for (const [language, catalogs] of Object.entries(resources)) {
    if (language === 'en') continue
    for (const [namespace, translations] of Object.entries(catalogs)) {
      it(`${language}/${namespace} preserves English placeholder names`, () => {
        const source = strings(english[namespace as keyof typeof english])
        for (const [key, value] of Object.entries(strings(translations))) {
          expect(
            source[key],
            `${namespace}:${key} must have an English source`
          ).toBeDefined()
          expect(
            placeholders(value),
            `${language}/${namespace}:${key}`
          ).toEqual(placeholders(source[key]))
          const componentTags = (text: string) =>
            [...text.matchAll(/<\/?([A-Za-z][\w-]*)\s*\/?>/g)]
              .map((match) => match[0])
              .sort()
          expect(
            componentTags(value),
            `${language}/${namespace}:${key} components`
          ).toEqual(componentTags(source[key]))
        }
      })
    }
  }

  it('renders the actual Pokémon level in Spanish Camp view mode', async () => {
    await i18n.changeLanguage('es')
    const html = renderToStaticMarkup(
      <PokemonDetailsHeader pokemon={makeNode({ level: 42 })} />
    )
    expect(html).toContain('Nv. 42')
    expect(html).not.toContain('{{')
    expect(i18n.t('pokemon-details:PokemonSlotIcon.lv', { level: 42 })).toBe(
      'Nv. 42'
    )
    expect(i18n.t('lab:PokemonView.lv', { level: 42 })).toBe(' Nv. 42')
  })
  it('renders complete Spanish Transporter instructions and preserves the transfer warning', async () => {
    await i18n.changeLanguage('es')
    const html = renderToStaticMarkup(<PokeTransporter />)
    expect(html).toContain(
      'Los Pokémon transferidos se eliminan del juego de origen para siempre.'
    )
    expect(html).toContain('Se modificarán ambos juegos.')
    expect(html).not.toContain('copias no oficiales')
    expect(
      i18n.t(
        'transporter:PokeTransporter.insertTheGbaGameThatWillReceiveYourPokeMon'
      )
    ).toBe('Inserta el juego de GBA que recibirá tus Pokémon.')
    expect(html).not.toContain('Moved Pokémon')
    expect(html).not.toContain('{{')
  })

  it('does not reintroduce the word-substituted Spanish fragments', () => {
    const copy = Object.values(strings(resources.es))
    for (const text of copy) {
      expect(text).not.toMatch(
        /Moved Pokémon|Insert el|Atrás up|Tú need|Keep el|Reading el|could not|will receive|Choose your/
      )
    }
  })
})
