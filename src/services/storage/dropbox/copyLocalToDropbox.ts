import type { FileStore } from '../fileStore'

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const GEN_PATTERN = /^gen-\d+$/
const CAMP_MANIFEST = 'camp.json'
const SETTINGS_PATH = 'settings.json'
const LAB_SETTINGS_PATH = 'lab/settings.json'
const LAB_COLLECTIONS = 'lab/collections'
const SAVE_FILES = ['current.sav', 'previous.sav', 'hardware.sav']

/** Dropbox keeps whole seconds, so compare at that precision. */
function seconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

async function copyFile(
  from: FileStore,
  to: FileStore,
  path: string
): Promise<boolean> {
  const file = await from.read(path)
  if (!file) return false
  await to.write(path, file.bytes, file.modified)
  return true
}

async function folders(store: FileStore, folder: string): Promise<string[]> {
  return (await store.list(folder))
    .filter((entry) => entry.kind === 'folder')
    .map((entry) => entry.name)
}

async function copySaves(local: FileStore, remote: FileStore): Promise<void> {
  for (const gameId of await folders(local, 'saves')) {
    const base = `saves/${gameId}`
    const localEntries = await local.list(base)
    const remoteEntries = await remote.list(base)
    const remoteDays = new Set(
      remoteEntries
        .filter((e) => e.kind === 'folder' && DAY_PATTERN.test(e.name))
        .map((e) => e.name)
    )

    for (const entry of localEntries) {
      if (entry.kind !== 'folder' || !DAY_PATTERN.test(entry.name)) continue
      const day = `${base}/${entry.name}`
      if (!remoteDays.has(entry.name)) {
        for (const name of SAVE_FILES)
          await copyFile(local, remote, `${day}/${name}`)
        continue
      }
      // Same day on both sides: a hardware backup is only added, never
      // replaced, and the newer current save wins.
      if (!(await remote.read(`${day}/hardware.sav`))) {
        await copyFile(local, remote, `${day}/hardware.sav`)
      }
      const localCurrent = await local.read(`${day}/current.sav`)
      if (!localCurrent) continue
      const remoteCurrent = await remote.read(`${day}/current.sav`)
      if (
        remoteCurrent &&
        seconds(localCurrent.modified) <= seconds(remoteCurrent.modified)
      ) {
        continue
      }
      await remote.write(
        `${day}/current.sav`,
        localCurrent.bytes,
        localCurrent.modified
      )
      if (!(await copyFile(local, remote, `${day}/previous.sav`))) {
        await remote.delete(`${day}/previous.sav`)
      }
    }

    const hasRemoteRom = remoteEntries.some(
      (e) => e.kind === 'file' && e.name.startsWith(`${gameId}.`)
    )
    if (!hasRemoteRom) {
      for (const entry of localEntries) {
        if (entry.kind === 'file' && entry.name.startsWith(`${gameId}.`)) {
          await copyFile(local, remote, `${base}/${entry.name}`)
          break
        }
      }
    }
  }
}

async function copyCamps(local: FileStore, remote: FileStore): Promise<void> {
  for (const gen of await folders(local, 'camp')) {
    if (!GEN_PATTERN.test(gen)) continue
    const folder = `camp/${gen}`
    if (await remote.read(`${folder}/${CAMP_MANIFEST}`)) continue
    const files = (await local.list(folder)).filter((e) => e.kind === 'file')
    // Manifest last, so an interrupted copy never looks like a finished Camp.
    for (const file of files) {
      if (file.name !== CAMP_MANIFEST) {
        await copyFile(local, remote, `${folder}/${file.name}`)
      }
    }
    await copyFile(local, remote, `${folder}/${CAMP_MANIFEST}`)
  }
}

/** Lab settings when Dropbox has none; uploaded collections by file name. */
async function copyLab(local: FileStore, remote: FileStore): Promise<void> {
  if (!(await remote.read(LAB_SETTINGS_PATH))) {
    await copyFile(local, remote, LAB_SETTINGS_PATH)
  }
  const remoteNames = new Set(
    (await remote.list(LAB_COLLECTIONS)).map((entry) => entry.name)
  )
  for (const entry of await local.list(LAB_COLLECTIONS)) {
    if (entry.kind === 'file' && !remoteNames.has(entry.name)) {
      await copyFile(local, remote, `${LAB_COLLECTIONS}/${entry.name}`)
    }
  }
}

/**
 * Uploads local data that Dropbox lacks, never changing local data.
 * Saves and ROMs by day and game, Camps and settings only when Dropbox has
 * none, and Lab collections Dropbox doesn't have yet. Account and migration bookkeeping files are never copied.
 */
export async function copyLocalToDropbox(
  local: FileStore,
  remote: FileStore
): Promise<void> {
  await copySaves(local, remote)
  await copyCamps(local, remote)
  if (!(await remote.read(SETTINGS_PATH))) {
    await copyFile(local, remote, SETTINGS_PATH)
  }
  await copyLab(local, remote)
}
