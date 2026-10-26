import { collectionDisplay } from './collectionDisplay'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collections } from '../../../services/collections'
import type { StoredCollectionMatch } from '../../../services/storage'
import { useActiveGame } from '../../context/useActiveGame'
import { useCollections } from '../../context/useCollections'
import type { CampDestination } from '../PokeStorageMain'
import { useSpriteResolver } from '../useStorage'
import { BUILT_IN_COLLECTIONS } from './builtInCollections'
import type { CollectionDefinition } from './collectionTypes'
import { isRegistered, registeredCount } from './collectionTypes'
import { emptyDraft } from './builderDraft'
import { CollectionBuilder } from './CollectionBuilder'
import { CollectionGrid } from './CollectionGrid'
import { CollectionHome } from './CollectionHome'
import {
  collectionEntryLabel,
  entryDexNumber,
  type StatusFilter,
} from './entryDisplay'
import {
  getFilterFields,
  activeFilters,
  entryMatchesFilters,
  filterOptions,
  type EntryFilters,
} from './entryFilter'
import { PcFilterScreen } from './PcFilterScreen'
import { PokemonView } from './PokemonView'
import { GEN_3_GAMES } from './labStore'
import { useLabData } from './useLabData'
import { guide } from '../../../services/guide'
import { useGuide } from '../../context/useGuide'
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

type Screen = 'home' | 'grid' | 'entry' | 'filters' | 'builder'

