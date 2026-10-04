import { describe, expect, it } from 'vitest'
import { MemoryFileStore } from '../fileStore'
import { copyLocalToDropbox } from './copyLocalToDropbox'

const bytes = (...values: number[]) => new Uint8Array(values)
const t = (iso: string) => new Date(iso)

async function text(store: MemoryFileStore, path: string) {
  const file = await store.read(path)
  return file ? [...file.bytes] : null
}

describe('copyLocalToDropbox', () => {
  it('copies missing save days with modified times', async () => {
    const local = new MemoryFileStore()
    const remote = new MemoryFileStore()
    const day = 'saves/emerald/2026-10-01'
    await local.write(`${day}/current.sav`, bytes(1), t('2026-10-01T10:00:00Z'))
    await local.write(
      `${day}/previous.sav`,
      bytes(2),
      t('2026-09-30T10:00:00Z')
    )
    await copyLocalToDropbox(local, remote)
    expect(await text(remote, `${day}/current.sav`)).toEqual([1])
    expect(await text(remote, `${day}/previous.sav`)).toEqual([2])
    expect((await remote.read(`${day}/previous.sav`))!.modified).toEqual(
      t('2026-09-30T10:00:00Z')
    )
  })

  it('keeps remote days and lets the newer current save win on the same day', async () => {
    const local = new MemoryFileStore()
    const remote = new MemoryFileStore()
    const day = 'saves/emerald/2026-10-01'
    await local.write(`${day}/current.sav`, bytes(1), t('2026-10-01T12:00:00Z'))
    await local.write(
      `${day}/previous.sav`,
      bytes(7),
      t('2026-09-30T00:00:00Z')
    )
    await remote.write(
      `${day}/current.sav`,
      bytes(3),
      t('2026-10-01T09:00:00Z')
    )
    await remote.write(`${day}/previous.sav`, bytes(8))
    await remote.write('saves/emerald/2026-09-01/current.sav', bytes(4))
    await copyLocalToDropbox(local, remote)
    expect(await text(remote, `${day}/current.sav`)).toEqual([1])
    expect(await text(remote, `${day}/previous.sav`)).toEqual([7])
    expect(await text(remote, 'saves/emerald/2026-09-01/current.sav')).toEqual([
      4,
    ])
  })

  it('keeps a newer or equal remote current save', async () => {
    const local = new MemoryFileStore()
    const remote = new MemoryFileStore()
    const day = 'saves/emerald/2026-10-01'
    await local.write(
      `${day}/current.sav`,
      bytes(1),
      t('2026-10-01T09:00:00.900Z')
    )
    await remote.write(
      `${day}/current.sav`,
      bytes(3),
      t('2026-10-01T09:00:00Z')
    )
    await copyLocalToDropbox(local, remote)
    expect(await text(remote, `${day}/current.sav`)).toEqual([3])
    await local.write(`${day}/current.sav`, bytes(1), t('2026-10-01T08:00:00Z'))
    await copyLocalToDropbox(local, remote)
    expect(await text(remote, `${day}/current.sav`)).toEqual([3])
  })

  it('uploads a ROM only when Dropbox has none for the game', async () => {
    const local = new MemoryFileStore()
    const remote = new MemoryFileStore()
    await local.write('saves/emerald/emerald.gba', bytes(1))
    await local.write('saves/ruby/ruby.gba', bytes(2))
    await remote.write('saves/ruby/ruby.gb', bytes(9))
    await copyLocalToDropbox(local, remote)
    expect(await text(remote, 'saves/emerald/emerald.gba')).toEqual([1])
    expect(await remote.read('saves/ruby/ruby.gba')).toBeNull()
  })

  it('copies a Camp only when Dropbox has no manifest for the generation', async () => {
    const local = new MemoryFileStore()
    const remote = new MemoryFileStore()
    for (const gen of [3, 4]) {
      await local.write(`camp/gen-${gen}/camp.json`, bytes(gen))
      await local.write(`camp/gen-${gen}/a.pk${gen}`, bytes(10 + gen))
    }
    await remote.write('camp/gen-4/camp.json', bytes(99))
    await copyLocalToDropbox(local, remote)
    expect(await text(remote, 'camp/gen-3/camp.json')).toEqual([3])
    expect(await text(remote, 'camp/gen-3/a.pk3')).toEqual([13])
    expect(await text(remote, 'camp/gen-4/camp.json')).toEqual([99])
    expect(await remote.read('camp/gen-4/a.pk4')).toBeNull()
  })

  it('copies settings only when Dropbox has none, and skips bookkeeping folders', async () => {
    const local = new MemoryFileStore()
    const remote = new MemoryFileStore()
    await local.write('settings.json', bytes(1))
    await local.write('accounts/dropbox.json', bytes(2))
    await local.write('migrations/v1.json', bytes(3))
    await copyLocalToDropbox(local, remote)
    expect(await text(remote, 'settings.json')).toEqual([1])
    expect(await remote.list('')).toEqual([
      { name: 'settings.json', kind: 'file' },
    ])

    await local.write('settings.json', bytes(5))
    await copyLocalToDropbox(local, remote)
    expect(await text(remote, 'settings.json')).toEqual([1])
  })

  it('never changes local data', async () => {
    const local = new MemoryFileStore()
    const remote = new MemoryFileStore()
    await local.write('saves/g/2026-10-01/current.sav', bytes(1))
    await remote.write(
      'saves/g/2026-10-01/current.sav',
      bytes(2),
      t('2030-01-01T00:00:00Z')
    )
    await copyLocalToDropbox(local, remote)
    expect(await text(local, 'saves/g/2026-10-01/current.sav')).toEqual([1])
  })
})
