import { useEffect, useMemo, useState } from 'react'
import type { PokemonNode, SaveSlot } from '../../../services/pkhex'
import { activeGame } from '../../../services/activeGame'
import type { CampPokemon } from '../../../services/storage'
import { useAppNavigation } from '../../context/appNavigation'
import { usePkHex } from '../../context/PkHexContext'
import { useActiveGame } from '../../context/useActiveGame'
import { Panel } from '../../hub/Panel'
import { SitePage } from '../../hub/SitePage'
import { resolveRoute, routeHref } from '../../routing'
import { GAME_LABEL } from '../gameDisplay'
import { useNavigationGuard } from '../navigationGuard'
import { PokemonDetails, PokemonDetailsHeader } from '../PokemonDetails'
import type { CampDestination } from '../PokeStorageMain'
import { useStorageOffline, useSpriteResolver } from '../useStorage'
import {
  DETAILS_VIEWS,
  DETAILS_VIEW_LABEL,
  type DetailsView,
} from '../pokemonDetailsPages'
import { GRID_SIZE, groupCells, planGroupMove } from './groupMove'
import { StorageGrid } from './StorageGrid'
import { ToolSelector, type StorageTool } from './ToolSelector'
import { TradePanel } from './TradePanel'
import './campPage.css'

/** A slot in the save (a box, or the party after the boxes) or in a Camp Site. */
type Place =
  | { kind: 'save'; page: number; slot: number }
  | { kind: 'camp'; site: number; slot: number }
type Side = 'left' | 'right'

const nodeCache = new WeakMap<CampPokemon, PokemonNode | null>()

const MESSAGE: Record<StorageTool, string> = {
  view: 'Choose a camper to view their details.',
  moveOne: 'Select a Pokémon, then choose its destination.',
  groupMove: 'Select two corners of a group, then its top-left destination.',
}

function samePlace(a: Place, b: Place): boolean {
  return a.kind === 'save'
    ? b.kind === 'save' && a.page === b.page && a.slot === b.slot
    : b.kind === 'camp' && a.site === b.site && a.slot === b.slot
}

/**
 * Camp: the selected save (or a Camp Site when no game is selected) on the
 * left, and on the right, by `mode`, a second grid of the save, a Camp Site
 * grid, or the trade panel. All changes are drafts in `activeGame` until Save.
 */
