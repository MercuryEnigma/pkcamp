import { useNavigationGuard } from './navigationGuard'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { zipSync } from 'fflate'
import {
  ROSTER,
  type Gen3GameId,
  type Generation,
} from '../../services/saveLibrary'
import { initializeSpriteResolver } from '../../services/sprites'
import { type Camp, type StorageProvider } from '../../services/storage'
import { dropboxAccount } from '../../services/storage/dropbox'
import { minimumCampSiteCount, resizeCampSites } from './campPositions'
import {
  DEFAULT_SPRITE_SOURCE_ID,
  SPRITE_SOURCES,
} from '../../services/sprites/catalog'
import { GAME_LABEL } from './gameDisplay'
import { assertSaveMatchesCabin } from './saveVersion'
import {
  storageErrorMessage,
  useDropboxStatus,
  useStorageOffline,
  useStorageProvider,
  useStorageSettings,
} from './useStorage'
import { usePkHex } from '../context/PkHexContext'

/*
 * State and actions behind every settings page: Cabin backups, Camp Site
 * counts, the sprite source, and Dropbox. Settings are site-wide, so the
 * Camp Office and the Lab Zone's settings page edit the same data; each page
 * only supplies its own layout and text.
 */

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export const GEN_3_GAMES = ROSTER[3] as readonly Gen3GameId[]

type Camps = Map<Generation, Camp>
type SiteCounts = Record<Generation, number>
type BackupStatus = { hasSave: boolean; updatedAt: Date | null }

async function loadBackupStatuses(
  provider: StorageProvider
): Promise<Record<Gen3GameId, BackupStatus>> {
  const entries = await Promise.all(
    GEN_3_GAMES.map(async (gameId) => {
      const save = await provider.getSave(gameId)
      return [
        gameId,
        { hasSave: save !== null, updatedAt: save?.updatedAt ?? null },
      ] as const
    })
  )
  return Object.fromEntries(entries) as Record<Gen3GameId, BackupStatus>
}

export function formatBackupDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export type SettingsTab = 'backups' | 'appearance' | 'storage' | 'hardware'

/** The GBA Lodge is a single generation; its cabins are the Gen 3 games. */
export const GBA_GENERATION = 3 as const
/** What the Backup & Restore picker is showing: one cabin or the campsites. */
export type CabinSelection = Gen3GameId | 'campsites'

