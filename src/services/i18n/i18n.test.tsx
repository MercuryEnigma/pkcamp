import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { i18n } from './index'
import { english } from './resources'
import {
  formatDate,
  formatList,
  formatNumber,
  formatRelativeTime,
} from './format'
import { Dialog } from '../../pages/hub/Dialog'
import { NewsPage } from '../../pages/NewsPage'
import { PatchNotes } from '../../pages/pokestorage/lab/PatchNotes'
import {
  getBindingName,
  DEFAULT_KEY_BINDINGS,
} from '../../pages/pokestorage/arcade/keyBindings'
import { bootSaveFor } from '../../pages/pokestorage/arcade/arcadeSession'
import { getMysteryGifts } from '../mysteryGift/gifts'
import { findHardcodedCopy, checkFiles } from '../../../scripts/check-i18n.mjs'

const namespaces = [
  'common',
  'start',
  'hub',
  'camp',
  'trade',
  'pokemon-details',
  'lab',
  'collections',
  'transporter',
  'mystery-gifts',
  'cartridge-saves',
  'rom-bios-dumps',
  'settings',
  'news',
  'arcade',
  'services',
]

afterEach(async () => {
  await i18n.changeLanguage('en')
  for (const ns of namespaces) i18n.removeResourceBundle('de', ns)
})

describe('page-based i18n', () => {
  it('initializes all English namespaces synchronously', () => {
    expect(i18n.isInitialized).toBe(true)
    expect(Object.keys(english).sort()).toEqual(namespaces.sort())
    expect(namespaces.every((ns) => i18n.hasResourceBundle('en', ns))).toBe(
      true
    )
    expect(i18n.t('common:actions.close')).toBe('Close')
  })

  it('falls back to English for missing languages and individual keys', async () => {
    i18n.addResource('de', 'common', 'actions.close', 'Schließen')
    await i18n.changeLanguage('de')
    expect(i18n.t('common:actions.close')).toBe('Schließen')
    expect(i18n.t('common:actions.continue')).toBe('Continue')
    await i18n.changeLanguage('fr')
    expect(i18n.t('common:actions.close')).toBe('Close')
  })

  it('exposes missing keys instead of silently supplying inline English', () => {
    expect(i18n.exists('common:missing.key')).toBe(false)
    // @ts-expect-error Unknown keys are also rejected at compile time.
    expect(i18n.t('common:missing.key')).toBe('missing.key')
  })

  it('interpolates values and selects real plural forms', () => {
    expect(
      i18n.t('trade:TradeSelectionPanels.roomPosition', {
        current: 2,
        total: 14,
      })
    ).toBe('Room 2 of 14')
    expect(
      i18n.t('settings:SettingsSections.minimumCampSites', { count: 1 })
    ).toContain('1 Camp Site:')
    expect(
      i18n.t('settings:SettingsSections.minimumCampSites', { count: 2 })
    ).toContain('2 Camp Sites:')
  })

  it('resolves helper labels at call time while preserving keyboard codes and gift ids', async () => {
    const names = getBindingName()
    const ids = getMysteryGifts().map((gift) => gift.id)
    i18n.addResource('de', 'arcade', 'keyBindings.up', 'Oben')
    i18n.addResource('de', 'services', 'gifts.trader', 'Tauschhelfer')
    await i18n.changeLanguage('de')
    expect(names.up).toBe('Up')
    expect(getBindingName().up).toBe('Oben')
    expect(DEFAULT_KEY_BINDINGS.up).toBe('ArrowUp')
    expect(getMysteryGifts().map((gift) => gift.id)).toEqual(ids)
    expect(getMysteryGifts().at(-1)?.label).toBe('Tauschhelfer')
    expect(bootSaveFor(new Uint8Array(3))).toEqual({
      kind: 'invalid',
      message: 'This is not a Gen 3 battery save (3 bytes).',
    })
  })

  it('uses the resolved language for numbers, dates, lists and relative time', async () => {
    i18n.addResourceBundle('de', 'common', { actions: { close: 'Schließen' } })
    await i18n.changeLanguage('de')
    expect(formatNumber(1234.5)).toBe(
      new Intl.NumberFormat('de').format(1234.5)
    )
    expect(formatList(['A', 'B'], 'disjunction')).toBe('A oder B')
    expect(formatRelativeTime(-1, 'day')).toBe(
      new Intl.RelativeTimeFormat('de', { numeric: 'auto' }).format(-1, 'day')
    )
    const date = new Date('2026-10-24T12:00:00Z')
    expect(formatDate(date, { month: 'long', year: 'numeric' })).toBe(
      new Intl.DateTimeFormat('de', { month: 'long', year: 'numeric' }).format(
        date
      )
    )
  })

  it('renders translated React copy with React escaping', async () => {
    i18n.addResource('de', 'common', 'actions.close', 'Schließen <jetzt>')
    await i18n.changeLanguage('de')
    const html = renderToStaticMarkup(
      <Dialog title="A & B" open onClose={() => {}}>
        Body
      </Dialog>
    )
    expect(html).toContain('A &amp; B')
    expect(html).toContain('Schließen &lt;jetzt&gt;')
  })

  it('keeps article links in React markup and allows translated text to reorder them', async () => {
    i18n.addResource(
      'de',
      'news',
      'PatchNotes.thisWasAchievedByBuildingOffOfPart1TornadusS',
      '<part1>Projekt</part1> machte dies möglich.'
    )
    await i18n.changeLanguage('de')
    const html = renderToStaticMarkup(<PatchNotes />)
    expect(html).toContain(
      'href="https://github.com/tornadus/frlg-ldn-trade">Projekt</a> machte dies möglich.'
    )
    expect(renderToStaticMarkup(<NewsPage />)).toContain(
      'building off of <a href="https://github.com/tornadus/frlg-ldn-trade">'
    )
    for (const markup of [html, renderToStaticMarkup(<NewsPage />)]) {
      expect(markup).not.toContain('[object Object]')
      expect(markup).not.toContain('{{')
      expect(markup).toContain('https://www.youtube-nocookie.com/embed/')
    }
  })
})

describe('UI copy guard', () => {
  it('detects hardcoded text and nested presentation values without flagging machine values', () => {
    const source = `<button className="button" data-mode="save" onClick={() => setMode('save')}
      aria-label={ready ? 'Save now' : 'Wait'}>Save changes</button>`
    expect(
      findHardcodedCopy(source).map((entry: { text: string }) => entry.text)
    ).toEqual(['Save now', 'Wait', 'Save changes'])
    expect(
      findHardcodedCopy(
        `<button aria-label={t('save')} className="save">{t('save')}</button>`
      )
    ).toEqual([])
    expect(findHardcodedCopy('<span>GB-Link</span>')).toEqual([])
    expect(findHardcodedCopy('<span>OK</span>')).toHaveLength(1)
    expect(
      findHardcodedCopy('<TradeSidePanel name="Your side" />')
    ).toHaveLength(1)
    expect(
      findHardcodedCopy('<BoxNav name="Choose one camper" />')
    ).toHaveLength(1)
    expect(findHardcodedCopy('<input name="username" />')).toEqual([])
  })

  it('audits every application React file', () => {
    expect(checkFiles()).toEqual([])
  })
})
