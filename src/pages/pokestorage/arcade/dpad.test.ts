import { describe, expect, it } from 'vitest'
import { dpadDirections } from './dpad'

const at = (degrees: number, distance = 40) => {
  const radians = (degrees * Math.PI) / 180
  return dpadDirections(
    Math.cos(radians) * distance,
    -Math.sin(radians) * distance,
    50
  ).sort()
}

describe('dpadDirections', () => {
  it('presses nothing in the dead zone or on an empty pad', () => {
    expect(dpadDirections(3, -4, 50)).toEqual([])
    expect(dpadDirections(30, 0, 0)).toEqual([])
  })

  it('maps the four cardinal directions', () => {
    expect(at(0)).toEqual(['right'])
    expect(at(90)).toEqual(['up'])
    expect(at(180)).toEqual(['left'])
    expect(at(270)).toEqual(['down'])
  })

  it('maps the four diagonals', () => {
    expect(at(45)).toEqual(['right', 'up'])
    expect(at(135)).toEqual(['left', 'up'])
    expect(at(225)).toEqual(['down', 'left'])
    expect(at(315)).toEqual(['down', 'right'])
  })

  it('splits sectors at 22.5° either side of each cardinal', () => {
    expect(at(20)).toEqual(['right'])
    expect(at(25)).toEqual(['right', 'up'])
    expect(at(65)).toEqual(['right', 'up'])
    expect(at(70)).toEqual(['up'])
  })

  it('keeps working beyond the pad edge while the pointer is captured', () => {
    expect(at(90, 200)).toEqual(['up'])
  })
})
