import { useEffect, useMemo, useRef, useState } from 'react'
import { localPokemonLibrary } from '../../services/localPokemonLibrary'
import type { StoredPokemonFile } from '../../services/localPokemonLibrary'
import type { PokemonNode, SaveGame } from '../../services/pkhex'
import { saveLibrary, type Gen3GameId } from '../../services/saveLibrary'
import { initializeSpriteResolver } from '../../services/sprites'
import { usePkHex } from '../context/PkHexProvider'
import { CAMPING_POKEMON_BOX_SIZE } from './campingStoragePreference'
import { GAME_LABEL } from './gameDisplay'
import { PokemonSlotIcon } from './PokemonSlotIcon'
import { getStoredSpriteSourceId } from './spritePreference'
import { DEFAULT_SPRITE_SOURCE_ID, SPRITE_SOURCES } from './spriteSources'

const GENERATION = 3 as const

function useSpriteResolver() {
  return useMemo(() => {
    const sourceId = getStoredSpriteSourceId() ?? DEFAULT_SPRITE_SOURCE_ID
    const source =
      SPRITE_SOURCES.find((item) => item.id === sourceId) ?? SPRITE_SOURCES[0]
    return initializeSpriteResolver({
      sourceId: source.id,
      manifest: source.manifest,
      formAliases: source.formAliases,
    })
  }, [])
}

function BoxNav({
  kicker,
  name,
  label,
  onCycle,
}: {
  kicker: string
  name: string
  label: string
  onCycle: (delta: number) => void
}) {
  return (
    <div className="camp-storage-nav">
      <button
        type="button"
        className="camp-nav-btn"
        onClick={() => onCycle(-1)}
        aria-label={`Previous ${label}`}
      >
        ←
      </button>
      <strong className="camp-box-label">
        <span className="camp-location-kicker">{kicker}</span>
        <span className="camp-location-name">{name}</span>
      </strong>
      <button
        type="button"
        className="camp-nav-btn"
        onClick={() => onCycle(1)}
        aria-label={`Next ${label}`}
      >
        →
      </button>
    </div>
  )
}

