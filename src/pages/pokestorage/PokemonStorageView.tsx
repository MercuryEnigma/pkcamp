import { useEffect, useMemo, useState } from 'react'
import type { StoredPokemonFile } from '../../services/localPokemonLibrary'
import type {
  BoxLocation,
  PokemonMove,
  PokemonNode,
  SaveGame,
  SaveSlot,
} from '../../services/pkhex'
import { initializeSpriteResolver } from '../../services/sprites'
import { PokemonDetails } from './PokemonDetails'
import { PokemonSlotIcon } from './PokemonSlotIcon'
import { getStoredSpriteSourceId } from './spritePreference'
import { DEFAULT_SPRITE_SOURCE_ID, SPRITE_SOURCES } from './spriteSources'

type StorageMode = 'view' | 'moveOne' | 'groupMove'
const MODE_ACTIVE_CLASS: Record<StorageMode, string> = {
  view: 'camp-mode-btn--active-view',
  moveOne: 'camp-mode-btn--active-move',
  groupMove: 'camp-mode-btn--active-group',
}
type StoragePage =
  | { kind: 'box'; boxIndex: number; label: string; slots: SaveSlot[] }
  | { kind: 'party'; label: 'Party'; slots: SaveSlot[] }
type StorageArea = { kind: 'box'; box: number } | { kind: 'local'; box: number }
type StorageLocation =
  { kind: 'box'; box: number; slot: number } | { kind: 'local'; slot: number }

export interface CampingPokemonSlot {
  file: StoredPokemonFile
  pokemon: PokemonNode
}

interface TransferSlot {
  pokemon: PokemonNode
  file: StoredPokemonFile | null
}

interface GroupSelection {
  area: StorageArea
  first: number
  second?: number
}

const SLOT_SIZE = 40
const SLOT_GAP_REM = 0.4
const COLUMNS = 6
const ROWS = 5

function areaKey(area: StorageArea): string {
  return `${area.kind}:${area.box}`
}

function locationKey(location: StorageLocation): string {
  return location.kind === 'local'
    ? `local:${location.slot}`
    : `box:${location.box}:${location.slot}`
}

function locationInArea(area: StorageArea, slot: number): StorageLocation {
  return area.kind === 'local'
    ? { kind: 'local', slot: area.box * COLUMNS * ROWS + slot }
    : { kind: 'box', box: area.box, slot }
}

function boxLocation(location: StorageLocation): BoxLocation {
  if (location.kind !== 'box') throw new Error('Expected a save-box location')
  return { box: location.box, slot: location.slot }
}

function newLocalId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function pokemonFileName(pokemon: PokemonNode): string {
  const base = (pokemon.nickname || `pokemon-${pokemon.species}`)
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `${base || `pokemon-${pokemon.species}`}.pk3`
}

