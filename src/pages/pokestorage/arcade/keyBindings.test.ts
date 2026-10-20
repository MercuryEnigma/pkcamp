import { describe, expect, it } from 'vitest'
import {
  BINDING_ORDER,
  DEFAULT_KEY_BINDINGS,
  actionForCode,
  assignKey,
  buttonForCode,
  canBind,
  keyLabel,
  parseKeyBindings,
} from './keyBindings'

describe('key bindings', () => {
  it('maps the default keys to buttons', () => {
    expect(buttonForCode(DEFAULT_KEY_BINDINGS, 'KeyA')).toBe('a')
    expect(buttonForCode(DEFAULT_KEY_BINDINGS, 'KeyS')).toBe('b')
    expect(buttonForCode(DEFAULT_KEY_BINDINGS, 'KeyQ')).toBe('l')
    expect(buttonForCode(DEFAULT_KEY_BINDINGS, 'KeyW')).toBe('r')
    expect(buttonForCode(DEFAULT_KEY_BINDINGS, 'ShiftRight')).toBe('select')
    expect(buttonForCode(DEFAULT_KEY_BINDINGS, 'KeyX')).toBeNull()
  })

  it('moves a key between buttons, leaving the old button unbound', () => {
    const next = assignKey(DEFAULT_KEY_BINDINGS, 'b', 'KeyA')
    expect(next.b).toBe('KeyA')
    expect(next.a).toBeNull()
    expect(buttonForCode(next, 'KeyA')).toBe('b')
    expect(DEFAULT_KEY_BINDINGS.a).toBe('KeyA')
  })

  it('never binds Escape or Tab', () => {
    expect(canBind('Escape')).toBe(false)
    expect(canBind('Tab')).toBe(false)
    expect(assignKey(DEFAULT_KEY_BINDINGS, 'a', 'Escape')).toBe(
      DEFAULT_KEY_BINDINGS
    )
  })

  it('labels keys readably', () => {
    expect(keyLabel('KeyX')).toBe('X')
    expect(keyLabel('Digit7')).toBe('7')
    expect(keyLabel('ArrowLeft')).toBe('←')
    expect(keyLabel('ShiftRight')).toBe('Right Shift')
    expect(keyLabel('Numpad5')).toBe('Num 5')
    expect(keyLabel(null)).toBe('None')
  })

  it('restores stored bindings and repairs bad or duplicate entries', () => {
    expect(parseKeyBindings(null)).toBe(DEFAULT_KEY_BINDINGS)
    expect(parseKeyBindings('not json')).toBe(DEFAULT_KEY_BINDINGS)
    const restored = parseKeyBindings(
      JSON.stringify({ a: 'KeyJ', b: 'KeyJ', start: 'Escape', up: 3 })
    )
    expect(restored.b).toBe('KeyJ')
    expect(restored.a).toBeNull()
    expect(restored.start).toBeNull()
    expect(restored.up).toBeNull()
  })

  it('binds the menu, mute, speed, guide, and restart shortcuts', () => {
    expect(actionForCode(DEFAULT_KEY_BINDINGS, 'KeyX')).toBe('menu')
    expect(actionForCode(DEFAULT_KEY_BINDINGS, 'KeyZ')).toBe('mute')
    expect(actionForCode(DEFAULT_KEY_BINDINGS, 'KeyD')).toBe('speed')
    expect(actionForCode(DEFAULT_KEY_BINDINGS, 'KeyE')).toBe('guide')
    expect(actionForCode(DEFAULT_KEY_BINDINGS, 'KeyP')).toBe('restart')
    expect(actionForCode(DEFAULT_KEY_BINDINGS, 'KeyA')).toBeNull()
    const next = assignKey(DEFAULT_KEY_BINDINGS, 'restart', 'KeyS')
    expect(next.b).toBeNull()
    expect(actionForCode(next, 'KeyS')).toBe('restart')
    expect(buttonForCode(next, 'KeyS')).toBeNull()
  })

  it('lists every binding once, in the Button layout order', () => {
    expect(BINDING_ORDER).toEqual([
      'up',
      'down',
      'left',
      'right',
      'a',
      'b',
      'start',
      'select',
      'l',
      'r',
      'menu',
      'mute',
      'speed',
      'guide',
      'restart',
    ])
    expect(Object.keys(DEFAULT_KEY_BINDINGS).sort()).toEqual(
      [...BINDING_ORDER].sort()
    )
    const keys = Object.values(DEFAULT_KEY_BINDINGS)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives shortcuts saved before they existed their free default keys', () => {
    const { menu: _menu, ...older } = DEFAULT_KEY_BINDINGS
    const restored = parseKeyBindings(JSON.stringify({ ...older, a: 'KeyX' }))
    expect(restored.a).toBe('KeyX')
    expect(restored.menu).toBeNull() // X is A's now
    expect(parseKeyBindings(JSON.stringify({ ...older })).menu).toBe('KeyX')
    // A shortcut the player cleared stays cleared.
    expect(
      parseKeyBindings(JSON.stringify({ ...DEFAULT_KEY_BINDINGS, mute: null }))
        .mute
    ).toBeNull()
  })
})
