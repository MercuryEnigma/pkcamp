import { describe, expect, it } from 'vitest'
import { natureStatEffect } from './natureStatEffect.ts'

describe('natureStatEffect', () => {
  it('marks only the stats changed by an effective nature', () => {
    const adamant = { id: 3, name: 'Adamant' }
    expect(natureStatEffect(adamant, 'attack')).toBe('+')
    expect(natureStatEffect(adamant, 'specialAttack')).toBe('-')
    expect(natureStatEffect(adamant, 'defense')).toBeNull()
    expect(natureStatEffect(adamant, 'hp')).toBeNull()
  })

  it('leaves neutral or unavailable natures unmarked', () => {
    expect(natureStatEffect({ id: 0, name: 'Hardy' }, 'attack')).toBeNull()
    expect(natureStatEffect(null, 'attack')).toBeNull()
    expect(natureStatEffect({ id: 3, name: 'Unknown' }, 'attack')).toBeNull()
  })
})
