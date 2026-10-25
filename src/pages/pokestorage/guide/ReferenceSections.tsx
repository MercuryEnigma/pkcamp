import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getAcquisitionRoutes,
  getEggMoveFathers,
  getEggMoves,
  getEvolutionFamilyEdges,
  type AcquisitionStep,
  type PokedexDataset,
  type PokedexEncounter,
  type PokedexSpecies,
} from '../../../services/guide'
import { evolutionDescription, moveName } from '../../../services/i18n'
import { GuideOptions, GuideTable } from './SpeciesDataLayout'
import './referenceSections.css'

function SpeciesName({
  species,
  selected,
  onSelect,
}: {
  species: PokedexSpecies
  selected: number
  onSelect?: (id: number) => void
}) {
  const label = `#${String(species.nationalDexNumber).padStart(3, '0')} ${species.name}`
  return onSelect ? (
    <button
      type="button"
      className="guide-species-link"
      data-selected={species.nationalDexNumber === selected}
      onClick={() => onSelect(species.nationalDexNumber)}
    >
      {label}
    </button>
  ) : (
    <strong>{label}</strong>
  )
}

export function GuideEvolutionFamily({
  dataset,
  species,
  onSelect,
}: {
  dataset: PokedexDataset
  species: PokedexSpecies
  onSelect?: (id: number) => void
}) {
  const { t } = useTranslation('pokedex')
  const edges = getEvolutionFamilyEdges(dataset, species.nationalDexNumber)
  return (
    <div className="guide-reference">
      <GuideTable
        columns={[t('species'), t('evolutionRequirement')]}
        rows={edges.map((edge, index) => ({
          key: `${edge.from.nationalDexNumber}-${edge.to.nationalDexNumber}-${index}`,
          cells: [
            <span key="species">
              <SpeciesName
                species={edge.from}
                selected={species.nationalDexNumber}
                onSelect={onSelect}
              />
              {' → '}
              <SpeciesName
                species={edge.to}
                selected={species.nationalDexNumber}
                onSelect={onSelect}
              />
            </span>,
            evolutionDescription(edge.method, edge.parameter),
          ],
        }))}
        empty={t('noEvolutionFamily')}
      />
    </div>
  )
}

type OverviewCategory = 'stats' | 'abilities' | 'evolutions'
const OVERVIEW_CATEGORIES = ['stats', 'abilities', 'evolutions'] as const

export function GuideOverview({
  dataset,
  species,
  onSelect,
}: {
  dataset: PokedexDataset
  species: PokedexSpecies
  onSelect?: (id: number) => void
}) {
  const { t } = useTranslation(['pokedex', 'lab'] as const)
  const [selection, setSelection] = useState<{
    speciesId: number
    category: OverviewCategory
  }>({ speciesId: species.nationalDexNumber, category: 'stats' })
  const category =
    selection.speciesId === species.nationalDexNumber
      ? selection.category
      : 'stats'
  const stats = [
    [t('lab:PokemonView.hp'), species.stats.hp],
    [t('lab:PokemonView.attackShort'), species.stats.attack],
    [t('lab:PokemonView.defenseShort'), species.stats.defense],
    [t('lab:PokemonView.specialAttackShort'), species.stats.specialAttack],
    [t('lab:PokemonView.specialDefenseShort'), species.stats.specialDefense],
    [t('lab:PokemonView.speedShort'), species.stats.speed],
  ] as const
  const evs = [
    species.evYield.hp ?? 0,
    species.evYield.attack ?? 0,
    species.evYield.defense ?? 0,
    species.evYield.specialAttack ?? 0,
    species.evYield.specialDefense ?? 0,
    species.evYield.speed ?? 0,
  ]
  const statValues = stats.map(([, value]) => value)
  return (
    <div className="guide-reference guide-overview">
      <GuideOptions
        label={t('overviewCategories')}
        options={OVERVIEW_CATEGORIES.map((value) => ({
          value,
          label: t(`overview.${value}`),
        }))}
        value={category}
        onChange={(value) =>
          setSelection({
            speciesId: species.nationalDexNumber,
            category: value,
          })
        }
      >
        {category === 'stats' && (
          <GuideTable
            variant="stats"
            columns={[t('total'), ...stats.map(([label]) => label)]}
            rows={[
              {
                key: 'stats',
                cells: [
                  t('bstValue', {
                    total: statValues.reduce(
                      (total, value) => total + value,
                      0
                    ),
                  }),
                  ...statValues,
                ],
              },
              {
                key: 'evs',
                cells: [
                  t('evsValue', {
                    total: evs.reduce((total, value) => total + value, 0),
                  }),
                  ...evs,
                ],
              },
            ]}
            empty={t('noStats')}
          />
        )}
        {category === 'abilities' && (
          <GuideTable
            columns={[t('slot'), t('ability')]}
            rows={species.abilities.map((ability, index) => ({
              key: `${ability}-${index}`,
              cells: [index + 1, ability],
            }))}
            empty={t('noAbilities')}
          />
        )}
        {category === 'evolutions' && (
          <GuideEvolutionFamily
            dataset={dataset}
            species={species}
            onSelect={onSelect}
          />
        )}
      </GuideOptions>
    </div>
  )
}

