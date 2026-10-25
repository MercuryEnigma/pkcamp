import { useId, type Key, type ReactNode } from 'react'

export interface GuideOption<Value extends string> {
  value: Value
  label: ReactNode
  count?: number
}

export function GuideSectionHeader({
  title,
  current,
  total,
  positionLabel,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
}: {
  title: ReactNode
  current: number
  total: number
  positionLabel: string
  previousLabel: string
  nextLabel: string
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="guide-section-header">
      <h4 className="guide-section-title">{title}</h4>
      <div className="guide-page-nav">
        <button type="button" aria-label={previousLabel} onClick={onPrevious}>
          ‹
        </button>
        <span aria-live="polite" aria-label={positionLabel}>
          {current} / {total}
        </span>
        <button type="button" aria-label={nextLabel} onClick={onNext}>
          ›
        </button>
      </div>
    </div>
  )
}

export function GuideOptions<Value extends string>({
  label,
  options,
  value,
  onChange,
  children,
}: {
  label: string
  options: readonly GuideOption<Value>[]
  value: Value
  onChange: (value: Value) => void
  children: ReactNode
}) {
  const id = useId()
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )
  const select = (next: GuideOption<Value>) => {
    onChange(next.value)
    document.getElementById(`${id}-${next.value}`)?.focus()
  }
  return (
    <div className="guide-options">
      <div className="guide-option-tabs" role="tablist" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            id={`${id}-${option.value}`}
            type="button"
            role="tab"
            aria-selected={option.value === value}
            aria-controls={`${id}-panel`}
            tabIndex={option.value === value ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (
                !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
              )
                return
              event.preventDefault()
              const next =
                event.key === 'Home'
                  ? options[0]
                  : event.key === 'End'
                    ? options.at(-1)!
                    : options[
                        (activeIndex +
                          (event.key === 'ArrowLeft'
                            ? options.length - 1
                            : 1)) %
                          options.length
                      ]
              select(next)
            }}
          >
            {option.label}
            {option.count !== undefined && <span> ({option.count})</span>}
          </button>
        ))}
      </div>
      <div
        className="guide-option-panel"
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${value}`}
      >
        {children}
      </div>
    </div>
  )
}

export interface GuideTableRow {
  key: Key
  cells: readonly ReactNode[]
}

export function GuideTable({
  columns,
  rows,
  empty,
  variant = 'default',
}: {
  columns: readonly ReactNode[]
  rows: readonly GuideTableRow[]
  empty: ReactNode
  variant?: 'default' | 'stats'
}) {
  if (!rows.length) return <p className="guide-muted">{empty}</p>
  return (
    <table className={`guide-data-table guide-data-table--${variant}`}>
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th key={index} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, index) => (
              <td key={index}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
