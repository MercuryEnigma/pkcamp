import { describe, expect, it } from 'vitest'
import { resolveRoute, routeHref } from './routing'

const base = '/pkcamp/'
const at = (pathname: string, search = '') =>
  resolveRoute({ pathname, search } as Location, base)

describe('pkCamp routes', () => {
  it('parses the public pages and selected game', () => {
    expect(at('/pkcamp/')).toEqual({
      kind: 'route',
      route: { page: 'start', gameId: null },
    })
    expect(at('/pkcamp/hub/', '?game=emerald')).toEqual({
      kind: 'route',
      route: { page: 'hub', gameId: 'emerald' },
    })
    expect(at('/pkcamp/lab/', '?game=ruby&mode=settings&tab=storage')).toEqual({
      kind: 'route',
      route: {
        page: 'lab',
        gameId: 'ruby',
        mode: 'settings',
        tab: 'storage',
      },
    })
  })

  it('canonicalizes Camp defaults and no-game Campsites', () => {
    expect(at('/pkcamp/camp/', '?game=leafgreen')).toEqual({
      kind: 'redirect',
      href: '/pkcamp/camp/?game=leafgreen&mode=move',
    })
    expect(at('/pkcamp/camp/', '?mode=campsite')).toEqual({
      kind: 'redirect',
      href: '/pkcamp/camp/?mode=move',
    })
  })

  it('rejects unsupported, duplicate, and page-inappropriate values', () => {
    const invalid = [
      at('/pkcamp/hub/', '?game=diamond'),
      at('/pkcamp/camp/', '?mode=unknown'),
      at('/pkcamp/lab/', '?mode=settings&tab=unknown'),
      at('/pkcamp/hub/', '?mode=move'),
      at('/pkcamp/hub/', '?game=ruby&game=emerald'),
      at('/pkcamp/elsewhere/'),
    ]
    for (const result of invalid) {
      expect(result).toEqual({ kind: 'redirect', href: '/pkcamp/' })
    }
  })

  it('requires a game for Arcade', () => {
    expect(at('/pkcamp/arcade/')).toEqual({
      kind: 'redirect',
      href: '/pkcamp/hub/',
    })
    expect(at('/pkcamp/arcade/', '?game=firered')).toEqual({
      kind: 'route',
      route: { page: 'arcade', gameId: 'firered' },
    })
  })

  it('builds base-relative URLs in canonical parameter order', () => {
    expect(
      routeHref(
        'lab',
        { gameId: 'sapphire', mode: 'settings', tab: 'hardware' },
        base
      )
    ).toBe('/pkcamp/lab/?game=sapphire&mode=settings&tab=hardware')
  })
})
