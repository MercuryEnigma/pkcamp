import { useEffect, useMemo, useState } from 'react'
import {
  localPokemonLibrary,
  type StoredPokemonFile,
} from '../../services/localPokemonLibrary'
import {
  ROSTER,
  saveLibrary,
  type Gen3GameId,
  type Generation,
} from '../../services/saveLibrary'
import {
  initializeSpriteResolver,
  type SpriteRequest,
} from '../../services/sprites'
import {
  getStoredCampingBoxCount,
  minimumCampingBoxCount,
  resizeCampingSlots,
  setStoredCampingBoxCount,
} from './campingStoragePreference'
import {
  getStoredSpriteSourceId,
  setStoredSpriteSourceId,
} from './spritePreference'
import { resolveSpriteDisplay, spriteDisplayImageSrc } from './spriteDisplay'
import { DEFAULT_SPRITE_SOURCE_ID, SPRITE_SOURCES } from './spriteSources'
import { GAME_LABEL } from './gameDisplay'
import { usePkHex } from '../context/PkHexProvider'

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

type Collections = Map<Generation, (StoredPokemonFile | null)[]>
type BoxCounts = Record<Generation, number>
type BackupStatus = { hasSave: boolean; updatedAt: Date | null }

function backupStatuses(): Record<Gen3GameId, BackupStatus> {
  return Object.fromEntries(
    GEN_3_GAMES.map((gameId) => [
      gameId,
      {
        hasSave: saveLibrary.getSave(gameId) !== null,
        updatedAt: saveLibrary.getSaveUpdatedAt(gameId),
      },
    ])
  ) as Record<Gen3GameId, BackupStatus>
}

function formatBackupDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function storedBoxCounts(): BoxCounts {
  return Object.fromEntries(
    GENERATIONS.map((generation) => [
      generation,
      getStoredCampingBoxCount(generation),
    ])
  ) as BoxCounts
}

type SettingsTab = 'backups' | 'sprites' | 'campsites'
const SETTINGS_TABS: ReadonlyArray<{ id: SettingsTab; label: string }> = [
  { id: 'backups', label: 'Save Backups' },
  { id: 'campsites', label: 'Camp Sites' },
  { id: 'sprites', label: 'Sprite Source' },
]