/** Box grid of one stored save backup. Selects exactly one Pokémon. */
export function SaveSelectionPanel({
  gameId,
  initialBox = 0,
  onBoxChange,
  reload,
  onSelect,
}: {
  gameId: Gen3GameId
  /** Box to open first. */
  initialBox?: number
  onBoxChange?: (box: number) => void
  /** Changes after a completed trade: reload the save, keep the open box. */
  reload: number
  onSelect: (slot: { box: number; index: number; pk3: Uint8Array }) => void
}) {
  const { adapter, loading: adapterLoading, error: adapterError } = usePkHex()
  const resolver = useSpriteResolver()
  const [game, setGame] = useState<SaveGame | null>(null)
  const [boxIndex, setBoxIndex] = useState(initialBox)
  useEffect(() => {
    onBoxChange?.(boxIndex)
  }, [boxIndex, onBoxChange])
  // A selection only counts for the load it was made in.
  const [selection, setSelection] = useState<{
    box: number
    slot: number
    reload: number
  }>()
  const selected = selection?.reload === reload ? selection : undefined
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  // The loaded save stays rendered until its reload replaces it.
  const gameRef = useRef<SaveGame | null>(null)
  useEffect(() => () => gameRef.current?.dispose(), [])

  useEffect(() => {
    if (!adapter) return
    let active = true
    void saveLibrary.whenReady().then(() => {
      if (!active) return
      const bytes = saveLibrary.getSave(gameId)
      try {
        if (bytes) {
          const previous = gameRef.current
          gameRef.current = adapter.load(bytes)
          setGame(gameRef.current)
          previous?.dispose()
        }
      } catch (cause) {
        setMessage(
          cause instanceof Error ? cause.message : 'Unable to open this backup.'
        )
      } finally {
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [adapter, gameId, reload])

  if (adapterLoading || loading)
    return <p className="camp-trade-note">Loading backup…</p>
  if (adapterError) {
    return (
      <p className="camp-trade-note">
        PKHeX failed to load: {adapterError.message}
      </p>
    )
  }
  if (message) return <p className="camp-trade-note">{message}</p>
  if (!game || !adapter) {
    return (
      <p className="camp-trade-note">
        No {GAME_LABEL[gameId]} backup is stored. Add one in the Camp Office.
      </p>
    )
  }

  const box = game.boxes[boxIndex]
  return (
    <div className="camp-trade-picker">
      <BoxNav
        kicker={`Room ${boxIndex + 1} of ${game.boxes.length}`}
        name={box.name}
        label="Room"
        onCycle={(delta) =>
          setBoxIndex(
            (current) =>
              (current + delta + game.boxes.length) % game.boxes.length
          )
        }
      />
      <div className="camp-local-grid camp-trade-grid">
        {box.slots.map((pokemon, slot) => (
          <PokemonSlotIcon
            key={`${boxIndex}-${slot}`}
            slot={pokemon}
            resolver={resolver}
            selected={selected?.box === boxIndex && selected.slot === slot}
            onClick={() => {
              if (!pokemon) return
              setSelection({ box: boxIndex, slot, reload })
              onSelect({
                box: boxIndex,
                index: slot,
                pk3: adapter.exportPokemonFile(pokemon),
              })
            }}
          />
        ))}
      </div>
      <p className="camp-trade-note">
        {selected
          ? 'One Pokémon selected.'
          : 'Select one Pokémon from the boxes.'}
      </p>
    </div>
  )
}

interface CampEntry {
  file: StoredPokemonFile
  pokemon: PokemonNode
}

/** Camp Sites grid. Selects exactly one Pokémon. */
export function CampSelectionPanel({
  reload,
  onSelect,
}: {
  /** Changes after a completed trade: reload Camp Sites, keep the open site. */
  reload: number
  onSelect: (slot: { id: string; pk3: Uint8Array }) => void
}) {
  const { adapter, loading: adapterLoading, error: adapterError } = usePkHex()
  const resolver = useSpriteResolver()
  const [entries, setEntries] = useState<(CampEntry | null)[]>([])
  const [boxIndex, setBoxIndex] = useState(0)
  // A selection only counts for the load it was made in.
  const [selection, setSelection] = useState<{ id: string; reload: number }>()
  const selectedId = selection?.reload === reload ? selection.id : undefined
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!adapter) return
    let active = true
    void localPokemonLibrary
      .getSlots(GENERATION)
      .then((files) => {
        if (!active) return
        setEntries(
          files.map((file) => {
            if (!file) return null
            try {
              return { file, pokemon: adapter.importPokemonFile(file.bytes) }
            } catch {
              return null
            }
          })
        )
      })
      .catch((cause: unknown) => {
        if (active)
          setMessage(cause instanceof Error ? cause.message : String(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [adapter, reload])

  if (adapterLoading || loading)
    return <p className="camp-trade-note">Loading Camp Sites…</p>
  if (adapterError) {
    return (
      <p className="camp-trade-note">
        PKHeX failed to load: {adapterError.message}
      </p>
    )
  }
  if (message) return <p className="camp-trade-note">{message}</p>
  if (!adapter || entries.every((entry) => entry === null)) {
    return <p className="camp-trade-note">No Camping Pokémon are stored.</p>
  }

  const boxCount = Math.max(
    1,
    Math.ceil(entries.length / CAMPING_POKEMON_BOX_SIZE)
  )
  const visible = entries.slice(
    boxIndex * CAMPING_POKEMON_BOX_SIZE,
    (boxIndex + 1) * CAMPING_POKEMON_BOX_SIZE
  )
  while (visible.length < CAMPING_POKEMON_BOX_SIZE) visible.push(null)

  return (
    <div className="camp-trade-picker">
      <BoxNav
        kicker={`Camp Site ${boxIndex + 1} of ${boxCount}`}
        name="Choose one camper"
        label="Camp Site"
        onCycle={(delta) =>
          setBoxIndex((current) => (current + delta + boxCount) % boxCount)
        }
      />
      <div className="camp-local-grid camp-trade-grid">
        {visible.map((entry, visibleSlot) => (
          <PokemonSlotIcon
            key={
              entry?.file.id ??
              `empty-${boxIndex * CAMPING_POKEMON_BOX_SIZE + visibleSlot}`
            }
            slot={entry?.pokemon ?? null}
            resolver={resolver}
            selected={entry !== null && entry.file.id === selectedId}
            onClick={() => {
              if (!entry) return
              setSelection({ id: entry.file.id, reload })
              onSelect({ id: entry.file.id, pk3: entry.file.bytes.slice() })
            }}
          />
        ))}
      </div>
      <p className="camp-trade-note">
        {selectedId
          ? 'One Pokémon selected.'
          : 'Select one Pokémon from a Camp Site.'}
      </p>
    </div>
  )
}
