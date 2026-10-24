import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeDeltaSkin } from './normalizeDeltaSkin'
import { rasterizeSkinPdfs } from './rasterizePdfs'
import {
  DeltaSkinError,
  readDeltaSkinArchive,
  type DeltaSkinArchive,
} from './parseDeltaSkin'
import {
  createSkinLibrary,
  loadSelectedSkinId,
  saveSelectedSkinId,
  type SavedSkin,
} from './skinLibrary'

/** What skin a file would give: its archive, checked to be usable now. */
async function archiveOf(bytes: Uint8Array): Promise<DeltaSkinArchive> {
  const archive = await rasterizeSkinPdfs(await readDeltaSkinArchive(bytes))
  normalizeDeltaSkin(archive) // report an unusable skin now, not later
  return archive
}

/**
 * The saved skins and which one is selected. Shared by the Arcade's menu and
 * the Lab's settings, which edit the same stored library.
 */
export function useSkinLibrary() {
  const library = useMemo(() => createSkinLibrary(), [])
  const [skins, setSkins] = useState<SavedSkin[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [archive, setArchive] = useState<DeltaSkinArchive | null>(null)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(0)

  /** Makes `id` the played skin, or pkCamp's default for null. */
  const choose = useCallback(
    async (id: string | null, known?: DeltaSkinArchive) => {
      const attempt = ++latest.current
      let next: DeltaSkinArchive | null = null
      if (id) {
        try {
          const bytes = await library.read(id)
          next = known ?? (bytes ? await archiveOf(bytes) : null)
        } catch {
          next = null // a skin that no longer loads falls back quietly
        }
        if (!next) id = null
      }
      if (attempt !== latest.current) return
      setSelectedId(id)
      setArchive(next)
      saveSelectedSkinId(id)
    },
    [library]
  )

  useEffect(() => {
    void (async () => {
      try {
        const saved = await library.list()
        setSkins(saved)
        const wanted = loadSelectedSkinId()
        await choose(saved.some((skin) => skin.id === wanted) ? wanted : null)
      } catch {
        // No storage: only the built-in controller.
      }
    })()
  }, [library, choose])

  const importSkin = useCallback(
    async (file: File) => {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const imported = await archiveOf(bytes)
        const name =
          imported.info.name?.trim() ||
          file.name.replace(/\.(deltaskin|zip)$/i, '') ||
          'Delta skin'
        const saved = await library.save(name, bytes)
        setSkins((current) => [...current, saved])
        setError(null)
        await choose(saved.id, imported)
      } catch (caught) {
        setError(
          caught instanceof DeltaSkinError
            ? caught.message
            : 'The skin could not be saved or read.'
        )
      }
    },
    [library, choose]
  )

  const deleteSkin = useCallback(
    async (id: string) => {
      try {
        await library.remove(id)
        setSkins((current) => current.filter((skin) => skin.id !== id))
        if (id === selectedId) await choose(null)
        setError(null)
      } catch {
        setError('The skin could not be deleted.')
      }
    },
    [library, selectedId, choose]
  )

  return {
    skins,
    selectedId,
    archive,
    error,
    importSkin,
    selectSkin: (id: string | null) => {
      setError(null)
      return choose(id)
    },
    deleteSkin,
  }
}

export type SkinLibraryState = ReturnType<typeof useSkinLibrary>