export function PokemonStorageView({
  game,
  localSlots,
  localLoading,
  exportPokemonFile,
  onGameChange,
  onLocalChange,
  onSelectedChange,
}: {
  game: SaveGame
  localSlots: (CampingPokemonSlot | null)[]
  localLoading: boolean
  exportPokemonFile: (pokemon: PokemonNode) => Uint8Array
  onGameChange: () => void
  onLocalChange: (slots: (CampingPokemonSlot | null)[]) => void
  onSelectedChange?: (pokemon: PokemonNode | null) => void
}) {
  const [, setRevision] = useState(0)
  const pages: StoragePage[] = [
    ...game.boxes.map((box, boxIndex) => ({
      kind: 'box' as const,
      boxIndex,
      label: box.name,
      slots: box.slots,
    })),
    { kind: 'party' as const, label: 'Party' as const, slots: game.party },
  ]
  const [pageIndex, setPageIndex] = useState(0)
  const [rightPageIndex, setRightPageIndex] = useState(0)
  const [selected, setSelected] = useState<PokemonNode | null>(null)
  const [mode, setMode] = useState<StorageMode>('view')
  const [moveSource, setMoveSource] = useState<StorageLocation | null>(null)
  const [groupSelection, setGroupSelection] = useState<GroupSelection | null>(
    null
  )
  const [message, setMessage] = useState(
    'Choose a camper to view their details.'
  )

  useEffect(() => {
    onSelectedChange?.(selected)
  }, [selected, onSelectedChange])

  const resolver = useMemo(() => {
    const sourceId = getStoredSpriteSourceId() ?? DEFAULT_SPRITE_SOURCE_ID
    const source =
      SPRITE_SOURCES.find((item) => item.id === sourceId) ?? SPRITE_SOURCES[0]
    return initializeSpriteResolver({
      sourceId: source.id,
      manifest: source.manifest,
      formAliases: source.formAliases,
    })
  }, [])

  const gridWidth = `calc(${COLUMNS} * ${SLOT_SIZE}px + ${COLUMNS - 1} * ${SLOT_GAP_REM}rem)`
  const gridHeight = `calc(${ROWS} * ${SLOT_SIZE}px + ${ROWS - 1} * ${SLOT_GAP_REM}rem)`
  const page = pages[pageIndex]
  const localBoxCount = Math.max(1, localSlots.length / (COLUMNS * ROWS))
  const rightPageCount = game.boxes.length + localBoxCount
  const rightIsLocal = rightPageIndex >= game.boxes.length
  const rightLocalBoxIndex = rightPageIndex - game.boxes.length

  const cancelMove = (nextMessage?: string) => {
    setMoveSource(null)
    setGroupSelection(null)
    if (nextMessage) setMessage(nextMessage)
  }

  const chooseMode = (nextMode: StorageMode) => {
    if (page.kind === 'party' && nextMode !== 'view') return
    if (nextMode !== 'view' && page.kind === 'box')
      setRightPageIndex(page.boxIndex)
    setMode(nextMode)
    cancelMove(
      nextMode === 'view'
        ? 'Choose a camper to view their details.'
        : nextMode === 'moveOne'
          ? 'Select a Pokémon from either panel, then choose its destination.'
          : 'Select two corners of a group, then choose its top-left destination.'
    )
  }

  const cycleLeft = (delta: number) => {
    const nextIndex = (pageIndex + delta + pages.length) % pages.length
    if (pages[nextIndex].kind === 'party') {
      setMode('view')
      cancelMove('Party Pokémon are view-only.')
    }
    setPageIndex(nextIndex)
  }

  const cycleRight = (delta: number) => {
    setRightPageIndex(
      (index) => (index + delta + rightPageCount) % rightPageCount
    )
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        cancelMove(mode === 'view' ? undefined : 'Move cancelled.')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode])

  const transferAt = (location: StorageLocation): TransferSlot | null => {
    if (location.kind === 'box') {
      const pokemon = game.boxes[location.box].slots[location.slot]
      return pokemon === null ? null : { pokemon, file: null }
    }
    const entry = localSlots[location.slot]
    return entry === null ? null : { pokemon: entry.pokemon, file: entry.file }
  }

  const localEntry = (
    transfer: TransferSlot,
    slot: number
  ): CampingPokemonSlot => {
    const file: StoredPokemonFile = transfer.file
      ? { ...transfer.file, slot, bytes: transfer.file.bytes.slice() }
      : {
          id: newLocalId(),
          slot,
          fileName: pokemonFileName(transfer.pokemon),
          bytes: exportPokemonFile(transfer.pokemon),
          importedAt: new Date().toISOString(),
        }
    return { file, pokemon: transfer.pokemon }
  }

  const finishMove = (
    gameChanged: boolean,
    nextLocal: (CampingPokemonSlot | null)[] | null
  ) => {
    if (gameChanged) onGameChange()
    if (nextLocal) onLocalChange(nextLocal)
    setRevision((value) => value + 1)
  }

  const handleMoveOne = (location: StorageLocation) => {
    const clicked = transferAt(location)
    if (!moveSource) {
      if (clicked === null) {
        setMessage('Choose an occupied slot first.')
        return
      }
      setMoveSource(location)
      setSelected(clicked.pokemon)
      setMessage(
        'Choose any slot in either panel as the destination. Occupied slots will swap.'
      )
      return
    }
    if (locationKey(moveSource) === locationKey(location)) {
      setMoveSource(null)
      setMessage('Move cancelled.')
      return
    }

    try {
      const source = transferAt(moveSource)
      if (source === null) throw new Error('The selected source is now empty.')
      const destination = clicked
      let nextLocal: (CampingPokemonSlot | null)[] | null = null
      let gameChanged = false

      if (moveSource.kind === 'box' && location.kind === 'box') {
        game.movePokemon(boxLocation(moveSource), boxLocation(location))
        gameChanged = true
      } else if (moveSource.kind === 'local' && location.kind === 'local') {
        nextLocal = localSlots.slice()
        nextLocal[location.slot] = localEntry(source, location.slot)
        nextLocal[moveSource.slot] = destination
          ? localEntry(destination, moveSource.slot)
          : null
      } else if (moveSource.kind === 'box' && location.kind === 'local') {
        game.setBoxSlot(boxLocation(moveSource), destination?.pokemon ?? null)
        nextLocal = localSlots.slice()
        nextLocal[location.slot] = localEntry(source, location.slot)
        gameChanged = true
      } else if (moveSource.kind === 'local' && location.kind === 'box') {
        game.setBoxSlot(boxLocation(location), source.pokemon)
        nextLocal = localSlots.slice()
        nextLocal[moveSource.slot] = destination
          ? localEntry(destination, moveSource.slot)
          : null
        gameChanged = true
      }

      finishMove(gameChanged, nextLocal)
      setSelected(source.pokemon)
      setMoveSource(null)
      setMessage(
        'Pokémon moved. Save each changed storage area when you are finished.'
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not move that Pokémon.'
      )
    }
  }

  const groupIndices = useMemo(() => {
    if (!groupSelection || groupSelection.second === undefined) {
      return groupSelection
        ? new Set([groupSelection.first])
        : new Set<number>()
    }
    const firstRow = Math.floor(groupSelection.first / COLUMNS)
    const firstColumn = groupSelection.first % COLUMNS
    const secondRow = Math.floor(groupSelection.second / COLUMNS)
    const secondColumn = groupSelection.second % COLUMNS
    const top = Math.min(firstRow, secondRow)
    const bottom = Math.max(firstRow, secondRow)
    const left = Math.min(firstColumn, secondColumn)
    const right = Math.max(firstColumn, secondColumn)
    const indices = new Set<number>()
    for (let row = top; row <= bottom; row++) {
      for (let column = left; column <= right; column++)
        indices.add(row * COLUMNS + column)
    }
    return indices
  }, [groupSelection])

  const handleGroupMove = (area: StorageArea, slot: number) => {
    if (!groupSelection) {
      setGroupSelection({ area, first: slot })
      setMessage(
        'Select the opposite corner of the group (the same slot selects one Pokémon).'
      )
      return
    }
    if (groupSelection.second === undefined) {
      if (areaKey(area) !== areaKey(groupSelection.area)) {
        setMessage('Both source corners must be in the same storage panel.')
        return
      }
      setGroupSelection({ ...groupSelection, second: slot })
      setMessage('Select the group’s top-left destination in either panel.')
      return
    }

    const sourceIndices = [...groupIndices].sort((left, right) => left - right)
    const sourceTop = Math.min(
      ...sourceIndices.map((index) => Math.floor(index / COLUMNS))
    )
    const sourceLeft = Math.min(
      ...sourceIndices.map((index) => index % COLUMNS)
    )
    const destinationTop = Math.floor(slot / COLUMNS)
    const destinationLeft = slot % COLUMNS
    const pairs: {
      from: StorageLocation
      to: StorageLocation
      pokemon: TransferSlot | null
    }[] = []

    for (const sourceSlot of sourceIndices) {
      const rowOffset = Math.floor(sourceSlot / COLUMNS) - sourceTop
      const columnOffset = (sourceSlot % COLUMNS) - sourceLeft
      const destinationColumn = destinationLeft + columnOffset
      const destinationSlot =
        (destinationTop + rowOffset) * COLUMNS + destinationColumn
      if (destinationColumn >= COLUMNS || destinationSlot >= COLUMNS * ROWS) {
        setMessage(
          'That group would extend beyond the destination storage area.'
        )
        return
      }
      const from = locationInArea(groupSelection.area, sourceSlot)
      pairs.push({
        from,
        to: locationInArea(area, destinationSlot),
        pokemon: transferAt(from),
      })
    }

    if (!pairs.some(({ pokemon }) => pokemon !== null)) {
      setMessage('Cannot move a group containing only empty slots.')
      return
    }
    const sourceKeys = new Set(pairs.map(({ from }) => locationKey(from)))
    for (const { to } of pairs) {
      if (transferAt(to) !== null && !sourceKeys.has(locationKey(to))) {
        setMessage('The destination group must be empty.')
        return
      }
    }

    try {
      if (groupSelection.area.kind === 'box' && area.kind === 'box') {
        const moves: PokemonMove[] = pairs.map(({ from, to }) => ({
          from: boxLocation(from),
          to: boxLocation(to),
        }))
        game.movePokemonGroup(moves)
        finishMove(true, null)
      } else {
        const nextLocal = localSlots.slice()
        let gameChanged = false

        for (const { from } of pairs) {
          if (from.kind === 'box') {
            game.setBoxSlot(boxLocation(from), null)
            gameChanged = true
          } else {
            nextLocal[from.slot] = null
          }
        }
        for (const { to, pokemon } of pairs) {
          if (to.kind === 'box') {
            game.setBoxSlot(boxLocation(to), pokemon?.pokemon ?? null)
            gameChanged = true
          } else {
            nextLocal[to.slot] = pokemon ? localEntry(pokemon, to.slot) : null
          }
        }
        const localChanged = pairs.some(
          ({ from, to }) => from.kind === 'local' || to.kind === 'local'
        )
        finishMove(gameChanged, localChanged ? nextLocal : null)
      }
      setGroupSelection(null)
      setMessage(
        'Pokémon group moved. Save each changed storage area when you are finished.'
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not move that group.'
      )
    }
  }

  const handleStorageSlotClick = (area: StorageArea, slot: number) => {
    if (mode === 'view') {
      const pokemon = transferAt(locationInArea(area, slot))?.pokemon ?? null
      setSelected(pokemon)
      setMessage('Choose a camper to view their details.')
      return
    }
    if (mode === 'moveOne') {
      handleMoveOne(locationInArea(area, slot))
      return
    }
    handleGroupMove(area, slot)
  }

  const renderGrid = (slots: SaveSlot[], area: StorageArea | null) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLUMNS}, ${SLOT_SIZE}px)`,
        gridAutoRows: `${SLOT_SIZE}px`,
        gap: `${SLOT_GAP_REM}rem`,
        minHeight: gridHeight,
        alignContent: 'start',
      }}
    >
      {slots.map((slot, index) => {
        const location = area ? locationInArea(area, index) : null
        const moveSelected =
          location !== null &&
          moveSource !== null &&
          locationKey(location) === locationKey(moveSource)
        const groupSelected =
          area !== null &&
          groupSelection !== null &&
          areaKey(groupSelection.area) === areaKey(area) &&
          groupIndices.has(index)
        return (
          <PokemonSlotIcon
            key={index}
            slot={slot}
            resolver={resolver}
            selected={
              moveSelected
                ? 'moveOne'
                : groupSelected
                  ? 'groupMove'
                  : mode === 'view' && slot !== null && slot === selected
            }
            onClick={() => {
              if (area) handleStorageSlotClick(area, index)
              else {
                setSelected(slot)
                if (slot === null)
                  setMessage('Choose a camper to view their details.')
              }
            }}
          />
        )
      })}
    </div>
  )

  return (
    <div className="camp-storage-layout camp-storage-layout--save">
      <section className="camp-storage-left">
        <div className="camp-storage-nav">
          <button
            type="button"
            className="camp-nav-btn"
            onClick={() => cycleLeft(-1)}
            aria-label="Previous"
          >
            ←
          </button>
          <strong className="camp-box-label">
            <span className="camp-location-kicker">
              {page.kind === 'party'
                ? 'Current Party'
                : `Room ${page.boxIndex + 1} of ${game.boxes.length}`}
            </span>
            <span className="camp-location-name">
              {page.kind === 'party'
                ? `${page.slots.filter(Boolean).length}/${page.slots.length} Pokémon`
                : `${page.label} · ${page.slots.filter(Boolean).length}/${page.slots.length} campers`}
            </span>
          </strong>
          <button
            type="button"
            className="camp-nav-btn"
            onClick={() => cycleLeft(1)}
            aria-label="Next"
          >
            →
          </button>
        </div>
        <div
          className="camp-panel camp-storage-grid-panel"
          style={{ width: gridWidth }}
        >
          {renderGrid(
            page.slots,
            page.kind === 'box' ? { kind: 'box', box: page.boxIndex } : null
          )}
        </div>
        <div
          className="camp-storage-modes"
          role="group"
          aria-label="Storage mode"
        >
          {(
            [
              ['view', 'View'],
              ['moveOne', 'Move'],
              ['groupMove', 'Group'],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`camp-mode-btn${mode === value ? ` ${MODE_ACTIVE_CLASS[value]}` : ''}`}
              disabled={page.kind === 'party' && value !== 'view'}
              onClick={() => chooseMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="camp-move-status">{message}</p>
        {mode !== 'view' &&
          page.kind === 'box' &&
          (moveSource || groupSelection) && (
            <button
              type="button"
              className="camp-cancel-move"
              onClick={() => cancelMove('Move cancelled.')}
            >
              Cancel move
            </button>
          )}
      </section>

      <section
        className={`camp-storage-right${mode === 'view' ? ' camp-storage-right--details' : ''}`}
      >
        {mode !== 'view' ? (
          <>
            <div className="camp-storage-nav">
              <button
                type="button"
                className="camp-nav-btn"
                onClick={() => cycleRight(-1)}
                aria-label="Previous right storage"
              >
                ←
              </button>
              <strong className="camp-box-label">
                {rightIsLocal ? (
                  <>
                    <span className="camp-location-kicker">
                      Camp Site {rightLocalBoxIndex + 1} of {localBoxCount}
                    </span>
                    <span className="camp-location-name">
                      {
                        localSlots.slice(
                          rightLocalBoxIndex * COLUMNS * ROWS,
                          (rightLocalBoxIndex + 1) * COLUMNS * ROWS
                        ).filter(Boolean).length
                      }
                      /{COLUMNS * ROWS} campers
                    </span>
                  </>
                ) : (
                  <>
                    <span className="camp-location-kicker">
                      Room {rightPageIndex + 1} of {game.boxes.length}
                    </span>
                    <span className="camp-location-name">
                      {game.boxes[rightPageIndex].name} ·{' '}
                      {game.boxes[rightPageIndex].slots.filter(Boolean).length}/
                      {game.boxes[rightPageIndex].slots.length} campers
                    </span>
                  </>
                )}
              </strong>
              <button
                type="button"
                className="camp-nav-btn"
                onClick={() => cycleRight(1)}
                aria-label="Next right storage"
              >
                →
              </button>
            </div>
            <div
              className="camp-panel camp-storage-grid-panel"
              style={{ width: gridWidth }}
            >
              {rightIsLocal ? (
                localLoading ? (
                  <p className="camp-local-empty">Loading Camping Pokémon…</p>
                ) : (
                  renderGrid(
                    localSlots
                      .slice(
                        rightLocalBoxIndex * COLUMNS * ROWS,
                        (rightLocalBoxIndex + 1) * COLUMNS * ROWS
                      )
                      .map((entry) => entry?.pokemon ?? null),
                    { kind: 'local', box: rightLocalBoxIndex }
                  )
                )
              ) : (
                renderGrid(game.boxes[rightPageIndex].slots, {
                  kind: 'box',
                  box: rightPageIndex,
                })
              )}
            </div>
          </>
        ) : selected ? (
          <PokemonDetails pokemon={selected} resolver={resolver} />
        ) : (
          <div className="camp-panel camp-details-empty">
            Choose a camper to view their details.
          </div>
        )}
      </section>
    </div>
  )
}
