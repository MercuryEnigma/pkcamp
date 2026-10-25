import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, catalogTokens, resolveTheme, themeTokens } from './config'
import { campsite, resources, type ThemeCatalog } from './resources'
import { availableThemes, DEFAULT_THEME_ID, themeLabel } from './themes'

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a
  )
  return (light + 0.05) / (dark + 0.05)
}

/**
 * Text and the surface it sits on, held to WCAG AA (4.5:1) in every theme.
 * Not listed: Campsite's stat "lowered" blue (2.9:1 on its row) predates
 * themes, and disabled controls are exempt from contrast requirements.
 */
const TEXT_PAIRS: [string, string][] = [
  ['--text', '--bg'],
  ['--text-h', '--bg'],
  ['--camp-text', '--camp-surface'],
  ['--camp-text', '--camp-board'],
  ['--camp-text', '--camp-panel'],
  ['--camp-text', '--camp-panel-hover'],
  ['--camp-text', '--camp-menu-hover'],
  ['--camp-muted', '--camp-surface'],
  ['--camp-muted', '--camp-board'],
  ['--camp-leaf-text', '--camp-board'],
  ['--camp-leaf-text', '--camp-surface'],
  ['--camp-leaf-text', '--camp-mode-nav'],
  ['--camp-on-leaf', '--camp-leaf'],
  ['--camp-on-leaf', '--camp-leaf-hover'],
  ['--camp-on-leaf-warm', '--camp-leaf'],
  ['--camp-on-leaf-accent', '--camp-leaf'],
  ['--camp-on-leaf', '--cab-button-hover'],
  ['--camp-danger-text', '--camp-surface'],
  ['--camp-danger-text', '--camp-board'],
  ['--camp-on-danger', '--camp-danger'],
  ['--camp-on-bg', '--camp-bg'],
  ['--camp-credit', '--camp-surface'],
  ['--camp-details-value', '--camp-surface'],
  ['--camp-details-label', '--camp-surface'],
  ['--camp-details-species', '--camp-surface'],
  ['--camp-details-stat-value', '--camp-details-row-even'],
  ['--camp-details-stat-name', '--camp-details-row-odd'],
  ['--camp-select-red-text', '--camp-details-row-odd'],
  ['--camp-text', '--cab-alert'],
  ['--pc-text', '--pc-screen'],
  ['--pc-text', '--pc-paper'],
  ['--pc-text', '--pc-casing'],
  ['--pc-text', '--pc-button'],
  ['--pc-muted', '--pc-screen'],
  ['--pc-muted', '--pc-paper'],
  ['--pc-red-text', '--pc-screen'],
  ['--pc-red-text', '--pc-paper'],
  ['--pc-on-fill', '--pc-red'],
  ['--pc-on-fill', '--pc-graphite'],
  ['--pc-ready-text', '--pc-ready'],
  ['--pc-danger-text', '--pc-screen'],
  ['--pc-link', '--pc-screen'],
]

const registered = Object.entries(resources) as [string, ThemeCatalog][]

describe('theme catalogs', () => {
  it('define exactly the Campsite namespaces and tokens', () => {
    const namespaces = Object.keys(campsite).sort()
    for (const [id, catalog] of registered) {
      expect(Object.keys(catalog).sort(), id).toEqual(namespaces)
      for (const namespace of namespaces as (keyof ThemeCatalog)[]) {
        expect(
          Object.keys(catalog[namespace]).sort(),
          `${id}.${namespace}`
        ).toEqual(Object.keys(campsite[namespace]).sort())
      }
    }
  })

  it('use six-digit hex colors, so contrast can be checked', () => {
    for (const [id, catalog] of registered) {
      for (const [name, value] of Object.entries(catalogTokens(catalog))) {
        expect(value, `${id} ${name}`).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('keep text readable on its surfaces', () => {
    for (const [id, catalog] of registered) {
      const tokens = catalogTokens(catalog)
      for (const [foreground, background] of TEXT_PAIRS) {
        expect(
          contrast(tokens[foreground], tokens[background]),
          `${id}: ${foreground} on ${background}`
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('name every enabled theme', () => {
    expect(availableThemes.map(themeLabel)).toEqual(['Campsite', 'Night'])
  })
})

describe('theme selection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to the default for unknown or missing ids', () => {
    for (const id of [null, undefined, '', 'unknown', 'Campsite']) {
      expect(resolveTheme(id)).toBe(DEFAULT_THEME_ID)
    }
    for (const id of availableThemes) expect(resolveTheme(id)).toBe(id)
  })

  it('maps namespaces onto the existing CSS property names', () => {
    const tokens = themeTokens('night')
    expect(tokens['--camp-bg']).toBe(resources.night.camp.bg)
    expect(tokens['--pc-red']).toBe(resources.night.pc.red)
    expect(tokens['--cab-shadow']).toBe(resources.night.cabinet.shadow)
    expect(tokens['--text']).toBe(resources.night.common.text)
    expect(themeTokens('unknown')).toEqual(catalogTokens(campsite))
  })

  it('writes every token, the color scheme and the id onto the root', () => {
    const properties = new Map<string, string>()
    const root = {
      dataset: {} as Record<string, string>,
      style: {
        colorScheme: '',
        setProperty: (name: string, value: string) =>
          properties.set(name, value),
      },
    }
    vi.stubGlobal('document', { documentElement: root })

    expect(applyTheme('night')).toBe('night')
    expect(Object.fromEntries(properties)).toEqual(themeTokens('night'))
    expect(root.style.colorScheme).toBe('dark')
    expect(root.dataset.theme).toBe('night')

    expect(applyTheme('missing')).toBe('campsite')
    expect(properties.get('--camp-bg')).toBe(campsite.camp.bg)
    expect(root.style.colorScheme).toBe('light')
  })
})
