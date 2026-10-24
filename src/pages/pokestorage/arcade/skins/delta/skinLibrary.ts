import { localFileStore, type FileStore } from '../../../../../services/storage'

/** The player's saved skins, kept on this device beside the other settings. */
export interface SavedSkin {
  id: string
  name: string
}

const FOLDER = 'settings/arcade-skins'
const INDEX_PATH = `${FOLDER}/index.json`
const SELECTED_KEY = 'pkcamp:arcade:controller-skin'

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function isSaved(value: unknown): value is SavedSkin {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as SavedSkin).id === 'string' &&
    typeof (value as SavedSkin).name === 'string'
  )
}

export function createSkinLibrary(store: FileStore = localFileStore) {
  /** Index edits queue, so two quick imports cannot overwrite each other. */
  let queue: Promise<unknown> = Promise.resolve()
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task)
    queue = run.catch(() => {})
    return run
  }
  const filePath = (id: string) => `${FOLDER}/${id}.deltaskin`

  async function readIndex(): Promise<SavedSkin[]> {
    const stored = await store.read(INDEX_PATH)
    if (!stored) return []
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(stored.bytes))
      return Array.isArray(parsed) ? parsed.filter(isSaved) : []
    } catch {
      return []
    }
  }
  const writeIndex = (skins: readonly SavedSkin[]) =>
    store.write(INDEX_PATH, new TextEncoder().encode(JSON.stringify(skins)))

  return {
    list: () => exclusive(readIndex),

    save: (name: string, bytes: Uint8Array) =>
      exclusive(async () => {
        const skin: SavedSkin = { id: newId(), name }
        await store.write(filePath(skin.id), bytes)
        await writeIndex([...(await readIndex()), skin])
        return skin
      }),

    remove: (id: string) =>
      exclusive(async () => {
        await writeIndex((await readIndex()).filter((skin) => skin.id !== id))
        await store.delete(filePath(id))
      }),

    read: async (id: string) => (await store.read(filePath(id)))?.bytes ?? null,
  }
}

export type SkinLibrary = ReturnType<typeof createSkinLibrary>

/** Which saved skin plays; null is pkCamp's default skin. */
export function loadSelectedSkinId(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY)
  } catch {
    return null
  }
}

export function saveSelectedSkinId(id: string | null): void {
  try {
    if (id) localStorage.setItem(SELECTED_KEY, id)
    else localStorage.removeItem(SELECTED_KEY)
  } catch {
    // Selection lasts for this visit only.
  }
}
