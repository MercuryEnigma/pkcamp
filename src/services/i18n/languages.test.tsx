import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageMenu } from '../../pages/hub/LanguageMenu'
import {
  availableLanguages,
  languageName,
  languageStorageKey,
  savedLanguage,
  saveLanguage,
} from './languages'
import { resources } from './resources'
import './index'

afterEach(() => vi.unstubAllGlobals())

describe('language preferences', () => {
  it('offers only registered catalogs with recognizable language names', () => {
    expect(availableLanguages).toEqual(['en'])
    expect(availableLanguages.every((language) => language in resources)).toBe(
      true
    )
    expect(languageName('en')).toBe('English')
    const html = renderToStaticMarkup(<LanguageMenu />)
    expect(html).toContain('aria-label="Language"')
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain(
      'role="menuitemradio" aria-checked="true" lang="en">English</button>'
    )
    expect(html).not.toContain('lang="es"')
  })

  it('saves and restores supported preferences and ignores unavailable catalogs', () => {
    vi.stubGlobal('window', {})
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
    expect(savedLanguage()).toBe('en')
    saveLanguage('en')
    expect(values.get(languageStorageKey)).toBe('en')
    expect(savedLanguage()).toBe('en')
    saveLanguage('unavailable')
    expect(values.get(languageStorageKey)).toBe('en')
    values.set(languageStorageKey, 'unavailable')
    expect(savedLanguage()).toBe('en')
    values.set(languageStorageKey, 'es')
    expect(savedLanguage()).toBe('en')
    saveLanguage('en')
    saveLanguage('es')
    expect(values.get(languageStorageKey)).toBe('en')
  })

  it('works when browser storage access is denied', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    })
    expect(savedLanguage()).toBe('en')
    expect(() => saveLanguage('en')).not.toThrow()
  })
})
