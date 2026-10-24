import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { collections } from '../../../services/collections'
import type { StoredCollectionMatch } from '../../../services/storage'
import { OptionGroup } from '../../hub/OptionGroup'
import { useActiveGame } from '../../context/useActiveGame'
import { useCollections } from '../../context/useCollections'
import type { CampDestination } from '../PokeStorageMain'
import { useSpriteResolver } from '../useStorage'
import { BUILT_IN_COLLECTIONS } from './builtInCollections'
import type { CollectionDefinition } from './collectionTypes'
import { isRegistered } from './collectionTypes'
import {
  STATUS_FILTERS,
  collectionEntryLabel,
  entryDexNumber,
  type StatusFilter,
} from './entryDisplay'
import { PcCollectionTabs } from './PcCollectionTabs'
import { PokemonView } from './PokemonView'
import { GEN_3_GAMES } from './labStore'
import { useLabData } from './useLabData'
import './pc.css'

/** Entry ids in group order, then any entry no group lists. */
function entryIds(definition: CollectionDefinition): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const id of [
    ...definition.groups.flatMap((group) => group.pokemon),
    ...Object.keys(definition.pokemon),
  ]) {
    if (definition.pokemon[id] && !seen.has(id)) {
      seen.add(id)
      ordered.push(id)
    }
  }
  return ordered
}

const PANES = [
  ['list', 'Collection'],
  ['view', 'View'],
] as const

/**
 * The PC: the collections added to research on the left, and the selected
 * entry's matching Pokémon on the right. On phones a toggle switches between
 * the two. All state lives in the `collections` service, so it survives Hub,
 * Camp and Lab navigation.
 */
