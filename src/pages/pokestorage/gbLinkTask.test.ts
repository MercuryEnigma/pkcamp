import { describe, expect, it, vi } from 'vitest'
import type { GbaCartInfo } from '../../services/gbaSaveDump/gbaCartClient'
import {
  gbLinkErrorMessage,
  readFromCartridge,
  restoreErrorMessage,
  taskErrorMessage,
} from './gbLinkTask'

describe('gbLinkErrorMessage', () => {
  it('explains a closed device chooser', () => {
    const cause = new DOMException('none', 'NotFoundError')
    expect(gbLinkErrorMessage(cause)).toBe('No device was chosen.')
  })

  it('uses the error message, or the fallback for non-errors', () => {
    expect(gbLinkErrorMessage(new Error('Link lost.'))).toBe('Link lost.')
    expect(gbLinkErrorMessage('x', 'Nope.')).toBe('Nope.')
  })
})

describe('taskErrorMessage', () => {
  it('reports cancellation and appends the retry advice to failures', () => {
    const describe = taskErrorMessage({
      cancelled: 'Stopped.',
      retry: 'Reset the GBA.',
    })
    expect(describe(new Error('Boom.'), true)).toBe('Stopped.')
    expect(describe(new Error('Boom.'), false)).toBe('Boom. Reset the GBA.')
  })
})

describe('restoreErrorMessage', () => {
  it('warns that the cartridge may have changed', () => {
    expect(restoreErrorMessage(null, true, 'Backup kept.')).toBe(
      'The restore was interrupted. The cartridge may have been changed. Backup kept. Check the cartridge before retrying.'
    )
  })
})

describe('readFromCartridge', () => {
  it('returns the bytes with the cartridge the read reported', async () => {
    const info = { title: 'POKEMON EMER' } as GbaCartInfo
    const onCartridge = vi.fn()
    const result = await readFromCartridge({ onCartridge }, async (task) => {
      task.onCartridge(info)
      return new Uint8Array([1])
    })
    expect(result).toEqual({ bytes: new Uint8Array([1]), cartridge: info })
    expect(onCartridge).toHaveBeenCalledWith(info)
  })
})
