import { useState, type ComponentProps, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PokedexDataset, PokedexSpecies } from '../../../services/guide'
import { SpriteCredit } from '../SpriteCredit'
import { spriteDisplayImageSrc, type SpriteDisplay } from '../spriteDisplay'
import {
  GuideLearnsets,
  GuideLocations,
  GuideOverview,
} from './ReferenceSections'
import { GuideSectionHeader } from './SpeciesDataLayout'
import './referenceSections.css'

const DATA_SECTIONS = ['overview', 'moves', 'locations'] as const

/**
 * The Species Data screen shared by the PC entry view and the Arcade guide:
 * a hero column beside the paged reference panel.
 */
export function SpeciesDataView({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={`species-data-view${className ? ` ${className}` : ''}`}
      {...props}
    />
  )
}

/** The sprite well, dex number and name, plus an optional stamp. */
export function SpeciesHero({
  display,
  dexNumber,
  name,
  label,
  children,
}: {
  display: SpriteDisplay
  dexNumber: number | null
  name: string
  label: string
  /** Shown between the name and the sprite credit, e.g. a Registered stamp. */
  children?: ReactNode
}) {
  return (
    <section className="species-hero" aria-label={label}>
      <span className="species-hero-sprite">
        <img src={spriteDisplayImageSrc(display)} alt="" />
      </span>
      <h2>
        {dexNumber !== null && `#${String(dexNumber).padStart(3, '0')} `}
        {name.toUpperCase()}
      </h2>
      {children}
      <SpriteCredit display={display} />
    </section>
  )
}

/**
 * The paged Overview / Moves / Locations reference. Following a species link
 * keeps the current section; remount it (with a `key`) to start over.
 */
export function SpeciesDataPanel({
  species,
  dataset,
  title,
  onSelectSpecies,
  children,
}: {
  species: PokedexSpecies | null
  dataset: PokedexDataset | null
  title: string | null
  onSelectSpecies: (id: number) => void
  /** Status messages shown under the heading while data is unavailable. */
  children?: ReactNode
}) {
  const { t } = useTranslation('pokedex')
  const [sectionIndex, setSectionIndex] = useState(0)
  const section = DATA_SECTIONS[sectionIndex]
  const sectionLabel = {
    overview: t('overviewSection'),
    moves: t('moves'),
    locations: t('locations'),
  }[section]

  const selectSection = (index: number) =>
    setSectionIndex((index + DATA_SECTIONS.length) % DATA_SECTIONS.length)

  return (
    <section className="species-data" aria-label={t('speciesData')}>
      <h3 className="species-data-heading">
        {title ?? t('speciesData')}
        {species &&
          ` · #${String(species.nationalDexNumber).padStart(3, '0')} ${species.name} · ${[...new Set(species.types)].join(' / ')}`}
      </h3>
      {children}
      {species && dataset && (
        <>
          <GuideSectionHeader
            title={sectionLabel}
            current={sectionIndex + 1}
            total={DATA_SECTIONS.length}
            positionLabel={t('dataSectionPosition', {
              current: sectionIndex + 1,
              total: DATA_SECTIONS.length,
            })}
            previousLabel={t('previousDataSection')}
            nextLabel={t('nextDataSection')}
            onPrevious={() => selectSection(sectionIndex - 1)}
            onNext={() => selectSection(sectionIndex + 1)}
          />
          <div className="species-data-panel">
            {section === 'overview' && (
              <GuideOverview
                dataset={dataset}
                species={species}
                onSelect={onSelectSpecies}
              />
            )}
            {section === 'moves' && (
              <GuideLearnsets
                dataset={dataset}
                species={species}
                onSelect={onSelectSpecies}
              />
            )}
            {section === 'locations' && (
              <GuideLocations
                dataset={dataset}
                species={species}
                onSelect={onSelectSpecies}
              />
            )}
          </div>
        </>
      )}
    </section>
  )
}