export function CampPage({
  onBack,
  destination,
}: {
  /** Leaves Camp: to the Hub, or back to the PC entry that opened it. */
  onBack: () => void
  /** The box or Camp Site a PC entry opened Camp on. */
  destination?: CampDestination
}) {
  const state = useActiveGame()
  const { adapter } = usePkHex()
  const resolver = useSpriteResolver()
  const offline = useStorageOffline()
  const { location, navigate } = useAppNavigation()
  const resolved = resolveRoute(location)
  const mode =
    resolved.kind === 'route' && resolved.route.page === 'camp'
      ? resolved.route.mode
      : 'move'
  const { gameId, save, camp } = state
  const boxCount = save?.boxes.length ?? 0

  const [tool, setTool] = useState<StorageTool>('view')
  const [detailsView, setDetailsView] = useState<DetailsView>('overview')
  const [leftPage, setLeftPage] = useState(
    destination?.name === 'cabin' && destination.box !== undefined
      ? destination.box
      : 0
  )
  const [rightSavePage, setRightSavePage] = useState(0)
  const [leftSite, setLeftSite] = useState(0)
  const [rightSite, setRightSite] = useState(
    destination?.name === 'campSites' ? (destination.site ?? 0) : 0
  )
  const [selected, setSelected] = useState<PokemonNode | null>(null)
  const [source, setSource] = useState<{ side: Side; place: Place } | null>(
    null
  )
  const [corners, setCorners] = useState<{
    side: Side
    first: number
    second?: number
  } | null>(null)
  const [message, setMessage] = useState(MESSAGE.view)
  const [saving, setSaving] = useState(false)

  useNavigationGuard(
    state.dirty,
    'You have unsaved changes. Leave without saving them?'
  )

  // Leaving Camp drops any changes the player chose not to save.
  useEffect(
    () => () => {
      if (activeGame.getSnapshot().dirty) activeGame.discardDraft()
    },
    []
  )

  // A game without a save goes back to Start, where one can be added.
  useEffect(() => {
    if (state.status === 'ready' && gameId && !save)
      navigate(routeHref('start', { gameId }), { replace: true, guard: false })
  }, [gameId, navigate, save, state.status])

  const siteNodes = useMemo(() => {
    void state.revision
    return (camp?.sites ?? []).map((site) =>
      site.map((file) => {
        if (!file || !adapter) return null
        if (!nodeCache.has(file)) {
          try {
            nodeCache.set(file, adapter.importPokemonFile(file.bytes))
          } catch {
            nodeCache.set(file, null)
          }
        }
        return nodeCache.get(file) ?? null
      })
    )
  }, [adapter, camp, state.revision])
  const siteCount = siteNodes.length

  const hasGame = gameId !== null && save !== null
  const leftKind = hasGame ? 'save' : 'camp'
  const rightKind = hasGame && mode === 'move' ? 'save' : 'camp'
  const pageCount = boxCount + 1
  const leftIndex = leftKind === 'save' ? leftPage : leftSite
  const rightIndex = rightKind === 'save' ? rightSavePage : rightSite

  const placeOf = (side: Side, slot: number): Place => {
    const kind = side === 'left' ? leftKind : rightKind
    const index = side === 'left' ? leftIndex : rightIndex
    return kind === 'save'
      ? { kind, page: index, slot }
      : { kind, site: index, slot }
  }
  const slotsOf = (side: Side): SaveSlot[] => {
    const kind = side === 'left' ? leftKind : rightKind
    const index = side === 'left' ? leftIndex : rightIndex
    if (kind === 'camp') return siteNodes[index] ?? []
    if (!save) return []
    return index < boxCount ? save.boxes[index].slots : save.party
  }
  const nodeAt = (place: Place): PokemonNode | null => {
    if (place.kind === 'camp')
      return siteNodes[place.site]?.[place.slot] ?? null
    if (!save) return null
    return place.page < boxCount
      ? save.boxes[place.page].slots[place.slot]
      : (save.party[place.slot] ?? null)
  }
  const isParty = (place: Place) =>
    place.kind === 'save' && place.page >= boxCount
  const titleOf = (side: Side): string => {
    const kind = side === 'left' ? leftKind : rightKind
    const index = side === 'left' ? leftIndex : rightIndex
    if (kind === 'camp') return `Campsite ${index + 1}`
    return index < boxCount ? save!.boxes[index].name : 'Party'
  }
  const step = (side: Side, delta: number) => {
    const kind = side === 'left' ? leftKind : rightKind
    const count = kind === 'save' ? pageCount : siteCount
    const index = side === 'left' ? leftIndex : rightIndex
    const next = (index + delta + count) % count
    if (kind === 'save')
      (side === 'left' ? setLeftPage : setRightSavePage)(next)
    else (side === 'left' ? setLeftSite : setRightSite)(next)
    cancel()
  }

  const cancel = (next?: string) => {
    setSource(null)
    setCorners(null)
    if (next) setMessage(next)
  }
  const chooseTool = (next: StorageTool) => {
    setTool(next)
    cancel(MESSAGE[next])
  }
  const stepDetailsView = (delta: number) => {
    const index = DETAILS_VIEWS.indexOf(detailsView)
    setDetailsView(
      DETAILS_VIEWS[
        (index + delta + DETAILS_VIEWS.length) % DETAILS_VIEWS.length
      ]
    )
  }

  const fail = (cause: unknown) =>
    setMessage(cause instanceof Error ? cause.message : 'That move failed.')

  const move = (from: Place, to: Place) => {
    if (from.kind === 'save' && to.kind === 'save')
      activeGame.movePokemon(
        { box: from.page, slot: from.slot },
        { box: to.page, slot: to.slot }
      )
    else if (from.kind === 'camp' && to.kind === 'camp')
      activeGame.moveCampPokemon(
        { site: from.site, index: from.slot },
        { site: to.site, index: to.slot }
      )
    else if (from.kind === 'save' && to.kind === 'camp')
      activeGame.moveSavePokemonToCamp(
        { box: from.page, slot: from.slot },
        { site: to.site, index: to.slot }
      )
    else if (from.kind === 'camp' && to.kind === 'save')
      activeGame.moveCampPokemonToSave(
        { site: from.site, index: from.slot },
        { box: to.page, slot: to.slot }
      )
  }

  const clickMoveOne = (side: Side, slot: number) => {
    const place = placeOf(side, slot)
    if (isParty(place)) return setMessage('Party Pokémon are view-only.')
    if (!source) {
      if (!nodeAt(place)) return setMessage('Choose an occupied slot first.')
      setSource({ side, place })
      return setMessage('Choose the destination. Occupied slots swap.')
    }
    if (samePlace(source.place, place)) return cancel('Move cancelled.')
    try {
      move(source.place, place)
      cancel('Moved. Save when you are finished.')
    } catch (cause) {
      fail(cause)
    }
  }

  const clickGroup = (side: Side, slot: number) => {
    const place = placeOf(side, slot)
    if (isParty(place)) return setMessage('Party Pokémon are view-only.')
    if (!corners) {
      setCorners({ side, first: slot })
      return setMessage('Select the opposite corner of the group.')
    }
    if (corners.second === undefined) {
      if (corners.side !== side)
        return setMessage('Both corners must be in the same panel.')
      setCorners({ ...corners, second: slot })
      return setMessage('Select the group’s top-left destination.')
    }
    const cells = groupCells(corners.first, corners.second)
    const plan = planGroupMove(cells, slot)
    if ('error' in plan) return setMessage(plan.error)
    const from = (cell: number) => placeOf(corners.side, cell)
    const to = (cell: number) => placeOf(side, cell)
    const sourceCells = new Set(
      corners.side === side ? plan.pairs.map((pair) => pair.from) : []
    )
    if (!plan.pairs.some((pair) => nodeAt(from(pair.from))))
      return setMessage('Cannot move a group of empty slots.')
    for (const pair of plan.pairs) {
      if (nodeAt(to(pair.to)) && !sourceCells.has(pair.to))
        return setMessage('The destination group must be empty.')
    }
    try {
      const a = from(0)
      const b = to(0)
      if (a.kind === 'save' && b.kind === 'save') {
        activeGame.movePokemonGroup(
          plan.pairs.map((pair) => ({
            from: {
              box: (from(pair.from) as { page: number }).page,
              slot: pair.from,
            },
            to: { box: (to(pair.to) as { page: number }).page, slot: pair.to },
          }))
        )
      } else if (a.kind === 'camp' && b.kind === 'camp') {
        activeGame.editCamp((draft) => {
          const files = plan.pairs.map((pair) => {
            const place = from(pair.from) as { site: number }
            return draft.sites[place.site][pair.from]
          })
          for (const pair of plan.pairs) {
            const place = from(pair.from) as { site: number }
            draft.sites[place.site][pair.from] = null
          }
          plan.pairs.forEach((pair, index) => {
            const place = to(pair.to) as { site: number }
            draft.sites[place.site][pair.to] = files[index]
          })
        })
      } else {
        for (const pair of plan.pairs) {
          if (nodeAt(from(pair.from))) move(from(pair.from), to(pair.to))
        }
      }
      cancel('Group moved. Save when you are finished.')
    } catch (cause) {
      fail(cause)
    }
  }

  const clickSlot = (side: Side, slot: number) => {
    if (tool === 'view') {
      const node = nodeAt(placeOf(side, slot))
      setSelected(node)
      return setMessage(MESSAGE.view)
    }
    if (tool === 'moveOne') return clickMoveOne(side, slot)
    return clickGroup(side, slot)
  }

  const selectionOf = (side: Side) => (slot: number) => {
    if (
      source &&
      source.side === side &&
      samePlace(source.place, placeOf(side, slot))
    )
      return 'moveOne' as const
    if (corners && corners.side === side) {
      const cells =
        corners.second === undefined
          ? [corners.first]
          : groupCells(corners.first, corners.second)
      if (cells.includes(slot)) return 'groupMove' as const
    }
    if (tool === 'view') {
      const node = nodeAt(placeOf(side, slot))
      return node !== null && node === selected
    }
    return false
  }

  const saveChanges = async () => {
    setSaving(true)
    try {
      const result = await activeGame.commitDraft()
      const failed = [result.save, result.camp].find(
        (part) => part.status === 'failed'
      )
      setMessage(
        failed
          ? `Some changes were not saved: ${failed.error?.message ?? 'unknown error'}`
          : 'Saved.'
      )
    } finally {
      setSaving(false)
    }
  }

  const goMode = (next: 'move' | 'campsite' | 'trade') => {
    cancel()
    navigate(routeHref('camp', { gameId, mode: next }), { guard: false })
  }

  // Trades change stored saves, so the working copy is reloaded afterwards.
  const reloadGame = () => {
    const { provider } = state
    activeGame.clear()
    if (provider && adapter) void activeGame.select(gameId, provider, adapter)
  }

  const partyOpen = leftKind === 'save' && leftIndex >= boxCount
  const trading = mode === 'trade'

  if (state.status === 'loading' || state.status === 'idle')
    return (
      <SitePage page="Camp" gameId={gameId} onBack={onBack}>
        <p role="status">Loading…</p>
      </SitePage>
    )
  if (state.status === 'error')
    return (
      <SitePage page="Camp" gameId={gameId} onBack={onBack}>
        <p role="alert">
          {state.error?.message ?? 'The save could not be loaded.'}
        </p>
      </SitePage>
    )

  return (
    <SitePage
      page="Camp"
      gameId={gameId}
      onBack={onBack}
      bodyClassName="camp-site-body"
    >
      <div className="camp-page">
        {trading ? (
          <TradePanel gameId={gameId} onTraded={reloadGame} />
        ) : (
          <div className="camp-stage">
            <div className="camp-side camp-left">
              <StorageGrid
                label={hasGame ? 'Save' : 'Camp Site'}
                title={titleOf('left')}
                source={leftKind}
                gameId={gameId}
                slots={slotsOf('left')}
                resolver={resolver}
                selection={selectionOf('left')}
                onPrevious={() => step('left', -1)}
                onNext={() => step('left', 1)}
                onSlot={(slot) => clickSlot('left', slot)}
              />
              <div className="camp-side-footer camp-left-footer">
                <button
                  type="button"
                  className="camp-upload-btn"
                  disabled={!hasGame || state.dirty}
                  title={
                    state.dirty
                      ? 'Save your changes before trading.'
                      : undefined
                  }
                  onClick={() => goMode('trade')}
                >
                  Trade
                </button>
                {state.dirty && (
                  <button
                    type="button"
                    className="camp-upload-btn camp-upload-btn--primary"
                    disabled={saving || offline}
                    onClick={() => void saveChanges()}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                )}
              </div>
            </div>
            <ToolSelector
              value={tool}
              onChange={chooseTool}
              disabled={partyOpen ? ['moveOne', 'groupMove'] : undefined}
            />
            <div
              className={`camp-side camp-right${tool === 'view' ? ' camp-right--view' : ''}`}
            >
              {tool === 'view' ? (
                <Panel label="Pokémon" className="camp-details">
                  <PokemonDetailsHeader pokemon={selected} />
                  {selected ? (
                    <PokemonDetails
                      pokemon={selected}
                      resolver={resolver}
                      view={detailsView}
                    />
                  ) : (
                    <div className="camp-details-empty">
                      <p>Select a Pokémon to view its details.</p>
                    </div>
                  )}
                </Panel>
              ) : (
                <StorageGrid
                  label={rightKind === 'save' ? 'Save' : 'Camp Site'}
                  title={titleOf('right')}
                  source={rightKind}
                  gameId={gameId}
                  slots={slotsOf('right')}
                  resolver={resolver}
                  selection={selectionOf('right')}
                  onPrevious={() => step('right', -1)}
                  onNext={() => step('right', 1)}
                  onSlot={(slot) => clickSlot('right', slot)}
                />
              )}
              {tool === 'view' ? (
                <div
                  className="camp-mode-nav camp-view-nav"
                  role="group"
                  aria-label="Pokémon page"
                >
                  <button
                    type="button"
                    aria-label="Previous Pokémon page"
                    onClick={() => stepDetailsView(-1)}
                  >
                    <span aria-hidden="true">◀</span>
                  </button>
                  <p className="camp-mode-pill">
                    {DETAILS_VIEW_LABEL[detailsView]}
                  </p>
                  <button
                    type="button"
                    aria-label="Next Pokémon page"
                    onClick={() => stepDetailsView(1)}
                  >
                    <span aria-hidden="true">▶</span>
                  </button>
                </div>
              ) : hasGame ? (
                <div
                  className="camp-mode-nav"
                  role="group"
                  aria-label="Right side"
                >
                  <button
                    type="button"
                    aria-label="Previous right side"
                    onClick={() =>
                      goMode(mode === 'campsite' ? 'move' : 'campsite')
                    }
                  >
                    <span aria-hidden="true">◀</span>
                  </button>
                  <p className="camp-mode-pill">
                    {mode === 'campsite'
                      ? 'Campsite'
                      : `${GAME_LABEL[gameId!]} Boxes`}
                  </p>
                  <button
                    type="button"
                    aria-label="Next right side"
                    onClick={() =>
                      goMode(mode === 'campsite' ? 'move' : 'campsite')
                    }
                  >
                    <span aria-hidden="true">▶</span>
                  </button>
                </div>
              ) : (
                <div className="camp-side-footer" aria-hidden="true" />
              )}
            </div>
          </div>
        )}

        <div className="camp-bar">
          {trading ? (
            <button
              type="button"
              className="camp-upload-btn camp-bar-center"
              onClick={() => goMode('move')}
            >
              End trade
            </button>
          ) : (
            <p className="camp-bar-message" role="status">
              {message}
            </p>
          )}
        </div>
      </div>
    </SitePage>
  )
}

export { GRID_SIZE }