export function PokeStorageSettings({ onBack }: { onBack: () => void }) {
  const { adapter } = usePkHex()
  const [tab, setTab] = useState<SettingsTab>('backups')
  const [spriteSourceId, setSpriteSourceId] = useState(
    () => getStoredSpriteSourceId() ?? DEFAULT_SPRITE_SOURCE_ID
  )
  const [boxCounts, setBoxCounts] = useState<BoxCounts>(storedBoxCounts)
  const [selectedGeneration, setSelectedGeneration] = useState<Generation>(3)
  const [collections, setCollections] = useState<Collections | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [backups, setBackups] = useState<Record<
    Gen3GameId,
    BackupStatus
  > | null>(null)

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

  useEffect(() => {
    let cancelled = false
    void saveLibrary.whenReady().then(() => {
      if (!cancelled) setBackups(backupStatuses())
    })
    Promise.all(
      GENERATIONS.map(
        async (generation) =>
          [generation, await localPokemonLibrary.getSlots(generation)] as const
      )
    )
      .then((entries) => {
        if (!cancelled) setCollections(new Map(entries))
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setMessage(cause instanceof Error ? cause.message : String(cause))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleBackupUpload = async (
    gameId: Gen3GameId,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !adapter) return

    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const loaded = adapter.load(bytes)
      loaded.dispose()
      saveLibrary.updateSave(gameId, bytes)
      setBackups(backupStatuses())
      setMessage(`${GAME_LABEL[gameId]} Cabin backup saved.`)
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Unable to open that backup.'
      )
    }
  }

  const handleBackupExport = (gameId: Gen3GameId) => {
    const bytes = saveLibrary.getSave(gameId)
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

  const handleBackupRemove = (gameId: Gen3GameId) => {
    if (
      !window.confirm(
        `Remove the saved backup for ${GAME_LABEL[gameId]} Cabin? This cannot be undone.`
      )
    )
      return
    saveLibrary.discardSave(gameId)
    setBackups(backupStatuses())
    setMessage(`${GAME_LABEL[gameId]} Cabin backup removed.`)
  }

  const minimumBoxCounts = useMemo(() => {
    return Object.fromEntries(
      GENERATIONS.map((generation) => {
        const occupied =
          collections?.get(generation)?.filter((slot) => slot !== null)
            .length ?? 0
        return [generation, minimumCampingBoxCount(occupied)]
      })
    ) as BoxCounts
  }, [collections])
  const selectedMinimum = minimumBoxCounts[selectedGeneration]

  const handleSave = async () => {
    if (!collections) return
    setSaving(true)
    setMessage(null)
    try {
      await Promise.all(
        GENERATIONS.map((generation) => {
          const nextBoxCount = Math.max(
            minimumBoxCounts[generation],
            Math.floor(boxCounts[generation])
          )
          return localPokemonLibrary.saveSlots(
            generation,
            resizeCampingSlots(collections.get(generation) ?? [], nextBoxCount)
          )
        })
      )
      for (const generation of GENERATIONS) {
        setStoredCampingBoxCount(
          generation,
          Math.max(
            minimumBoxCounts[generation],
            Math.floor(boxCounts[generation])
          )
        )
      }
      setStoredSpriteSourceId(spriteSourceId)
      setMessage('Camp Office settings saved.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
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
            <h1 className="camp-title">Camp management</h1>
            <p className="camp-page-subtitle">
              Manage save backups, Camp Sites, and appearance.
            </p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>

        <div className="camp-panel camp-settings-panel">
          <div className="camp-settings-tabs" role="tablist" aria-label="Camp Office section">
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
            <h2>Save Backups</h2>
            <p>Manage the game saves assigned to GBA Lodge Cabins.</p>
            <div className="camp-backup-list">
              {GEN_3_GAMES.map((gameId) => {
                const status = backups?.[gameId]
                return (
                  <div className="camp-backup-row" key={gameId}>
                    <span className="camp-backup-meta">
                      <strong>{GAME_LABEL[gameId]} Cabin</strong>
                      <small>
                        {backups === null
                          ? 'Checking…'
                          : status?.hasSave
                            ? status.updatedAt
                              ? `Updated ${formatBackupDate(status.updatedAt)}`
                              : 'Backup saved'
                            : 'No backup on file'}
                      </small>
                    </span>
                    <span className="camp-backup-row-actions">
                      <label className="camp-upload-btn">
                        {status?.hasSave ? 'Replace' : 'Upload'}
                        <input
                          className="camp-file-input--hidden"
                          type="file"
                          accept=".sav"
                          disabled={!adapter}
                          onChange={(event) =>
                            void handleBackupUpload(gameId, event)
                          }
                        />
                      </label>
                      {status?.hasSave && (
                        <>
                          <button
                            type="button"
                            className="camp-upload-btn"
                            onClick={() => handleBackupExport(gameId)}
                          >
                            Export
                          </button>
                          <button
                            type="button"
                            className="camp-upload-btn camp-danger-btn"
                            onClick={() => handleBackupRemove(gameId)}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
          )}

          {tab === 'sprites' && (
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

          {tab === 'campsites' && (
          <section className="camp-settings-section">
            <h2>Camp Sites</h2>
            <p>
              Each Camp Site adds 30 Camping Pokémon spaces to that lodge.
            </p>
            <label className="camp-settings-field">
              <span>Generation</span>
              <select
                className="camp-select"
                value={selectedGeneration}
                onChange={(event) =>
                  setSelectedGeneration(
                    Number.parseInt(event.target.value, 10) as Generation
                  )
                }
              >
                {GENERATIONS.map((generation) => (
                  <option key={generation} value={generation}>
                    Generation {generation}
                  </option>
                ))}
              </select>
            </label>
            <label className="camp-settings-field">
              <span>Number of Camp Sites</span>
              <input
                className="camp-number-input"
                type="number"
                min={selectedMinimum}
                step={1}
                value={Math.max(boxCounts[selectedGeneration], selectedMinimum)}
                disabled={!collections || saving}
                onChange={(event) => {
                  const next =
                    Number.parseInt(event.target.value, 10) || selectedMinimum
                  setBoxCounts((current) => ({
                    ...current,
                    [selectedGeneration]: Math.max(selectedMinimum, next),
                  }))
                }}
              />
              <small>
                Need at least {selectedMinimum} Camp Site
                {selectedMinimum === 1 ? '' : 's'}.
              </small>
            </label>
          </section>
          )}

          {message && <p className="camp-status">{message}</p>}
          <button
            type="button"
            className="camp-confirm-btn"
            disabled={!collections || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
