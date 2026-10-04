import { useCallback, useEffect, useMemo, useState } from 'react'
import { zipSync } from 'fflate'
import {
  ROSTER,
  type Gen3GameId,
  type Generation,
} from '../../services/saveLibrary'
import {
  initializeSpriteResolver,
  type SpriteRequest,
} from '../../services/sprites'
import {
  CAMP_SITE_SIZE,
  storage,
  type Camp,
  type StorageProvider,
} from '../../services/storage'
import { dropboxAccount } from '../../services/storage/dropbox'
import {
  DEFAULT_CAMP_SITE_COUNT,
  MAX_CAMP_SITE_COUNT,
  minimumCampSiteCount,
  resizeCampSites,
} from './campPositions'
import { resolveSpriteDisplay, spriteDisplayImageSrc } from './spriteDisplay'
import { DEFAULT_SPRITE_SOURCE_ID, SPRITE_SOURCES } from './spriteSources'
import { GAME_LABEL } from './gameDisplay'
import { GbaSavePanel } from './GbaSavePanel'
import { assertSaveMatchesCabin } from './saveVersion'
import {
  storageErrorMessage,
  useDropboxStatus,
  useStorageOffline,
  useStorageProvider,
} from './useStorage'
import { usePkHex } from '../context/PkHexContext'

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const GEN_3_GAMES = ROSTER[3] as readonly Gen3GameId[]

/**
 * Five requests picked to exercise the axes a sprite source can differ on:
 * base vs. shiny (Bulbasaur), a same-species gender request (Venusaur ♀/♂ —
 * some sources have distinct art per gender, some don't and honestly fall
 * back to one shared sprite for both), and an alternate form (Deoxys's
 * Attack forme. Unsupported combinations honestly fall back to base art.
 */
const SPRITE_SHOWCASE: ReadonlyArray<{
  key: string
  label: string
  request: SpriteRequest
}> = [
  {
    key: 'bulbasaur',
    label: 'Bulbasaur',
    request: { nationalDex: 1, displayName: 'Bulbasaur' },
  },
  {
    key: 'bulbasaur-shiny',
    label: 'Bulbasaur (Shiny)',
    request: { nationalDex: 1, displayName: 'Bulbasaur', shiny: true },
  },
  {
    key: 'venusaur-f',
    label: 'Venusaur ♀',
    request: { nationalDex: 3, displayName: 'Venusaur', gender: 'female' },
  },
  {
    key: 'venusaur-m',
    label: 'Venusaur ♂',
    request: { nationalDex: 3, displayName: 'Venusaur', gender: 'male' },
  },
  {
    key: 'deoxys-defense',
    label: 'Deoxys (Defense)',
    request: {
      nationalDex: 386,
      displayName: 'Deoxys',
      formId: 'deoxys-defense',
    },
  },
]

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

function formatBackupDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export type SettingsTab = 'backups' | 'appearance' | 'storage'
const SETTINGS_TABS: ReadonlyArray<{ id: SettingsTab; label: string }> = [
  { id: 'backups', label: 'Backup & Restore' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'storage', label: 'Data' },
]

/** The GBA Lodge is a single generation; its cabins are the Gen 3 games. */
const GBA_GENERATION = 3 as const
/** What the Backup & Restore picker is showing: one cabin or the campsites. */
type CabinSelection = Gen3GameId | 'campsites'

