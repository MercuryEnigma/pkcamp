import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableIsolation } from './enableIsolation'

afterEach(() => vi.unstubAllGlobals())

function browser(isolated = false, attempted = false) {
  const storage = new Map(
    attempted ? [['pkcamp:arcade:isolation-reload', '1']] : []
  )
  const reload = vi.fn()
  const register = vi.fn().mockResolvedValue({})
  vi.stubGlobal('crossOriginIsolated', isolated)
  vi.stubGlobal('navigator', {
    serviceWorker: { controller: {}, register, ready: Promise.resolve({}) },
  })
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key),
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
  vi.stubGlobal('window', { location: { reload } })
  return { storage, reload, register }
}

describe('Arcade isolation bootstrap', () => {
  it('reloads a controlled but unisolated first visit before mounting', async () => {
    const { reload } = browser()
    expect(await enableIsolation()).toBe(false)
    expect(reload).toHaveBeenCalledOnce()
  })
  it('allows the unsupported state after one failed isolation attempt', async () => {
    const { reload } = browser(false, true)
    expect(await enableIsolation()).toBe(true)
    expect(reload).not.toHaveBeenCalled()
  })
  it('clears the reload guard after isolation succeeds', async () => {
    const { storage, register } = browser(true, true)
    expect(await enableIsolation()).toBe(true)
    expect(storage.size).toBe(0)
    expect(register).not.toHaveBeenCalled()
  })
  it('propagates registration errors instead of mounting over them', async () => {
    const { register } = browser()
    register.mockRejectedValue(new Error('Worker blocked'))
    await expect(enableIsolation()).rejects.toThrow('Worker blocked')
  })
})
