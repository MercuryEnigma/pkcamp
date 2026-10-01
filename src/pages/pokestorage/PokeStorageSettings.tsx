import { useEffect, useMemo, useState } from 'react'
import {
  localPokemonLibrary,
  type StoredPokemonFile,
} from '../../services/localPokemonLibrary'
import type { Generation } from '../../services/saveLibrary'
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

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

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

function storedBoxCounts(): BoxCounts {
  return Object.fromEntries(
    GENERATIONS.map((generation) => [
      generation,
      getStoredCampingBoxCount(generation),
    ])
  ) as BoxCounts
}

export function PokeStorageSettings({ onBack }: { onBack: () => void }) {
  const [spriteSourceId, setSpriteSourceId] = useState(
    () => getStoredSpriteSourceId() ?? DEFAULT_SPRITE_SOURCE_ID
  )
  const [boxCounts, setBoxCounts] = useState<BoxCounts>(storedBoxCounts)
  const [selectedGeneration, setSelectedGeneration] = useState<Generation>(3)
  const [collections, setCollections] = useState<Collections | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
      setMessage('Poké Storage settings saved.')
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
            <p className="camp-eyebrow">Camp Zone</p>
            <h1 className="camp-title">Poké Storage Settings</h1>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>

        <div className="camp-panel camp-settings-panel">
          <section className="camp-settings-section">
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

          <section className="camp-settings-section">
            <h2>Camping Pokémon Campsites</h2>
            <p>
              Each campsite adds 30 Camping Pokémon slots to that generation.
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
              <span>Number of campsites</span>
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
              <small>Need at least {selectedMinimum} campsites.</small>
            </label>
          </section>

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