type Category = 'levelUp' | 'egg' | 'tmHm'
const CATEGORY_KEYS = {
  levelUp: 'levelUpMoves',
  egg: 'eggMoves',
  tmHm: 'machineMoves',
} as const
const CATEGORY_CAPABILITY = {
  levelUp: 'levelUp',
  egg: 'eggMoves',
  tmHm: 'tmHm',
} as const
const CATEGORIES = ['levelUp', 'egg', 'tmHm'] as const

export function GuideLearnsets({
  dataset,
  species,
  onSelect,
}: {
  dataset: PokedexDataset
  species: PokedexSpecies
  onSelect?: (id: number) => void
}) {
  const { t } = useTranslation('pokedex')
  const [category, setCategory] = useState<Category>('levelUp')
  const eggs = getEggMoves(dataset, species.nationalDexNumber)
  const counts = {
    levelUp: species.learnsets.levelUp.length,
    egg: eggs.length,
    tmHm: species.learnsets.tmHm.length,
  }
  const status =
    dataset.capabilities[CATEGORY_CAPABILITY[category]] ?? 'unavailable'
  const rows: { move: ReactNode; detail: ReactNode }[] =
    category === 'levelUp'
      ? species.learnsets.levelUp.map(({ level, move }) => ({
          move: moveName(move.nationalMoveId, move.romName),
          detail: level,
        }))
      : category === 'egg'
        ? eggs.map(({ move, hatchedAs }) => ({
            move: `${moveName(move.nationalMoveId, move.romName)}:`,
            detail: (() => {
              const fathers = getEggMoveFathers(dataset, move.romId, hatchedAs)
              return fathers.length ? (
                <span className="guide-species-links">
                  {fathers.map((father, index) => (
                    <span key={father.nationalDexNumber}>
                      {index > 0 && ', '}
                      <SpeciesName
                        species={father}
                        selected={species.nationalDexNumber}
                        onSelect={onSelect}
                      />
                    </span>
                  ))}
                </span>
              ) : (
                '—'
              )
            })(),
          }))
        : species.learnsets.tmHm.map((move) => ({
            move: moveName(move.nationalMoveId, move.romName),
            detail: move.machine
              ? `${move.machine.kind.toUpperCase()}${String(move.machine.number).padStart(2, '0')}`
              : '—',
          }))
  return (
    <div className="guide-reference guide-learnsets">
      <GuideOptions
        label={t('moveCategories')}
        options={CATEGORIES.map((value) => ({
          value,
          label: t(CATEGORY_KEYS[value]),
          count: counts[value],
        }))}
        value={category}
        onChange={setCategory}
      >
        {status === 'unavailable' ? (
          <p className="guide-muted">{t('movesUnavailable')}</p>
        ) : (
          <>
            {status === 'partial' && (
              <p className="guide-muted">{t('movesPartial')}</p>
            )}
            <GuideTable
              columns={[
                t('move'),
                t(
                  category === 'levelUp'
                    ? 'level'
                    : category === 'egg'
                      ? 'potentialFathers'
                      : 'machine'
                ),
              ]}
              rows={rows.map((row, index) => ({
                key: index,
                cells: [row.move, row.detail],
              }))}
              empty={t('noMoves')}
            />
          </>
        )}
      </GuideOptions>
    </div>
  )
}

type EncounterCategory =
  'grass' | 'surf' | 'fishing' | 'rock-smash' | 'other' | 'obtaining'
const ENCOUNTER_CATEGORIES: EncounterCategory[] = [
  'grass',
  'surf',
  'fishing',
  'rock-smash',
  'other',
]
const ENCOUNTER_CATEGORY_KEYS = {
  grass: 'encounterTypes.grass',
  surf: 'encounterTypes.surf',
  fishing: 'encounterTypes.fishing',
  'rock-smash': 'encounterTypes.rock-smash',
  other: 'encounterTypes.other',
  obtaining: 'encounterTypes.obtaining',
} as const
function encounterCategory(method: string): EncounterCategory {
  if (method === 'grass' || method === 'surf' || method === 'rock-smash')
    return method
  if (method === 'old-rod' || method === 'good-rod' || method === 'super-rod')
    return 'fishing'
  return 'other'
}

function EncounterDetails({
  encounter,
  percent,
}: {
  encounter: PokedexEncounter
  percent: Intl.NumberFormat
}) {
  const { t } = useTranslation('pokedex')
  return (
    <>
      {t('levelRange', {
        min: encounter.minLevel,
        max: encounter.maxLevel,
      })}
      {encounter.probability !== null && (
        <> · {percent.format(encounter.probability)}</>
      )}
      {encounter.conditions?.length ? (
        <span className="guide-method">{t('specialCondition')}</span>
      ) : null}
    </>
  )
}

