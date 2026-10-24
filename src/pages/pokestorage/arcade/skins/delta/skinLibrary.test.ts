import { describe, expect, it } from 'vitest'
import { MemoryFileStore } from '../../../../../services/storage'
import { createSkinLibrary } from './skinLibrary'

describe('skin library', () => {
  it('saves, lists, reads, and removes skins', async () => {
    const library = createSkinLibrary(new MemoryFileStore())
    expect(await library.list()).toEqual([])

    const first = await library.save('First', new Uint8Array([1, 2]))
    const second = await library.save('Second', new Uint8Array([3]))
    expect(first.id).not.toBe(second.id)
    expect((await library.list()).map((skin) => skin.name)).toEqual([
      'First',
      'Second',
    ])
    expect(await library.read(first.id)).toEqual(new Uint8Array([1, 2]))

    await library.remove(first.id)
    expect((await library.list()).map((skin) => skin.id)).toEqual([second.id])
    expect(await library.read(first.id)).toBeNull()
  })

  it('keeps every skin when imports overlap', async () => {
    const library = createSkinLibrary(new MemoryFileStore())
    await Promise.all(
      ['A', 'B', 'C'].map((name) => library.save(name, new Uint8Array([0])))
    )
    expect(await library.list()).toHaveLength(3)
  })

  it('ignores a damaged index', async () => {
    const store = new MemoryFileStore()
    await store.write(
      'settings/arcade-skins/index.json',
      new TextEncoder().encode('{nope')
    )
    expect(await createSkinLibrary(store).list()).toEqual([])
  })
})