export function CollectionView({
  onOpenInCamp,
  campReturns,
}: {
  /** Opens a Camp screen; this page stays mounted underneath. */
  onOpenInCamp: (destination: CampDestination) => void
  /** Bumped each time the player comes back from Camp. */
  campReturns: number
}) {
  const state = useCollections()
  const { gameId } = useActiveGame()
  const { uploads, errors: uploadErrors, upload } = useLabData()
  const resolver = useSpriteResolver()
  const list = useRef<HTMLUListElement>(null)

  const currentId = state.currentId ?? state.enabledIds[0] ?? null
  const definition =
    state.definitions.find((item) => item.id === currentId) ??
    BUILT_IN_COLLECTIONS[0]
  const workspace = state.workspaces[definition.id]
  const result = state.results[definition.id] ?? null
  const filter: StatusFilter = workspace?.filter ?? 'all'
  const query = workspace?.query ?? ''
  const pane = workspace?.mobilePane ?? 'list'
  const selectedId = workspace?.selectedEntryId ?? null
  const matchIndex = workspace?.matchIndex ?? 0
  const patch = (change: Parameters<typeof collections.updateWorkspace>[1]) =>
    collections.updateWorkspace(definition.id, change)

  // Coming back from Camp may have changed what is found.
  const seenReturns = useRef(campReturns)
  useEffect(() => {
    if (campReturns === seenReturns.current) return
    seenReturns.current = campReturns
    void collections.refresh()
  }, [campReturns])

  // Remember the list's scroll position across tabs and pages.
  const scroll = useRef(0)
  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = workspace?.scrollTop ?? 0
    // Restore only when the collection changes or the page returns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.id, campReturns])
  useEffect(
    () => () =>
      collections.updateWorkspace(definition.id, {
        scrollTop: scroll.current,
      }),
    [definition.id]
  )

  const ids = useMemo(() => entryIds(definition), [definition])
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return ids.filter((id) => {
      const status = result?.entries[id]?.status
      if (filter === 'registered' && !isRegistered(status)) return false
      if (filter === 'missing' && isRegistered(status)) return false
      if (!needle) return true
      const dex = entryDexNumber(definition.pokemon[id])
      return (
        collectionEntryLabel(definition, id).toLowerCase().includes(needle) ||
        id.toLowerCase().includes(needle) ||
        (dex !== null && String(dex).includes(needle))
      )
    })
  }, [definition, filter, ids, query, result])

  const totals = state.enabledIds.reduce(
    (sum, id) => ({
      owned: sum.owned + (state.results[id]?.owned ?? 0),
      seen: sum.seen + (state.results[id]?.seen ?? 0),
      total: sum.total + (state.results[id]?.total ?? 0),
    }),
    { owned: 0, seen: 0, total: 0 }
  )
  const matches = selectedId ? (result?.entries[selectedId]?.matches ?? []) : []

  const addCollections = (added: string[]) => {
    collections.setEnabled([...state.enabledIds, ...added])
    collections.openCollection(added[0])
    void collections.refresh()
  }
  const uploadCollection = async (file: File) => {
    const id = await upload(file)
    if (!id) return false
    await collections.reloadDefinitions()
    addCollections([id])
    return true
  }
  const open = (match: StoredCollectionMatch) => {
    if ('camp' in match)
      onOpenInCamp({ name: 'campSites', site: match.location.site })
    else {
      const cabin = GEN_3_GAMES.find((id) => id === match.gameId)
      if (cabin)
        onOpenInCamp({
          name: 'cabin',
          gameId: cabin,
          box: match.location === 'party' ? undefined : match.location.box,
        })
    }
  }

  return (
    <div className="pc" data-pane={pane}>
      <OptionGroup
        label="Panel"
        options={PANES}
        value={pane}
        onChange={(next) => patch({ mobilePane: next })}
      />
      <div className="pc-left">
        <PcCollectionTabs
          definitions={[...state.definitions, ...uploads].filter(
            (item, index, all) =>
              all.findIndex((other) => other.id === item.id) === index
          )}
          enabledIds={state.enabledIds}
          recentIds={state.recentIds}
          currentId={definition.id}
          onOpen={(id) => collections.openCollection(id)}
          onAdd={addCollections}
          onUpload={uploadCollection}
          uploadErrors={uploadErrors}
        />
        <div className="pc-filters">
          <input
            type="search"
            placeholder="Search name, number, or id"
            aria-label="Search entries"
            value={query}
            onChange={(event) => patch({ query: event.target.value })}
          />
          <OptionGroup
            label="Status filter"
            options={STATUS_FILTERS.map((o) => [o.value, o.label] as const)}
            value={filter}
            onChange={(next) => patch({ filter: next })}
          />
        </div>
        {state.error && <p role="alert">{state.error.message}</p>}
        <ul
          ref={list}
          className="pc-entries"
          aria-label="Entries"
          onScroll={(event) => {
            scroll.current = event.currentTarget.scrollTop
          }}
        >
          {rows.map((id) => {
            const status = result?.entries[id]?.status ?? 'unseen'
            const dex = entryDexNumber(definition.pokemon[id])
            return (
              <li key={id}>
                <button
                  type="button"
                  className="pc-entry"
                  data-status={status}
                  aria-pressed={id === selectedId}
                  onClick={() =>
                    patch({
                      selectedEntryId: id,
                      matchIndex: 0,
                      mobilePane: 'view',
                    })
                  }
                >
                  <span>
                    {dex !== null && `#${dex} `}
                    {collectionEntryLabel(definition, id)}
                  </span>
                  <span>
                    {status === 'owned'
                      ? 'Owned'
                      : status === 'seen'
                        ? 'Seen'
                        : 'Unseen'}
                  </span>
                </button>
              </li>
            )
          })}
          {rows.length === 0 && (
            <li className="pc-empty">
              {state.status === 'loading' || state.status === 'scanning'
                ? 'Scanning…'
                : 'No entries match.'}
            </li>
          )}
        </ul>
      </div>

      <div className="pc-right">
        <p className="pc-progress" aria-live="polite">
          Research progress · Owned {totals.owned} · Seen {totals.seen} /{' '}
          {totals.total}
        </p>
        <PokemonView
          definition={definition}
          entryId={selectedId}
          matches={matches}
          matchIndex={matchIndex}
          onMatchChange={(index) => patch({ matchIndex: index })}
          resolver={resolver}
          canOpen={(match) => 'camp' in match || match.gameId === gameId}
          onOpenInCamp={open}
        />
      </div>
    </div>
  )
}
