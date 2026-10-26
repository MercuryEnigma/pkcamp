import { activeGame } from '../../services/activeGame'
import { locale } from '../../services/i18n/format'
import { useTranslation } from 'react-i18next'
import { useNavigationGuard } from './navigationGuard'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { zipSync } from 'fflate'
import {
  ROSTER,
  type Gen3GameId,
  type Generation,
} from '../../services/saveLibrary'
import { initializeSpriteResolver } from '../../services/sprites'
import { applyTheme, resolveTheme, type ThemeId } from '../../services/themes'
import { type Camp, type StorageProvider } from '../../services/storage'
import { dropboxAccount } from '../../services/storage/dropbox'
import { minimumCampSiteCount, resizeCampSites } from './campPositions'
import {
  DEFAULT_SPRITE_SOURCE_ID,
  SPRITE_SOURCES,
} from '../../services/sprites/catalog'
import { getGameLabel } from './gameDisplay'
import { importCampPokemon } from './importCampPokemon'
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
  return new Intl.DateTimeFormat(locale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export type SettingsTab =
  | 'backups'
  | 'appearance'
  | 'storage'
  | 'hardware'
  | 'arcade-controls'
  | 'arcade-skin'

/** The GBA Lodge is a single generation; its cabins are the Gen 3 games. */
export const GBA_GENERATION = 3 as const
/** What the Backup & Restore picker is showing: one cabin or the campsites. */
export type CabinSelection = Gen3GameId | 'campsites'

export function useSettingsForm({
  initialTab = 'backups',
  initialCabin = GEN_3_GAMES[0],
  savedMessage,
}: {
  /** Tab to open first. */
  initialTab?: SettingsTab
  /** Cabin the Backup & Restore picker starts on. */
  initialCabin?: CabinSelection
  /** Shown once Save Settings succeeds. */
  savedMessage: string
}) {
  const { t } = useTranslation(['settings', 'common'] as const)

  const { adapter } = usePkHex()
  const { provider, ready } = useStorageProvider()
  const { settings: savedSettings } = useStorageSettings()
  const offline = useStorageOffline()
  const dropboxStatus = useDropboxStatus()
  const [tab, setTab] = useState<SettingsTab>(initialTab)
  const [spriteSourceId, setSpriteSourceId] = useState(DEFAULT_SPRITE_SOURCE_ID)
  const [themeId, setThemeId] = useState<ThemeId>(resolveTheme(null))
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [siteCounts, setSiteCounts] = useState<SiteCounts | null>(null)
  const [selectedCabin, setSelectedCabin] =
    useState<CabinSelection>(initialCabin)
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

  // The staged theme shows immediately but is only stored by Save; leaving
  // Settings puts the saved theme back.
  const savedThemeId = useRef(savedSettings?.themeId)
  useEffect(() => {
    savedThemeId.current = savedSettings?.themeId
  }, [savedSettings?.themeId])
  useLayoutEffect(() => {
    if (settingsLoaded) applyTheme(themeId, { remember: false })
  }, [settingsLoaded, themeId])
  useLayoutEffect(() => () => void applyTheme(savedThemeId.current), [])

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
        setThemeId(resolveTheme(settings.themeId))
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
    return window.confirm(
      status.updatedAt
        ? t('useSettingsForm.replaceDatedBackup', {
            game: getGameLabel(gameId),
            date: formatBackupDate(status.updatedAt),
          })
        : t('useSettingsForm.replaceBackup', { game: getGameLabel(gameId) })
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
      setMessage(
        t('useSettingsForm.cabinBackupSaved', { value1: getGameLabel(gameId) })
      )
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? storageErrorMessage(cause)
          : t('common:storage.unableToOpenThatBackup')
      )
    }
  }

  /** The panel has already stored the save; refresh what the list shows. */
  const handleBackupRead = async (gameId: Gen3GameId) => {
    setGbaAction(null)
    setMessage(
      t('useSettingsForm.cabinBackupSavedFromGba', {
        value1: getGameLabel(gameId),
      })
    )
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

  const campsiteAction = useRef(false)

  // Keep Camp and collection subscribers current without discarding save edits.
  const saveCampsite = async (camp: Camp) => {
    const active = activeGame.getSnapshot()
    if (active.status === 'ready' && active.provider === provider)
      await activeGame.replaceCamp(camp)
    else await provider.saveCamp(GBA_GENERATION, camp)
  }

  /** Pokémon uploads are saved immediately; site-count edits stay staged. */
  const handleCampsiteUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !adapter || offline || campsiteAction.current) return
    campsiteAction.current = true
    setSaving(true)
    setMessage(null)
    try {
      if (file.size > 100) throw new Error(t('useSettingsForm.chooseValidPk3'))
      const { camp, position } = await importCampPokemon(
        {
          getCamp: (generation) => provider.getCamp(generation),
          saveCamp: (_generation, camp) => saveCampsite(camp),
        },
        adapter,
        file.name,
        new Uint8Array(await file.arrayBuffer())
      )
      setCamps((current) => new Map(current).set(GBA_GENERATION, camp))
      setMessage(
        t('useSettingsForm.pokemonImported', {
          site: position.site + 1,
          slot: position.index + 1,
        })
      )
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    } finally {
      campsiteAction.current = false
      setSaving(false)
    }
  }

  /** The small Save beside the count changes only the Camp Site count. */
  const handleSaveCampsiteCount = async () => {
    if (!siteCounts || offline || campsiteAction.current) return
    campsiteAction.current = true
    setSaving(true)
    setMessage(null)
    try {
      const camp = await provider.getCamp(GBA_GENERATION)
      const next = {
        sites: resizeCampSites(camp.sites, siteCounts[GBA_GENERATION]),
      }
      await saveCampsite(next)
      setCamps((current) => new Map(current).set(GBA_GENERATION, next))
      setSiteCounts((current) => ({
        ...current!,
        [GBA_GENERATION]: next.sites.length,
      }))
      setMessage(savedMessage)
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    } finally {
      campsiteAction.current = false
      setSaving(false)
    }
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
        setMessage(t('useSettingsForm.theGbaLodgeCampsiteIsEmpty'))
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
        t('useSettingsForm.removeTheSavedBackupForCabinThisCannotBeUndone', {
          value1: getGameLabel(gameId),
        })
      )
    )
      return
    try {
      await provider.discardSave(gameId)
      await refreshBackups()
      setMessage(
        t('useSettingsForm.cabinBackupRemoved', {
          value1: getGameLabel(gameId),
        })
      )
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
        t('useSettingsForm.deleteEveryCampingPokeMonAtTheGbaLodgeCamp')
      )
    )
      return
    try {
      const emptied: Camp = {
        sites: camp.sites.map((site) => site.map(() => null)),
      }
      await saveCampsite(emptied)
      setCamps(new Map(camps).set(GBA_GENERATION, emptied))
      setMessage(t('useSettingsForm.gbaLodgeCampsiteDeleted'))
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
  const savedSpriteSourceId =
    savedSettings?.spriteSourceId ?? DEFAULT_SPRITE_SOURCE_ID
  const savedTheme = resolveTheme(savedSettings?.themeId)
  const appearanceChange = !settingsLoaded
    ? null
    : themeId !== savedTheme
      ? 'theme'
      : spriteSourceId !== savedSpriteSourceId
        ? 'sprites'
        : null
  const hasChanges =
    settingsLoaded &&
    (appearanceChange !== null ||
      GENERATIONS.some(
        (generation) =>
          siteCounts &&
          camps &&
          siteCounts[generation] !== camps.get(generation)?.sites.length
      ))
  const confirmLeave = useNavigationGuard(
    hasChanges || saving,
    saving
      ? t('useSettingsForm.settingsAreBeingSavedLeaveThisScreen')
      : t('useSettingsForm.youHaveUnsavedSettingsLeaveWithoutSavingThem')
  )

  /** Saves the staged theme or sprite source without changing Camp Sites. */
  const handleAppearanceSave = async () => {
    if (!appearanceChange || offline) return
    setSaving(true)
    setMessage(null)
    try {
      await provider.saveSettings({ spriteSourceId, themeId })
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
    themeId,
    setThemeId,
    appearanceChange,
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
    handleCampsiteUpload,
    handleSaveCampsiteCount,
    handleBackupRemove,
    handleCampsiteRemove,
    campsiteMinimum,
    handleAppearanceSave,
    handleDropbox,
  }
}

export type SettingsForm = ReturnType<typeof useSettingsForm>
