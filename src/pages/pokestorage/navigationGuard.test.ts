import { describe, expect, it, vi } from 'vitest'
import { confirmNavigation } from './navigationGuard'

describe('screen navigation guards', () => {
  it('allows navigation when no mounted screen blocks it', () => {
    expect(confirmNavigation([])).toBe(true)
    expect(confirmNavigation([() => true])).toBe(true)
  })
  it('keeps the active screen when its guard rejects leaving', () => {
    const later = vi.fn(() => true)
    expect(confirmNavigation([() => false, later])).toBe(false)
    expect(later).not.toHaveBeenCalled()
  })
  it('allows leaving after all active guards accept', () => {
    expect(confirmNavigation([() => true, () => true])).toBe(true)
  })
})
