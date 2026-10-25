import { formatNumber } from '../../../services/i18n/format'
import { collectionDisplay } from './collectionDisplay'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { useStorageProvider } from '../useStorage'
import { BUILT_IN_COLLECTIONS } from './builtInCollections'
import { registeredCount, type CollectionDefinition } from './collectionTypes'
import { useLabData } from './useLabData'

interface Progress {
  registered: number
  total: number
}

/**
 * The Lab's collection data in active storage, as a table: uploaded
 * collections can be deleted; built-ins stay, but their saved history can be
 * cleared. Deleting everything sits apart, in its own danger row.
 */
export function LabCollectionData({ offline }: { offline: boolean }) {
  const { t } = useTranslation(['collections', 'common'] as const)

  const { provider } = useStorageProvider()
  const { ready, uploads, errors, remove, clearHistory, removeAll } =
    useLabData()
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Missing while loading, or when the stored result can't be read.
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  // Bumped after a change so the Registered column reloads.
  const [changes, setChanges] = useState(0)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const definitions = [...BUILT_IN_COLLECTIONS, ...uploads]
    void Promise.all(
      definitions.map(async (definition) => {
        try {
          const result = await provider.getCollectionResult(definition.id)
          // Never scanned, or cleared: nothing registered yet.
          const total = Object.keys(definition.pokemon).length
          return [
            definition.id,
            result
              ? { registered: registeredCount(result), total: result.total }
              : { registered: 0, total },
          ] as const
        } catch {
          return null
        }
      })
    ).then((entries) => {
      if (!cancelled)
        setProgress(
          Object.fromEntries(entries.filter((entry) => entry !== null))
        )
    })
    return () => {
      cancelled = true
    }
  }, [provider, ready, uploads, changes])

  const run = async (action: () => Promise<boolean>, done: string) => {
    setBusy(true)
    setMessage(null)
    try {
      if (await action()) {
        setMessage(done)
        setChanges((count) => count + 1)
      }
    } finally {
      setBusy(false)
    }
  }
  const row = (definition: CollectionDefinition, uploaded: boolean) => {
    const name = collectionDisplay(definition).name
    const counts = progress[definition.id]
    return (
      <tr key={definition.id}>
        <th scope="row">{name}</th>
        <td className="lab-data-type">
          {uploaded
            ? t('LabCollectionData.uploaded')
            : t('LabCollectionData.builtIn')}
        </td>
        <td className="lab-data-progress">
          {counts
            ? t('common:format.progress', {
                completed: formatNumber(counts.registered),
                total: formatNumber(counts.total),
              })
            : '—'}
        </td>
        <td className="lab-data-action">
          <button
            type="button"
            className="lab-data-action-btn"
            disabled={busy || offline}
            onClick={() =>
              void (uploaded
                ? run(
                    () => remove(definition),
                    t('LabCollectionData.deleted', { name })
                  )
                : run(
                    () => clearHistory(definition),
                    t('LabCollectionData.historyCleared', { name })
                  ))
            }
          >
            {uploaded
              ? t('common:actions.delete')
              : t('LabCollectionData.clearHistory')}
          </button>
        </td>
      </tr>
    )
  }

  return (
    <>
      <section
        className="lab-collections-module lab-settings-module"
        aria-labelledby="lab-collections-title"
      >
        <h3 id="lab-collections-title">
          {t('LabCollectionData.pokeDexCollections')}
        </h3>
        {ready ? (
          // Scrolls sideways only if long uploaded names outgrow the module.
          <div className="lab-data-scroll">
            <table className="lab-data-table">
              <thead>
                <tr>
                  <th scope="col">{t('LabCollectionData.collection')}</th>
                  <th scope="col" className="lab-data-type">
                    {t('LabCollectionData.type')}
                  </th>
                  <th scope="col">{t('LabCollectionData.registered')}</th>
                  <th scope="col">
                    <span className="lab-visually-hidden">
                      {t('LabCollectionData.actions')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {BUILT_IN_COLLECTIONS.map((definition) =>
                  row(definition, false)
                )}
                {uploads.map((definition) => row(definition, true))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="lab-note">
            {t('LabCollectionData.loadingCollections')}
          </p>
        )}
        {errors.length > 0 && (
          <div className="lab-warning" role="alert">
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        {message && (
          <p className="lab-data-message" role="status">
            {message}
          </p>
        )}
      </section>
      <div className="lab-danger-zone">
        <p>{t('LabCollectionData.deleteAllHelp')}</p>
        <button
          type="button"
          className="lab-danger-btn"
          disabled={!ready || busy || offline}
          onClick={() =>
            void run(removeAll, t('LabCollectionData.allCollectionDataDeleted'))
          }
        >
          {t('LabCollectionData.deleteAllCollections')}
        </button>
      </div>
    </>
  )
}
