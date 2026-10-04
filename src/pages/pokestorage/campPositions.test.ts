import { describe, expect, it } from 'vitest'
import {
  CAMP_SITE_SIZE,
  firstEmptyPosition,
  minimumCampSiteCount,
  resizeCampSites,
  sitesFromFlat,
} from './campPositions'

const empty = () => new Array<string | null>(CAMP_SITE_SIZE).fill(null)

describe('Camp Site positions', () => {
  it('needs the last occupied site plus one, and at least one site', () => {
    expect(minimumCampSiteCount([empty(), empty()])).toBe(1)
    const sites = [empty(), empty(), empty()]
    sites[1][4] = 'Pikachu'
    expect(minimumCampSiteCount(sites)).toBe(2)
  })

  it('adds empty sites without moving anyone', () => {
    const sites = [empty()]
    sites[0][5] = 'Bulbasaur'
    const resized = resizeCampSites(sites, 3)
    expect(resized).toHaveLength(3)
    expect(resized[0][5]).toBe('Bulbasaur')
  })

  it('never removes a site holding a Pokémon and never compacts', () => {
    const sites = [empty(), empty(), empty()]
    sites[0][0] = 'Bulbasaur'
    sites[2][7] = 'Pikachu'
    const resized = resizeCampSites(sites, 1)
    expect(resized).toHaveLength(3)
    expect(resized[2][7]).toBe('Pikachu')
    expect(resizeCampSites([empty(), empty(), empty()], 1)).toHaveLength(1)
  })

  it('caps an absurd requested count', () => {
    expect(resizeCampSites([empty()], 2_000_000_000)).toHaveLength(1000)
  })

  it('imports into the viewed site first, then the first empty position', () => {
    const sites = [empty(), empty()]
    sites[1].fill('x')
    expect(firstEmptyPosition(sites, 0)).toEqual({ site: 0, index: 0 })
    sites[0][0] = 'y'
    expect(firstEmptyPosition(sites, 1)).toEqual({ site: 0, index: 1 })
    sites[0].fill('y')
    expect(firstEmptyPosition(sites, 1)).toBeNull()
  })

  it('splits a flat array into full sites', () => {
    expect(sitesFromFlat(new Array(60).fill(null))).toHaveLength(2)
  })
})