export function GuideLocations({
  dataset,
  species,
  onSelect,
}: {
  dataset: PokedexDataset
  species: PokedexSpecies
  onSelect?: (id: number) => void
}) {
  const { t, i18n } = useTranslation('pokedex')
  const routes = getAcquisitionRoutes(dataset, species.nationalDexNumber)
  const percent = new Intl.NumberFormat(i18n.resolvedLanguage, {
    style: 'percent',
    maximumFractionDigits: 0,
  })
  const categorizedEncounters = species.encounters
  const encounterCategories = ENCOUNTER_CATEGORIES.filter((category) =>
    categorizedEncounters.some(
      (encounter) => encounterCategory(encounter.method) === category
    )
  )
  const categories: EncounterCategory[] = encounterCategories.length
    ? encounterCategories
    : ['obtaining']
  const [categorySelection, setCategorySelection] = useState<{
    speciesId: number
    category: EncounterCategory | null
  }>({ speciesId: species.nationalDexNumber, category: categories[0] ?? null })
  const category =
    categorySelection.speciesId === species.nationalDexNumber &&
    categorySelection.category !== null &&
    categories.includes(categorySelection.category)
      ? categorySelection.category
      : (categories[0] ?? null)
  const selectCategory = (value: EncounterCategory) =>
    setCategorySelection({
      speciesId: species.nationalDexNumber,
      category: value,
    })
  const options = categories.map((value) => ({
    value,
    label: t(ENCOUNTER_CATEGORY_KEYS[value]),
    count:
      value === 'obtaining'
        ? undefined
        : categorizedEncounters.filter(
            (encounter) => encounterCategory(encounter.method) === value
          ).length,
  }))
  if (species.encounters.length) {
    const visible = species.encounters.filter(
      (encounter) =>
        category === null || encounterCategory(encounter.method) === category
    )
    return (
      <div className="guide-reference guide-locations">
        <GuideOptions
          label={t('encounterCategories')}
          options={options}
          value={category ?? categories[0]}
          onChange={selectCategory}
        >
          <GuideTable
            columns={[t('location'), t('details')]}
            rows={visible.map((encounter, index) => ({
              key: `${encounter.mapId}-${encounter.method}-${index}`,
              cells: [
                encounter.mapName || t('unknownArea'),
                <EncounterDetails
                  key="details"
                  encounter={encounter}
                  percent={percent}
                />,
              ],
            }))}
            empty={t('noWildLocations')}
          />
        </GuideOptions>
      </div>
    )
  }
  const evolutionSources = species.evolutions.from
    .map((id) => dataset.species[id])
    .filter((entry): entry is PokedexSpecies => Boolean(entry))
  type BreedStep = Extract<AcquisitionStep, { kind: 'breed' }>
  const breedingSteps = routes
    .flatMap((route) => route.steps)
    .filter((step): step is BreedStep => step.kind === 'breed')
  const breedingParents = [...new Set(breedingSteps.map((step) => step.from))]
    .map((id) => dataset.species[id])
    .filter((entry): entry is PokedexSpecies => Boolean(entry))
    .sort((a, b) => {
      const score = (entry: PokedexSpecies) =>
        entry.encounters.reduce(
          (total, encounter) => total + (encounter.probability ?? 0),
          0
        )
      return (
        score(b) - score(a) ||
        b.encounters.length - a.encounters.length ||
        a.nationalDexNumber - b.nationalDexNumber
      )
    })
  const preferredParent = breedingParents[0]
  const obtainingRows = evolutionSources.length
    ? evolutionSources.map((source) => ({
        key: `evolve-${source.nationalDexNumber}`,
        cells: [
          t('obtain.evolution'),
          <span key="source">
            {t('obtain.evolvePrefix')}
            <SpeciesName
              species={source}
              selected={species.nationalDexNumber}
              onSelect={onSelect}
            />
          </span>,
        ],
      }))
    : preferredParent
      ? [
          {
            key: `breed-${preferredParent.nationalDexNumber}`,
            cells: [
              t('obtain.breeding'),
              <span key="source">
                {t('obtain.breedPrefix')}
                <SpeciesName
                  species={preferredParent}
                  selected={species.nationalDexNumber}
                  onSelect={onSelect}
                />
              </span>,
            ],
          },
        ]
      : []
  return (
    <div className="guide-reference guide-locations">
      <p className="guide-muted">
        {t(
          dataset.capabilities.encounters === 'unavailable'
            ? 'locationsUnavailable'
            : 'noWildLocations'
        )}
      </p>
      <GuideOptions
        label={t('encounterCategories')}
        options={options}
        value={category ?? categories[0]}
        onChange={selectCategory}
      >
        <GuideTable
          columns={[t('obtain.method'), t('details')]}
          rows={obtainingRows}
          empty={t('sourceLocationUnknown')}
        />
      </GuideOptions>
    </div>
  )
}
