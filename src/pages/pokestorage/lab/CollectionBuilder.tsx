import { useState, type ReactNode } from 'react'
import {
  SPECIES_OPTIONS,
  draftProblems,
  entryIdFor,
  summarizeEntry,
  toDefinition,
  type CollectionDraft,
  type DraftEntry,
  type ShinyRule,
} from './builderDraft'
import { GEN3_RIBBONS, NATURES } from './gen3Data'
import { PcCombobox } from './PcCombobox'

const SPECIES_LABELS = SPECIES_OPTIONS.map((option) => option.label)
const SHINY: readonly [ShinyRule, string][] = [
  ['any', 'Any'],
  ['yes', 'Shiny'],
  ['no', 'Not shiny'],
]

/** The Pokémon form, as typed; species is resolved when it names an option. */
interface EntryForm {
  species: string
  shiny: ShinyRule
  ribbons: string[]
  nature: string
  ability: string
  move: string
  ot: string
  trainerId: string
}

const EMPTY_FORM: EntryForm = {
  species: '',
  shiny: 'any',
  ribbons: [],
  nature: '',
  ability: '',
  move: '',
  ot: '',
  trainerId: '',
}

const findSpecies = (text: string) =>
  SPECIES_OPTIONS.find(
    (option) => option.label.toLowerCase() === text.trim().toLowerCase()
  )

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`pc-field ${className ?? ''}`}>
      <span className="pc-label">{label}</span>
      {children}
    </label>
  )
}

/** Left column: what the collection is. */
function DetailsColumn({
  draft,
  onChange,
}: {
  draft: CollectionDraft
  onChange: (draft: CollectionDraft) => void
}) {
  const text = (key: keyof Omit<CollectionDraft, 'entries'>) => ({
    value: draft[key],
    onChange: (event: { target: { value: string } }) =>
      onChange({ ...draft, [key]: event.target.value }),
  })
  return (
    <section className="pc-builder-col pc-form" aria-label="Collection details">
      <Field label="Name *" className="pc-span-2">
        <input {...text('name')} />
      </Field>
      <Field label="Description" className="pc-span-2">
        <textarea rows={3} {...text('description')} />
      </Field>
      <Field label="Author">
        <input {...text('author')} />
      </Field>
      <Field label="Source">
        <input {...text('source')} />
      </Field>
      <Field label="Details">
        <textarea rows={2} {...text('details')} />
      </Field>
      <Field label="Updated">
        <input type="date" {...text('updated')} />
      </Field>
    </section>
  )
}