export function useSettingsForm({
  initialTab = 'backups',
  savedMessage,
}: {
  /** Tab to open first. */
  initialTab?: SettingsTab
  /** Shown once Save Settings succeeds. */
  savedMessage: string
}) {
  const { adapter } = usePkHex()
  const { provider, ready } = useStorageProvider()
  const { settings: savedSettings } = useStorageSettings()
  const offline = useStorageOffline()
  const dropboxStatus = useDropboxStatus()
  const [tab, setTab] = useState<SettingsTab>(initialTab)
  const [spriteSourceId, setSpriteSourceId] = useState(DEFAULT_SPRITE_SOURCE_ID)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [siteCounts, setSiteCounts] = useState<SiteCounts | null>(null)
  const [selectedCabin, setSelectedCabin] = useState<CabinSelection>(
    GEN_3_GAMES[0]
  )
  const [camps, setCamps] = useState<Camps | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [backups, setBackups] = useState<Record<
    Gen3GameId,
    BackupStatus
  > | null>(null)
  const [gbaAction, setGbaAction] = useState<
    | { gameId: Gen3GameId; mode: 'read' }
    | { gameId: Gen3GameId; mode: 'write'; save: Uint8Array }
    | null
  >(null)

  const selectedSpriteSource = useMemo(
    () =>
      SPRITE_SOURCES.find((candidate) => candidate.id === spriteSourceId) ??
      SPRITE_SOURCES[0],
    [spriteSourceId]
  )

  const spriteResolver = useMemo(
    () =>
      initializeSpriteResolver({
        sourceId: selectedSpriteSource.id,
        manifest: selectedSpriteSource.manifest,
        formAliases: selectedSpriteSource.formAliases,
      }),
    [selectedSpriteSource]
  )

  const refreshBackups = useCallback(async () => {
    try {
      setBackups(await loadBackupStatuses(provider))
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    }
  }, [provider])

  useEffect(() => {
    if (!ready) return
    let cancelled = false

    loadBackupStatuses(provider)
      .then((statuses) => {
        if (!cancelled) setBackups(statuses)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setMessage(storageErrorMessage(cause))
      })
    provider
      .getSettings()
      .then((settings) => {
        if (cancelled) return
        const stored = SPRITE_SOURCES.find(
          (source) => source.id === settings.spriteSourceId
        )
        setSpriteSourceId(stored?.id ?? DEFAULT_SPRITE_SOURCE_ID)
        setSettingsLoaded(true)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setMessage(storageErrorMessage(cause))
      })
    Promise.all(
      GENERATIONS.map(
        async (generation) =>
          [generation, await provider.getCamp(generation)] as const
      )
    )
      .then((entries) => {
        if (cancelled) return
        setCamps(new Map(entries))
        setSiteCounts(
          Object.fromEntries(
            entries.map(([generation, camp]) => [generation, camp.sites.length])
          ) as SiteCounts
        )
      })
      .catch((cause: unknown) => {
        if (!cancelled) setMessage(storageErrorMessage(cause))
      })
    return () => {
      cancelled = true
    }
  }, [provider, ready])

  /** Confirm before an incoming save overwrites a Cabin's existing backup. */
  const confirmReplaceBackup = (gameId: Gen3GameId): boolean => {
    const status = backups?.[gameId]
    if (!status?.hasSave) return true
    const when = status.updatedAt
      ? ` updated ${formatBackupDate(status.updatedAt)}`
      : ''
    return window.confirm(
      `Replace ${GAME_LABEL[gameId]} Cabin's backup? This replaces the backup${when} with the save you're bringing in.`
    )
  }

  const handleBackupUpload = async (
    gameId: Gen3GameId,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !adapter) return
    if (!confirmReplaceBackup(gameId)) return

    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const loaded = adapter.load(bytes)
      try {
        assertSaveMatchesCabin(gameId, loaded)
      } finally {
        loaded.dispose()
      }
      await provider.putSave(gameId, bytes)
      await refreshBackups()
      setMessage(`${GAME_LABEL[gameId]} Cabin backup saved.`)
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? storageErrorMessage(cause)
          : 'Unable to open that backup.'
      )
    }
  }

  /** The panel has already stored the save; refresh what the list shows. */
  const handleBackupRead = async (gameId: Gen3GameId) => {
    setGbaAction(null)
    setMessage(`${GAME_LABEL[gameId]} Cabin backup saved from GBA.`)
    await refreshBackups()
  }

  const handleBackupWrite = async (gameId: Gen3GameId) => {
    try {
      const save = await provider.getSave(gameId)
      if (save) setGbaAction({ gameId, mode: 'write', save: save.bytes })
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    }
  }

  const handleBackupExport = async (gameId: Gen3GameId) => {
    let bytes: Uint8Array | undefined
    try {
      bytes = (await provider.getSave(gameId))?.bytes
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    }
    if (!bytes) return
    const blob = new Blob([bytes.slice()], {
      type: 'application/octet-stream',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${gameId}.sav`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  /** Bundle every Camping Pokémon in the GBA Lodge into one `.zip`. */
  const handleDownloadCampsite = async () => {
    try {
      const camp = await provider.getCamp(GBA_GENERATION)
      const files: Record<string, Uint8Array> = {}
      const used = new Map<string, number>()
      for (const site of camp.sites) {
        for (const slot of site) {
          if (!slot) continue
          // Camp file names aren't guaranteed unique; disambiguate collisions
          // so the archive keeps every Pokémon rather than overwriting.
          const seen = used.get(slot.fileName) ?? 0
          used.set(slot.fileName, seen + 1)
          const name =
            seen === 0
              ? slot.fileName
              : slot.fileName.replace(/(\.[^.]+)?$/, `-${seen}$1`)
          files[name] = slot.bytes.slice()
        }
      }
      if (Object.keys(files).length === 0) {
        setMessage('The GBA Lodge campsite is empty.')
        return
      }
      const zipped = zipSync(files)
      const blob = new Blob([zipped.slice()], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'gba-lodge-campsite.zip'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    }
  }

  const handleBackupRemove = async (gameId: Gen3GameId) => {
    if (
      !window.confirm(
        `Remove the saved backup for ${GAME_LABEL[gameId]} Cabin? This cannot be undone.`
      )
    )
      return
    try {
      await provider.discardSave(gameId)
      await refreshBackups()
      setMessage(`${GAME_LABEL[gameId]} Cabin backup removed.`)
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    }
  }

  /** Empties the GBA Lodge Camp Sites; the Camp Site count stays. */
  const handleCampsiteRemove = async () => {
    const camp = camps?.get(GBA_GENERATION)
    if (!camps || !camp) return
    if (
      !window.confirm(
        'Delete every Camping Pokémon at the GBA Lodge Camp Sites? Download the campsite first to keep a copy. This cannot be undone.'
      )
    )
      return
    try {
      const emptied: Camp = {
        sites: camp.sites.map((site) => site.map(() => null)),
      }
      await provider.saveCamp(GBA_GENERATION, emptied)
      setCamps(new Map(camps).set(GBA_GENERATION, emptied))
      setMessage('GBA Lodge campsite deleted.')
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    }
  }

  // Positions are stable: a Camp can only shrink down to its last occupied
  // Camp Site, and nothing is moved to make room.
  const minimumSiteCounts = useMemo(() => {
    return Object.fromEntries(
      GENERATIONS.map((generation) => [
        generation,
        minimumCampSiteCount(camps?.get(generation)?.sites ?? []),
      ])
    ) as SiteCounts
  }, [camps])
  const campsiteMinimum = minimumSiteCounts[GBA_GENERATION]
  const hasChanges =
    settingsLoaded &&
    (spriteSourceId !==
      (savedSettings?.spriteSourceId ?? DEFAULT_SPRITE_SOURCE_ID) ||
      GENERATIONS.some(
        (generation) =>
          siteCounts &&
          camps &&
          siteCounts[generation] !== camps.get(generation)?.sites.length
      ))
  const confirmLeave = useNavigationGuard(
    hasChanges || saving,
    saving
      ? 'Settings are being saved. Leave this screen?'
      : 'You have unsaved settings. Leave without saving them?'
  )

  const handleSave = async () => {
    if (!camps || !siteCounts) return
    setSaving(true)
    setMessage(null)
    try {
      const nextCamps = new Map(camps)
      for (const generation of GENERATIONS) {
        const camp = camps.get(generation)!
        const count = Math.max(
          minimumSiteCounts[generation],
          Math.floor(siteCounts[generation])
        )
        if (count === camp.sites.length) continue
        const resized = { sites: resizeCampSites(camp.sites, count) }
        await provider.saveCamp(generation, resized)
        nextCamps.set(generation, resized)
      }
      setCamps(nextCamps)
      if (settingsLoaded) await provider.saveSettings({ spriteSourceId })
      setMessage(savedMessage)
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const handleDropbox = async (connect: boolean) => {
    if (!confirmLeave()) return
    setMessage(null)
    try {
      if (connect) await dropboxAccount.signIn()
      else await dropboxAccount.signOut()
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    }
  }

  const selectCabin = (selection: CabinSelection) => {
    setGbaAction(null)
    setSelectedCabin(selection)
  }

  return {
    adapter,
    provider,
    offline,
    dropboxStatus,
    tab,
    setTab,
    spriteSourceId,
    setSpriteSourceId,
    selectedSpriteSource,
    spriteResolver,
    siteCounts,
    setSiteCounts,
    selectedCabin,
    selectCabin,
    camps,
    saving,
    message,
    setMessage,
    backups,
    gbaAction,
    setGbaAction,
    confirmReplaceBackup,
    handleBackupUpload,
    handleBackupRead,
    handleBackupWrite,
    handleBackupExport,
    handleDownloadCampsite,
    handleBackupRemove,
    handleCampsiteRemove,
    campsiteMinimum,
    handleSave,
    handleDropbox,
  }
}

export type SettingsForm = ReturnType<typeof useSettingsForm>
