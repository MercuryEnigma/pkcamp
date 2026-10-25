import { useState, type CSSProperties } from 'react'
import {
  FILTER_FIELDS,
  type EntryFilterField,
  type EntryFilters,
} from './entryFilter'
import { PcCombobox } from './PcCombobox'
import { TYPE_COLORS, TYPE_NAMES } from './gen3Data'

const PLACEHOLDER: Record<EntryFilterField, string> = {
  name: 'Select a Pokémon…',
  type: '',
  move: 'Select a move…',
  ability: 'Select an ability…',
  nature: 'Select a nature…',
  item: 'Select an item…',
  ribbon: 'Select a ribbon…',
  ot: 'Select a trainer…',
}

/** Screen 4: every filter at once, applied together to the grid. */
export function PcFilterScreen({
  filters,
  options,
  onApply,
}: {
  filters: EntryFilters
  /** Suggestions per text field, from what the collection holds. */
  options: Record<Exclude<EntryFilterField, 'type'>, readonly string[]>
  onApply: (filters: EntryFilters) => void
}) {
  const [draft, setDraft] = useState<EntryFilters>(filters)
  const set = (field: EntryFilterField, text: string) =>
    setDraft((current) => ({ ...current, [field]: text }))

  return (
    <form
      className="pc-screen-body pc-filter-screen"
      onSubmit={(event) => {
        event.preventDefault()
        onApply(draft)
      }}
    >
      <div className="pc-filter-fields">
        {FILTER_FIELDS.map(([field, label], index) => (
          <fieldset key={field} className="pc-filter-field">
            <legend className="pc-label">{label}</legend>
            {field === 'type' ? (
              <div className="pc-type-chips" role="group" aria-label="Type">
                {['', ...TYPE_NAMES].map((type) => (
                  <button
                    key={type || 'all'}
                    type="button"
                    aria-pressed={(draft.type ?? '') === type}
                    style={
                      type
                        ? ({
                            '--type': TYPE_COLORS[type].fill,
                            '--type-text': TYPE_COLORS[type].text,
                          } as CSSProperties)
                        : undefined
                    }
                    onClick={() => set('type', type)}
                  >
                    {type || 'All'}
                  </button>
                ))}
              </div>
            ) : (
              <PcCombobox
                label={label}
                placeholder={PLACEHOLDER[field]}
                value={draft[field] ?? ''}
                options={options[field]}
                onChange={(text) => set(field, text)}
                openUp={index >= 4}
              />
            )}
          </fieldset>
        ))}
      </div>
      <footer className="pc-filter-actions">
        <button type="button" className="pc-reset" onClick={() => setDraft({})}>
          Reset filters
        </button>
        <button type="submit" className="pc-apply">
          Apply filters
        </button>
      </footer>
    </form>
  )
}