/**
 * The Pokédex terminal: the collection directory, one collection's grid, an
 * entry's detail, the filters and the new-collection builder, as screens of
 * one device. Research state lives in the `collections` service, so it
 * survives Hub, Camp and Lab navigation; the screen, filters and builder
 * draft last while this page is mounted.
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
  const { t } = useTranslation(['collections', 'common'] as const)

  const state = useCollections()
  const { gameId } = useActiveGame()
  const { uploads, errors: uploadErrors, upload } = useLabData()
  const resolver = useSpriteResolver()
  const [screen, setScreen] = useState<Screen>('home')
  const [draft, setDraft] = useState(emptyDraft)
  const [entryFilters, setEntryFilters] = useState<EntryFilters>({})
  const filters = useMemo(() => activeFilters(entryFilters), [entryFilters])
  // The Pokédex button names the collection once one has been opened.
  const [opened, setOpened] = useState(false)
  const reference = useGuide()

  const currentId = state.currentId ?? state.enabledIds[0] ?? null
  const definition =
    state.definitions.find((item) => item.id === currentId) ??
    BUILT_IN_COLLECTIONS[0]
  const workspace = state.workspaces[definition.id]
  const result = state.results[definition.id] ?? null
  const filter: StatusFilter = workspace?.filter ?? 'all'
  const query = workspace?.query ?? ''
  const selectedId = workspace?.selectedEntryId ?? null
  const patch = (change: Parameters<typeof collections.updateWorkspace>[1]) =>
    collections.updateWorkspace(definition.id, change)

  // Coming back from Camp may have changed what is found.
  const seenReturns = useRef(campReturns)
  useEffect(() => {
    if (campReturns === seenReturns.current) return
    seenReturns.current = campReturns
    void collections.refresh()
  }, [campReturns])

  const definitionId = definition.id
  const selectedDexNumber = selectedId
    ? entryDexNumber(definition.pokemon[selectedId])
    : null
  const referenceSpecies =
    reference.gameId === gameId && selectedDexNumber !== null
      ? (guide.getSpecies(selectedDexNumber) ?? null)
      : null
  const referenceStatus =
    reference.gameId === gameId ? reference.status : 'loading'
  const saveScroll = useCallback(
    (scrollTop: number) =>
      collections.updateWorkspace(definitionId, { scrollTop }),
    [definitionId]
  )

  const ids = useMemo(() => entryIds(definition), [definition])
  /** What the nav filters look at for one entry. */
  const filterSubject = useCallback(
    (id: string) => ({
      label: collectionEntryLabel(definition, id),
      species: entryDexNumber(definition.pokemon[id]),
      constraints: definition.pokemon[id],
      matches: result?.entries[id]?.matches ?? [],
    }),
    // Helpers below use the shared i18n instance; invalidate their labels on language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [definition, result, t]
  )
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return ids.filter((id) => {
      const status = result?.entries[id]?.status
      const found = result?.entries[id]?.matches ?? []
      if (filter === 'registered' && !isRegistered(status)) return false
      if (filter === 'missing' && isRegistered(status)) return false
      if (
        filter === 'visiting' &&
        !found.some((match) => 'camp' in match || match.gameId === gameId)
      )
        return false
      if (
        filters.length > 0 &&
        !entryMatchesFilters(filters, filterSubject(id))
      )
        return false
      if (!needle) return true
      const dex = entryDexNumber(definition.pokemon[id])
      return (
        collectionEntryLabel(definition, id).toLowerCase().includes(needle) ||
        id.toLowerCase().includes(needle) ||
        (dex !== null && String(dex).includes(needle))
      )
    })
    // collectionEntryLabel resolves its translated labels through the shared instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    definition,
    filterSubject,
    filters,
    filter,
    gameId,
    ids,
    query,
    result,
    t,
  ])
  const statuses = useMemo(
    () =>
      Object.fromEntries(
        ids.map((id) => [id, result?.entries[id]?.status] as const)
      ),
    [ids, result]
  )

  const enabledDefinitions = useMemo(() => {
    const all = [...state.definitions, ...uploads]
    return state.enabledIds.flatMap((id) => {
      const found = all.find((item) => item.id === id)
      return found ? [found] : []
    })
  }, [state.definitions, state.enabledIds, uploads])
  const available = useMemo(
    () =>
      [...state.definitions, ...uploads].filter(
        (item, index, all) =>
          !state.enabledIds.includes(item.id) &&
          all.findIndex((other) => other.id === item.id) === index
      ),
    [state.definitions, state.enabledIds, uploads]
  )
  const firstEntryIds = useMemo(
    () =>
      Object.fromEntries(
        enabledDefinitions.map((item) => [item.id, entryIds(item)[0]] as const)
      ),
    [enabledDefinitions]
  )

  const options = useMemo(
    () => filterOptions(ids.map(filterSubject)),
    [filterSubject, ids]
  )
  const entryStatus = selectedId
    ? result?.entries[selectedId]?.status
    : undefined
  const matches = selectedId ? (result?.entries[selectedId]?.matches ?? []) : []
  // A selection left over from another collection has nothing to show.
  const showEntry =
    screen === 'entry' &&
    selectedId !== null &&
    !!definition.pokemon[selectedId]
  const active: Screen = screen === 'entry' && !showEntry ? 'grid' : screen

  const addCollections = (added: string[]) => {
    collections.setEnabled([...state.enabledIds, ...added])
    collections.openCollection(added[0])
    void collections.refresh()
    setOpened(true)
    setScreen('grid')
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
    <div className="pc">
      <nav className="pc-nav" aria-label={t('CollectionView.pokeDexScreens')}>
        <button
          type="button"
          aria-pressed={active === 'home'}
          onClick={() => setScreen('home')}
        >
          {t('CollectionView.collections')}
        </button>
        {active === 'builder' && (
          <button type="button" aria-pressed>
            {t('CollectionView.addNewCollection')}
          </button>
        )}
        <button
          type="button"
          aria-pressed={active === 'grid' || active === 'entry'}
          onClick={() => {
            setOpened(true)
            setScreen('grid')
          }}
        >
          {opened
            ? collectionDisplay(definition).name
            : t('CollectionView.pokeDex')}
        </button>
        <button
          type="button"
          aria-pressed={active === 'filters'}
          onClick={() => setScreen('filters')}
        >
          {t('CollectionView.filter', {
            value1:
              filters.length > 0
                ? t('collections:CollectionView.filterCount', {
                    length: filters.length,
                  })
                : '',
          })}
        </button>
      </nav>
      <div className="pc-screen">
        {state.error && <p role="alert">{state.error.message}</p>}
        {active === 'home' && (
          <CollectionHome
            definitions={enabledDefinitions}
            results={state.results}
            firstEntryIds={firstEntryIds}
            resolver={resolver}
            onOpen={(id) => {
              collections.openCollection(id)
              setOpened(true)
              setScreen('grid')
            }}
            available={available}
            onAdd={(id) => addCollections([id])}
            onNew={() => setScreen('builder')}
          />
        )}
        {active === 'builder' && (
          <CollectionBuilder
            draft={draft}
            errors={uploadErrors}
            onChange={setDraft}
            onCreate={async (file) => {
              const added = await uploadCollection(file)
              if (added) setDraft(emptyDraft())
              return added
            }}
            onCancel={() => {
              setDraft(emptyDraft())
              setScreen('home')
            }}
          />
        )}
        {active === 'filters' && (
          <PcFilterScreen
            filters={entryFilters}
            options={options}
            onApply={(next) => {
              setEntryFilters(next)
              setScreen('grid')
            }}
            onReset={() => setEntryFilters({})}
          />
        )}
        {active === 'grid' && (
          <CollectionGrid
            key={definition.id}
            definition={definition}
            rows={rows}
            statuses={statuses}
            registered={result ? registeredCount(result) : 0}
            total={result?.total ?? ids.length}
            selectedId={selectedId}
            query={query}
            filter={filter}
            scanning={state.status === 'loading' || state.status === 'scanning'}
            resolver={resolver}
            initialScroll={workspace?.scrollTop ?? 0}
            restoreKey={campReturns}
            onScrollChange={saveScroll}
            onQuery={(next) => patch({ query: next })}
            onFilter={(next) => patch({ filter: next })}
            onSelect={(id) => {
              patch({ selectedEntryId: id })
              setScreen('entry')
            }}
            filters={filters.map(({ field, text }) => ({
              field,
              label: t('CollectionView.activeFilter', {
                value1: getFilterFields().find(([name]) => name === field)?.[1],
                text: text,
              }),
            }))}
            onClearFilter={(field) =>
              setEntryFilters((current) => ({ ...current, [field]: '' }))
            }
            onBack={() => setScreen('home')}
          />
        )}
        {active === 'entry' && selectedId && (
          <PokemonView
            definition={definition}
            entryId={selectedId}
            registered={isRegistered(entryStatus)}
            matches={matches}
            resolver={resolver}
            referenceSpecies={referenceSpecies}
            referenceStatus={referenceStatus}
            referenceTitle={reference.dataset?.game.title ?? null}
            referenceDataset={
              reference.gameId === gameId ? reference.dataset : null
            }
            canOpen={(match) => 'camp' in match || match.gameId === gameId}
            onOpenInCamp={open}
            onBack={() => setScreen('grid')}
          />
        )}
      </div>
      <footer className="pc-footer">
        <span className="pc-footer-strip" aria-hidden="true" />
        <span>{'pkcamp'}</span>
        <span className="pc-label">
          {t('researchSystem')}
        </span>
      </footer>
    </div>
  )
}
