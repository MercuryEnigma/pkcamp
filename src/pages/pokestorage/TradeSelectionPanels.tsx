import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import type { SaveGame } from '../../services/pkhex'
import type { Gen3GameId } from '../../services/saveLibrary'
import { CAMP_SITE_SIZE, storage } from '../../services/storage'
import { usePkHex } from '../context/PkHexContext'
import {
  isSamePosition,
  loadCampEntries,
  positionOf,
  type CampEntry,
  type CampPosition,
} from './campPositions'
import { getGameLabel } from './gameDisplay'
import { GbaSavePanel } from './GbaSavePanel'
import { PokemonSlotIcon } from './PokemonSlotIcon'
import { assertSaveMatchesCabin } from './saveVersion'
import {
  storageErrorMessage,
  useSpriteResolver,
  useStorageOffline,
  useStorageProvider,
} from './useStorage'

const GENERATION = 3 as const

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
  const { t } = useTranslation(['trade', 'common'] as const)

  return (
    <div className="camp-storage-nav">
      <button
        type="button"
        className="camp-nav-btn"
        onClick={() => onCycle(-1)}
        aria-label={t('common:storage.previous', { label: label })}
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
        aria-label={t('common:storage.next', { label: label })}
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
  const { t } = useTranslation(['trade', 'common'] as const)

  const { adapter, loading: adapterLoading, error: adapterError } = usePkHex()
  const resolver = useSpriteResolver()
  const { provider, ready } = useStorageProvider()
  const offline = useStorageOffline()
  const [game, setGame] = useState<SaveGame | null>(null)
  const [boxIndex, setBoxIndex] = useState(initialBox)
  // Bumped after the player adds a backup here, to reload the save in place.
  const [refresh, setRefresh] = useState(0)
  const [gbaReading, setGbaReading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
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
    if (!adapter || !ready) return
    let active = true
    provider
      .getSave(gameId)
      .then((stored) => {
        if (!active) return
        const previous = gameRef.current
        const loaded = stored ? adapter.load(stored.bytes) : null
        try {
          if (loaded) assertSaveMatchesCabin(gameId, loaded)
        } catch (cause) {
          loaded?.dispose()
          throw cause
        }
        gameRef.current = loaded
        setGame(gameRef.current)
        previous?.dispose()
        setMessage(null)
      })
      .catch((cause: unknown) => {
        if (active) setMessage(storageErrorMessage(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [adapter, gameId, provider, ready, reload, refresh])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !adapter) return
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const loaded = adapter.load(bytes)
      try {
        assertSaveMatchesCabin(gameId, loaded)
      } finally {
        loaded.dispose()
      }
      await storage.putSave(gameId, bytes)
      setActionError(null)
      setRefresh((n) => n + 1)
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? storageErrorMessage(cause)
          : t('common:storage.unableToOpenThatBackup')
      )
    }
  }

  if (adapterLoading || loading)
    return (
      <p className="camp-trade-note">
        {t('TradeSelectionPanels.loadingBackup')}
      </p>
    )
  if (adapterError) {
    return (
      <p className="camp-trade-note">
        {t('TradeSelectionPanels.pkhexFailedToLoad', {
          message: adapterError.message,
        })}
      </p>
    )
  }
  if (message) return <p className="camp-trade-note">{message}</p>
  if (!game || !adapter) {
    return (
      <div className="camp-trade-empty">
        <p className="camp-trade-note">
          {t('TradeSelectionPanels.noBackupIsStoredYet', {
            value1: getGameLabel(gameId),
          })}
        </p>
        <div className="camp-transfer-group">
          <span className="camp-transfer-group-label">
            {t('common:storage.addASave')}
          </span>
          <button
            type="button"
            className="camp-transfer-btn"
            disabled={gbaReading || offline}
            onClick={() => setGbaReading(true)}
          >
            {t('common:storage.fromGba')}
          </button>
          <label className="camp-transfer-btn">
            {t('common:storage.fromFile')}
            <input
              className="camp-file-input--hidden"
              type="file"
              accept=".sav"
              disabled={!adapter || offline}
              onChange={(event) => void handleUpload(event)}
            />
          </label>
        </div>
        {gbaReading && (
          <GbaSavePanel
            mode="read"
            gameId={gameId}
            onSave={() => {
              setGbaReading(false)
              setActionError(null)
              setRefresh((n) => n + 1)
            }}
            onClose={() => setGbaReading(false)}
          />
        )}
        {actionError && <p className="camp-trade-note">{actionError}</p>}
      </div>
    )
  }

  const box = game.boxes[boxIndex]
  return (
    <div className="camp-trade-picker">
      <BoxNav
        kicker={t('TradeSelectionPanels.roomPosition', {
          current: boxIndex + 1,
          total: game.boxes.length,
        })}
        name={box.name}
        label={t('TradeSelectionPanels.room')}
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
          ? t('TradeSelectionPanels.onePokeMonSelected')
          : t('TradeSelectionPanels.selectOnePokeMonFromTheBoxes')}
      </p>
    </div>
  )
}