/** The requirements of the Pokémon being added or edited. */
function EntryFields({
  form,
  onChange,
}: {
  form: EntryForm
  onChange: (form: EntryForm) => void
}) {
  // Ribbon text being typed; a full name moves into the chosen ribbons.
  const [ribbon, setRibbon] = useState('')
  const set = (change: Partial<EntryForm>) => onChange({ ...form, ...change })

  return (
    <div className="pc-entry-form">
      <Field label="Species *" className="pc-span-6">
        <PcCombobox
          label="Species"
          placeholder="Select a Pokémon…"
          value={form.species}
          options={SPECIES_LABELS}
          onChange={(value) => set({ species: value })}
        />
      </Field>
      <div className="pc-field pc-span-3">
        <span className="pc-label">Shiny</span>
        <div className="pc-segment" role="group" aria-label="Shiny">
          {SHINY.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={form.shiny === value}
              onClick={() => set({ shiny: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="pc-field pc-span-3">
        <span className="pc-label">Ribbons (all required)</span>
        <PcCombobox
          label="Ribbons"
          placeholder="Add a ribbon…"
          value={ribbon}
          options={GEN3_RIBBONS.filter((name) => !form.ribbons.includes(name))}
          onChange={(value) => {
            const name = GEN3_RIBBONS.find(
              (candidate) =>
                candidate.toLowerCase() === value.trim().toLowerCase()
            )
            if (!name) return setRibbon(value)
            setRibbon('')
            if (!form.ribbons.includes(name))
              set({ ribbons: [...form.ribbons, name] })
          }}
        />
        {form.ribbons.length > 0 && (
          <div className="pc-selected">
            {form.ribbons.map((name) => (
              <button
                key={name}
                type="button"
                className="pc-chip"
                aria-label={`Remove ${name}`}
                onClick={() =>
                  set({ ribbons: form.ribbons.filter((r) => r !== name) })
                }
              >
                {name} ✕
              </button>
            ))}
          </div>
        )}
      </div>
      <Field label="Nature" className="pc-span-2">
        <PcCombobox
          label="Nature"
          placeholder="Any"
          value={form.nature}
          options={NATURES}
          onChange={(value) => set({ nature: value })}
        />
      </Field>
      <Field label="Ability" className="pc-span-2">
        <input
          placeholder="Any"
          value={form.ability}
          onChange={(event) => set({ ability: event.target.value })}
        />
      </Field>
      <Field label="Move" className="pc-span-2">
        <input
          placeholder="Any"
          value={form.move}
          onChange={(event) => set({ move: event.target.value })}
        />
      </Field>
      <Field label="OT" className="pc-span-3">
        <input
          placeholder="Any"
          value={form.ot}
          onChange={(event) => set({ ot: event.target.value })}
        />
      </Field>
      <Field label="ID" className="pc-span-3">
        <input
          inputMode="numeric"
          placeholder="Any"
          value={form.trainerId}
          onChange={(event) => set({ trainerId: event.target.value })}
        />
      </Field>
    </div>
  )
}

/** Right column: the Pokémon form, and the Pokémon added so far. */
function PokemonColumn({
  entries,
  form,
  onFormChange,
  onOpen,
  onRemove,
}: {
  entries: readonly DraftEntry[]
  /** The Pokémon being added or edited; `null` while the form is closed. */
  form: EntryForm | null
  onFormChange: (form: EntryForm) => void
  /** Opens the form, empty or for an entry to edit. */
  onOpen: (entry: DraftEntry | null) => void
  onRemove: (entry: DraftEntry) => void
}) {
  return (
    <section className="pc-builder-col" aria-label="Pokémon">
      <header className="pc-builder-head">
        <h3 className="pc-label">Pokémon</h3>
        <span className="pc-count-badge">{entries.length} added</span>
      </header>
      {!form && (
        <button
          type="button"
          className="pc-secondary pc-add-pokemon"
          onClick={() => onOpen(null)}
        >
          + Add Pokémon
        </button>
      )}
      {form && <EntryFields form={form} onChange={onFormChange} />}

      {!form && entries.length > 0 && (
        <table className="pc-table">
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <strong>{entry.species.label}</strong>
                </td>
                <td className="pc-table-wide">
                  {summarizeEntry(entry) || (
                    <span className="pc-muted">Any</span>
                  )}
                </td>
                <td className="pc-table-actions">
                  <button
                    type="button"
                    className="pc-link-btn"
                    onClick={() => onOpen(entry)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="pc-link-btn"
                    onClick={() => onRemove(entry)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

/** The new-collection screen: details on the left, Pokémon on the right. */
export function CollectionBuilder({
  draft,
  errors,
  onChange,
  onCreate,
  onCancel,
}: {
  draft: CollectionDraft
  /** Why the last attempt to add the collection was refused. */
  errors: readonly string[]
  onChange: (draft: CollectionDraft) => void
  /** Resolves true once the collection is added. */
  onCreate: (file: File) => Promise<boolean>
  onCancel: () => void
}) {
  const [form, setForm] = useState<EntryForm | null>(null)
  // The id of the entry being edited, or null when adding.
  const [editingId, setEditingId] = useState<string | null>(null)
  const species = form ? findSpecies(form.species) : undefined
  const problems = draftProblems(draft)

  const closeForm = () => {
    setForm(null)
    setEditingId(null)
  }
  const saveEntry = () => {
    if (!form || !species) return
    const { entries } = draft
    const editing = entries.find((entry) => entry.id === editingId)
    const entry: DraftEntry = {
      ...form,
      species,
      id:
        editing && editing.species === species
          ? editing.id
          : entryIdFor(
              species,
              entries.filter((other) => other !== editing)
            ),
    }
    onChange({
      ...draft,
      entries: editing
        ? entries.map((other) => (other === editing ? entry : other))
        : [...entries, entry],
    })
    closeForm()
  }
  // Before the player starts, "needs a name" is not worth shouting about.
  const started = draft.name !== '' || draft.entries.length > 0
  const shown = [...errors, ...(started ? problems : [])]

  return (
    <div className="pc-screen-body pc-builder">
      <div className="pc-builder-cols">
        <DetailsColumn draft={draft} onChange={onChange} />
        <PokemonColumn
          entries={draft.entries}
          form={form}
          onFormChange={setForm}
          onOpen={(entry) => {
            setEditingId(entry?.id ?? null)
            setForm(
              entry ? { ...entry, species: entry.species.label } : EMPTY_FORM
            )
          }}
          onRemove={(entry) =>
            onChange({
              ...draft,
              entries: draft.entries.filter((other) => other !== entry),
            })
          }
        />
      </div>
      {shown.length > 0 && (
        <ul className="pc-problems" role="alert">
          {shown.slice(0, 3).map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
          {shown.length > 3 && <li>…and {shown.length - 3} more.</li>}
        </ul>
      )}
      {form ? (
        <footer className="pc-builder-actions">
          <button type="button" className="pc-reset" onClick={closeForm}>
            Cancel
          </button>
          <button
            type="button"
            className="pc-apply"
            disabled={!species}
            onClick={saveEntry}
          >
            {editingId ? 'Save Pokémon' : 'Add Pokémon'}
          </button>
        </footer>
      ) : (
        <footer className="pc-builder-actions">
          <button type="button" className="pc-reset" onClick={onCancel}>
            Cancel
          </button>
          <span className="pc-builder-secondary">
            <button type="button" className="pc-secondary" disabled>
              Import from spreadsheet · Coming later
            </button>
            <button
              type="button"
              className="pc-apply"
              disabled={problems.length > 0}
              onClick={() => {
                const definition = toDefinition(draft)
                void onCreate(
                  new File(
                    [JSON.stringify(definition, null, 2)],
                    `${definition.id}.json`,
                    { type: 'application/json' }
                  )
                )
              }}
            >
              Create collection
            </button>
          </span>
        </footer>
      )}
    </div>
  )
}
