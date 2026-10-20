import { describe, expect, it, vi } from 'vitest'
import { GbaInputTracker } from './input'

describe('GbaInputTracker', () => {
  it('does not release a button while another source holds it', () => {
    const changed = vi.fn()
    const input = new GbaInputTracker(changed)

    input.setSource('keyboard:KeyX', ['a'])
    input.setSource('pointer:1', ['a'])
    input.releaseSource('pointer:1')
    expect(input.isPressed('a')).toBe(true)
    input.releaseSource('keyboard:KeyX')

    expect(changed.mock.calls).toEqual([
      ['a', true],
      ['a', false],
    ])
  })

  it('updates diagonals without toggling directions that remain held', () => {
    const changed = vi.fn()
    const input = new GbaInputTracker(changed)

    input.setSource('pointer:1', ['up', 'right'])
    input.setSource('pointer:1', ['right', 'down'])

    expect(changed.mock.calls).toEqual([
      ['up', true],
      ['right', true],
      ['up', false],
      ['down', true],
    ])
  })

  it('releases every active button once during cleanup', () => {
    const changed = vi.fn()
    const input = new GbaInputTracker(changed)
    input.setSource('keyboard:ArrowLeft', ['left'])
    input.setSource('pointer:1', ['left', 'b'])
    changed.mockClear()

    input.releaseAll()

    expect(new Set(changed.mock.calls.map(([button]) => button))).toEqual(
      new Set(['left', 'b'])
    )
    expect(changed.mock.calls.every(([, pressed]) => pressed === false)).toBe(
      true
    )
  })
})