/** Camp Sites grid. Selects exactly one Pokémon by position. */
export function CampSelectionPanel({
  reload,
  onSelect,
}: {
  /** Changes after a completed trade: reload Camp Sites, keep the open site. */
  reload: number
  onSelect: (slot: { site: number; index: number; pk3: Uint8Array }) => void
}) {
  const { t } = useTranslation(['trade', 'common'] as const)

  const { adapter, loading: adapterLoading, error: adapterError } = usePkHex()
  const resolver = useSpriteResolver()
  const { provider, ready } = useStorageProvider()
  const [entries, setEntries] = useState<(CampEntry | null)[]>([])
  const [siteIndex, setSiteIndex] = useState(0)
  // A selection only counts for the load it was made in.
  const [selection, setSelection] = useState<{
    position: CampPosition
    reload: number
  }>()
  const selected = selection?.reload === reload ? selection.position : null
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!adapter || !ready) return
    let active = true
    provider
      .getCamp(GENERATION)
      .then((camp) => {
        if (!active) return
        setEntries(loadCampEntries(camp, adapter).entries)
        setMessage(null)
      })
      .catch((cause: unknown) => {
        if (active) setMessage(storageErrorMessage(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [adapter, provider, ready, reload])

  if (adapterLoading || loading)
    return (
      <p className="camp-trade-note">
        {t('TradeSelectionPanels.loadingCampSites')}
      </p>
    )
  if (adapterError) {
    return (
      <p className="camp-trade-note">
        {t('TradeSelectionPanels.pkhexFailedToLoad', {
          message: adapterError.message,
        })}
      </p>
    )
  }
  if (message) return <p className="camp-trade-note">{message}</p>
  if (!adapter || entries.every((entry) => entry === null)) {
    return (
      <p className="camp-trade-note">
        {t('TradeSelectionPanels.noCampingPokeMonAreStored')}
      </p>
    )
  }

  const siteCount = Math.max(1, Math.ceil(entries.length / CAMP_SITE_SIZE))
  const visible = entries.slice(
    siteIndex * CAMP_SITE_SIZE,
    (siteIndex + 1) * CAMP_SITE_SIZE
  )

  return (
    <div className="camp-trade-picker">
      <BoxNav
        kicker={t('TradeSelectionPanels.campSitePosition', {
          current: siteIndex + 1,
          total: siteCount,
        })}
        name={t('TradeSelectionPanels.chooseOneCamper')}
        label={t('TradeSelectionPanels.campSite')}
        onCycle={(delta) =>
          setSiteIndex((current) => (current + delta + siteCount) % siteCount)
        }
      />
      <div className="camp-local-grid camp-trade-grid">
        {visible.map((entry, index) => {
          const position = positionOf(siteIndex * CAMP_SITE_SIZE + index)
          return (
            <PokemonSlotIcon
              key={`${position.site}-${position.index}`}
              slot={entry?.pokemon ?? null}
              resolver={resolver}
              selected={entry !== null && isSamePosition(position, selected)}
              onClick={() => {
                if (!entry) return
                setSelection({ position, reload })
                onSelect({ ...position, pk3: entry.file.bytes.slice() })
              }}
            />
          )
        })}
      </div>
      <p className="camp-trade-note">
        {selected
          ? t('TradeSelectionPanels.onePokeMonSelected')
          : t('TradeSelectionPanels.selectOnePokeMonFromACampSite')}
      </p>
    </div>
  )
}
