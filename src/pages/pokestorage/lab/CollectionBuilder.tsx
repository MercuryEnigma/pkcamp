import { useTranslation } from 'react-i18next'
import { i18n } from '../../../services/i18n'
import { useState, type ReactNode } from 'react'
import {
  getSpeciesOptions,
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

const getSpeciesLabels = () => getSpeciesOptions().map((option) => option.label)
const getShiny = (): readonly [ShinyRule, string][] => [
  ['any', i18n.t('collections:CollectionBuilder.any')],
  ['yes', i18n.t('collections:CollectionBuilder.shiny')],
  ['no', i18n.t('collections:CollectionBuilder.notShiny')],
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
  getSpeciesOptions().find(
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
  const { t } = useTranslation(['collections', 'common'] as const)

  const text = (key: keyof Omit<CollectionDraft, 'entries'>) => ({
    value: draft[key],
    onChange: (event: { target: { value: string } }) =>
      onChange({ ...draft, [key]: event.target.value }),
  })
  return (
    <section
      className="pc-builder-col pc-form"
      aria-label={t('CollectionBuilder.collectionDetails')}
    >
      <Field label={t('CollectionBuilder.name')} className="pc-span-2">
        <input {...text('name')} />
      </Field>
      <Field label={t('CollectionBuilder.description')} className="pc-span-2">
        <textarea rows={3} {...text('description')} />
      </Field>
      <Field label={t('CollectionBuilder.author')}>
        <input {...text('author')} />
      </Field>
      <Field label={t('CollectionBuilder.source')}>
        <input {...text('source')} />
      </Field>
      <Field label={t('CollectionBuilder.details')}>
        <textarea rows={2} {...text('details')} />
      </Field>
      <Field label={t('CollectionBuilder.updated')}>
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
  const { t } = useTranslation(['collections', 'common'] as const)

  // Ribbon text being typed; a full name moves into the chosen ribbons.
  const [ribbon, setRibbon] = useState('')
  const set = (change: Partial<EntryForm>) => onChange({ ...form, ...change })

  return (
    <div className="pc-entry-form">
      <Field label={t('CollectionBuilder.species')} className="pc-span-6">
        <PcCombobox
          label={t('CollectionBuilder.species2')}
          placeholder={t('CollectionBuilder.selectAPokeMon')}
          value={form.species}
          options={getSpeciesLabels()}
          onChange={(value) => set({ species: value })}
        />
      </Field>
      <div className="pc-field pc-span-3">
        <span className="pc-label">{t('CollectionBuilder.shiny')}</span>
        <div
          className="pc-segment"
          role="group"
          aria-label={t('CollectionBuilder.shiny')}
        >
          {getShiny().map(([value, label]) => (
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
        <span className="pc-label">
          {t('CollectionBuilder.ribbonsAllRequired')}
        </span>
        <PcCombobox
          label={t('CollectionBuilder.ribbons')}
          placeholder={t('CollectionBuilder.addARibbon')}
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
                aria-label={t('CollectionBuilder.remove', { name: name })}
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
      <Field label={t('CollectionBuilder.nature')} className="pc-span-2">
        <PcCombobox
          label={t('CollectionBuilder.nature')}
          placeholder={t('CollectionBuilder.any')}
          value={form.nature}
          options={NATURES}
          onChange={(value) => set({ nature: value })}
        />
      </Field>
      <Field label={t('CollectionBuilder.ability')} className="pc-span-2">
        <input
          placeholder={t('CollectionBuilder.any')}
          value={form.ability}
          onChange={(event) => set({ ability: event.target.value })}
        />
      </Field>
      <Field label={t('CollectionBuilder.move')} className="pc-span-2">
        <input
          placeholder={t('CollectionBuilder.any')}
          value={form.move}
          onChange={(event) => set({ move: event.target.value })}
        />
      </Field>
      <Field label={t('CollectionBuilder.ot')} className="pc-span-3">
        <input
          placeholder={t('CollectionBuilder.any')}
          value={form.ot}
          onChange={(event) => set({ ot: event.target.value })}
        />
      </Field>
      <Field label={t('CollectionBuilder.id')} className="pc-span-3">
        <input
          inputMode="numeric"
          placeholder={t('CollectionBuilder.any')}
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
  const { t } = useTranslation(['collections', 'common'] as const)

  return (
    <section
      className="pc-builder-col"
      aria-label={t('CollectionBuilder.pokeMon')}
    >
      <header className="pc-builder-head">
        <h3 className="pc-label">{t('CollectionBuilder.pokeMon')}</h3>
        <span className="pc-count-badge">
          {t('CollectionBuilder.added', { length: entries.length })}
        </span>
      </header>
      {!form && (
        <button
          type="button"
          className="pc-secondary pc-add-pokemon"
          onClick={() => onOpen(null)}
        >
          {t('CollectionBuilder.addPokeMon')}
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
                    <span className="pc-muted">
                      {t('CollectionBuilder.any')}
                    </span>
                  )}
                </td>
                <td className="pc-table-actions">
                  <button
                    type="button"
                    className="pc-link-btn"
                    onClick={() => onOpen(entry)}
                  >
                    {t('CollectionBuilder.edit')}
                  </button>
                  <button
                    type="button"
                    className="pc-link-btn"
                    onClick={() => onRemove(entry)}
                  >
                    {t('common:actions.remove')}
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
  const { t } = useTranslation(['collections', 'common'] as const)

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
          {shown.length > 3 && (
            <li>
              {t('CollectionBuilder.andMore', { value1: shown.length - 3 })}
            </li>
          )}
        </ul>
      )}
      {form ? (
        <footer className="pc-builder-actions">
          <button type="button" className="pc-reset" onClick={closeForm}>
            {t('common:actions.cancel')}
          </button>
          <button
            type="button"
            className="pc-apply"
            disabled={!species}
            onClick={saveEntry}
          >
            {editingId
              ? t('CollectionBuilder.savePokeMon')
              : t('CollectionBuilder.addPokeMon2')}
          </button>
        </footer>
      ) : (
        <footer className="pc-builder-actions">
          <button type="button" className="pc-reset" onClick={onCancel}>
            {t('common:actions.cancel')}
          </button>
          <span className="pc-builder-secondary">
            <button type="button" className="pc-secondary" disabled>
              {t('CollectionBuilder.importFromSpreadsheetComingLater')}
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
              {t('CollectionBuilder.createCollection')}
            </button>
          </span>
        </footer>
      )}
    </div>
  )
}