export function PokeStorageSettings({
  onBack,
  initialTab = 'backups',
}: {
  onBack: () => void
  /** Tab to open first. */
  initialTab?: SettingsTab
}) {
  const { adapter } = usePkHex()
  const { provider, ready } = useStorageProvider()
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
      setBackups(await loadBackupStatuses(storage))
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    }
  }, [])

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
      await storage.putSave(gameId, bytes)
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
      const save = await storage.getSave(gameId)
      if (save) setGbaAction({ gameId, mode: 'write', save: save.bytes })
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    }
  }

  const handleBackupExport = async (gameId: Gen3GameId) => {
    let bytes: Uint8Array | undefined
    try {
      bytes = (await storage.getSave(gameId))?.bytes
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
      const camp = await storage.getCamp(GBA_GENERATION)
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
      await storage.discardSave(gameId)
      await refreshBackups()
      setMessage(`${GAME_LABEL[gameId]} Cabin backup removed.`)
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
        await storage.saveCamp(generation, resized)
        nextCamps.set(generation, resized)
      }
      setCamps(nextCamps)
      if (settingsLoaded) await storage.saveSettings({ spriteSourceId })
      setMessage('Camp Office settings saved.')
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const handleDropbox = async (connect: boolean) => {
    setMessage(null)
    try {
      if (connect) await dropboxAccount.signIn()
      else await dropboxAccount.signOut()
    } catch (cause) {
      setMessage(storageErrorMessage(cause))
    }
  }

  const renderCabin = (gameId: Gen3GameId) => {
    const status = backups?.[gameId]
    const hasSave = status?.hasSave ?? false
    const fromGbaBtn = (
      <button
        type="button"
        className="camp-transfer-btn"
        disabled={gbaAction !== null || offline || backups === null}
        onClick={() => {
          if (confirmReplaceBackup(gameId))
            setGbaAction({ gameId, mode: 'read' })
        }}
      >
        From GBA
      </button>
    )
    const fromFileBtn = (
      <label className="camp-transfer-btn">
        From file
        <input
          className="camp-file-input--hidden"
          type="file"
          accept=".sav"
          disabled={!adapter || offline}
          onChange={(event) => void handleBackupUpload(gameId, event)}
        />
      </label>
    )
    return (
      <div className="camp-cabin-card">
        <div className="camp-cabin-head">
          <strong className="camp-cabin-name">
            {GAME_LABEL[gameId]} Cabin
          </strong>
          {hasSave && status?.updatedAt && (
            <span className="camp-cabin-date">
              Updated {formatBackupDate(status.updatedAt)}
            </span>
          )}
        </div>
        <p className="camp-cabin-status">
          {backups === null
            ? 'Checking…'
            : hasSave
              ? 'Backup on file'
              : 'No backup on file'}
        </p>

        {hasSave ? (
          <div className="camp-transfer-groups">
            <div className="camp-transfer-group">
              <span className="camp-transfer-group-label">
                Bring a save into camp
              </span>
              {fromGbaBtn}
              {fromFileBtn}
            </div>
            <div className="camp-transfer-group">
              <span className="camp-transfer-group-label">
                Take this save out
              </span>
              <button
                type="button"
                className="camp-transfer-btn"
                disabled={gbaAction !== null}
                onClick={() => void handleBackupWrite(gameId)}
              >
                To GBA
              </button>
              <button
                type="button"
                className="camp-transfer-btn"
                onClick={() => void handleBackupExport(gameId)}
              >
                Download file
              </button>
            </div>
          </div>
        ) : (
          <div className="camp-transfer-groups">
            <div className="camp-transfer-group">
              <span className="camp-transfer-group-label">Add a save</span>
              {fromGbaBtn}
              {fromFileBtn}
            </div>
          </div>
        )}

        {hasSave && (
          <div className="camp-cabin-footer">
            <button
              type="button"
              className="camp-text-btn camp-text-btn--danger"
              disabled={offline}
              onClick={() => void handleBackupRemove(gameId)}
            >
              Remove backup
            </button>
          </div>
        )}

        {gbaAction?.gameId === gameId &&
          (gbaAction.mode === 'read' ? (
            <GbaSavePanel
              mode="read"
              gameId={gameId}
              onSave={() => void handleBackupRead(gameId)}
              onClose={() => setGbaAction(null)}
            />
          ) : (
            <GbaSavePanel
              mode="write"
              gameId={gameId}
              save={gbaAction.save}
              onWritten={() => {
                setGbaAction(null)
                setMessage(`${GAME_LABEL[gameId]} Cabin was restored to the GBA.`)
              }}
              onClose={() => setGbaAction(null)}
            />
          ))}
      </div>
    )
  }

  const renderCampsites = () => {
    const siteCount = Math.max(
      siteCounts?.[GBA_GENERATION] ?? DEFAULT_CAMP_SITE_COUNT,
      campsiteMinimum
    )
    return (
      <div className="camp-cabin-card">
        <div className="camp-cabin-head">
          <strong className="camp-cabin-name">Campsites</strong>
        </div>
        <p className="camp-cabin-status">
          Each Camp Site adds {CAMP_SITE_SIZE} Camping Pokémon spaces to the GBA
          Lodge.
        </p>

        <label className="camp-settings-field">
          <span>Number of Camp Sites</span>
          <input
            className="camp-number-input"
            type="number"
            min={campsiteMinimum}
            max={MAX_CAMP_SITE_COUNT}
            step={1}
            value={siteCount}
            disabled={!siteCounts || saving}
            onChange={(event) => {
              const next =
                Number.parseInt(event.target.value, 10) || campsiteMinimum
              setSiteCounts((current) => ({
                ...current!,
                [GBA_GENERATION]: Math.min(
                  MAX_CAMP_SITE_COUNT,
                  Math.max(campsiteMinimum, next)
                ),
              }))
            }}
          />
          <small>
            Need at least {campsiteMinimum} Camp Site
            {campsiteMinimum === 1 ? '' : 's'}: Pokémon keep their positions, so
            the last Camp Site with a camper stays. Save settings to apply a new
            count.
          </small>
        </label>

        <div className="camp-transfer-groups">
          <div className="camp-transfer-group">
            <span className="camp-transfer-group-label">
              Take the campsite out
            </span>
            <button
              type="button"
              className="camp-transfer-btn"
              onClick={() => void handleDownloadCampsite()}
            >
              Download campsite (.zip)
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="camp-root">
      <div className="camp-content">
        <header className="camp-page-header">
          <button type="button" className="camp-back" onClick={onBack}>
            ← Back
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">Camp Zone · Camp Office</p>
            <h1 className="camp-title">Camp Zone Office</h1>
            <p className="camp-page-subtitle">
              Manage save backups, Camp Sites, and appearance.
            </p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>

        <div className="camp-panel camp-settings-panel">
          <div
            className="camp-settings-tabs"
            role="tablist"
            aria-label="Camp Office section"
          >
            {SETTINGS_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`camp-settings-tab${tab === item.id ? ' camp-settings-tab--active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'backups' && (
            <section className="camp-settings-section">
              <h2>Backup &amp; Restore</h2>
              <p>Manage the saves assigned to your GBA Lodge cabins.</p>
              <p className="camp-lodge-label">GBA Lodge</p>
              <label className="camp-settings-field">
                <span>Cabin</span>
                <select
                  className="camp-select"
                  value={selectedCabin}
                  onChange={(event) => {
                    setGbaAction(null)
                    setSelectedCabin(event.target.value as CabinSelection)
                  }}
                >
                  {GEN_3_GAMES.map((gameId) => (
                    <option key={gameId} value={gameId}>
                      {GAME_LABEL[gameId]} Cabin
                    </option>
                  ))}
                  <option value="campsites">Campsites</option>
                </select>
              </label>

              {selectedCabin === 'campsites'
                ? renderCampsites()
                : renderCabin(selectedCabin)}
            </section>
          )}

          {tab === 'appearance' && (
            <section className="camp-settings-section">
              <h2>Appearance</h2>
              <p>Choose how Pokémon appear throughout the Camp Zone.</p>
              <label className="camp-settings-field">
                <span>Sprite resource</span>
                <select
                  className="camp-select"
                  value={spriteSourceId}
                  onChange={(event) => setSpriteSourceId(event.target.value)}
                >
                  {SPRITE_SOURCES.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="camp-sprite-preview-row">
                {SPRITE_SHOWCASE.map(({ key, label, request }) => {
                  const display = resolveSpriteDisplay(spriteResolver, request)
                  return (
                    <div className="camp-sprite-preview-item" key={key}>
                      <img
                        className="camp-sprite-preview-img"
                        src={spriteDisplayImageSrc(display)}
                        alt={display.label}
                        title={display.label}
                      />
                      <span className="camp-sprite-preview-label">{label}</span>
                    </div>
                  )
                })}
              </div>
              <a
                className="camp-sprite-source-link"
                href={selectedSpriteSource.homepage}
                target="_blank"
                rel="noreferrer"
              >
                View {selectedSpriteSource.label.split(' — ')[0]} resource ↗
              </a>
            </section>
          )}


          {tab === 'storage' && (
            <section className="camp-settings-section">
              <h2>Data</h2>
              <p>Where your backups, Camping Pokémon, and settings are kept.</p>
              <p>
                <strong>Active storage:</strong> {storage.label}
              </p>
              {dropboxAccount.isConfigured() ? (
                <>
                  <p className="camp-status">
                    Dropbox:{' '}
                    {dropboxStatus.state === 'connected'
                      ? 'connected'
                      : dropboxStatus.state === 'connecting'
                        ? 'connecting…'
                        : dropboxStatus.state === 'error'
                          ? 'unreachable'
                          : 'not connected'}
                    {dropboxStatus.message ? ` · ${dropboxStatus.message}` : ''}
                  </p>
                  <div className="camp-local-actions">
                    {provider.id === 'dropbox' ? (
                      <button
                        type="button"
                        className="camp-upload-btn camp-danger-btn"
                        onClick={() => void handleDropbox(false)}
                      >
                        Disconnect Dropbox
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="camp-upload-btn camp-upload-btn--primary"
                        disabled={dropboxStatus.state === 'connecting'}
                        onClick={() => void handleDropbox(true)}
                      >
                        Connect Dropbox
                      </button>
                    )}
                  </div>
                  <small>
                    Connecting copies this browser's data to Dropbox. The copy
                    in this browser is kept, and disconnecting returns to it.
                  </small>
                </>
              ) : (
                <p className="camp-status">
                  Dropbox isn't configured for this build, so your data stays in
                  this browser.
                </p>
              )}
            </section>
          )}

          {offline && (
            <p className="camp-status">
              Dropbox is unreachable. Your data is read-only until it
              reconnects.
            </p>
          )}
          {message && <p className="camp-status">{message}</p>}
          <button
            type="button"
            className="camp-confirm-btn"
            disabled={!camps || !siteCounts || saving || offline}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
