import { collectionDisplay } from './collectionDisplay'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { BUILT_IN_COLLECTIONS } from './builtInCollections'
import type { CollectionDefinition } from './collectionTypes'
import { useLabData } from './useLabData'

/**
 * The Lab's collection data in active storage: uploaded collections can be
 * deleted; built-ins stay, but their saved history can be cleared.
 */
export function LabCollectionData({ offline }: { offline: boolean }) {
  const { t } = useTranslation(['collections', 'common'] as const)

  const { ready, uploads, errors, remove, clearHistory, removeAll } =
    useLabData()
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<boolean>, done: string) => {
    setBusy(true)
    setMessage(null)
    try {
      if (await action()) setMessage(done)
    } finally {
      setBusy(false)
    }
  }
  const row = (definition: CollectionDefinition, uploaded: boolean) => (
    <li className="lab-data-row" key={definition.id}>
      <span className="lab-data-name">
        {collectionDisplay(definition).name}
        <small>
          {uploaded
            ? t('LabCollectionData.uploaded')
            : t('LabCollectionData.builtIn')}
        </small>
      </span>
      <button
        type="button"
        className="camp-text-btn camp-text-btn--danger"
        disabled={busy || offline}
        onClick={() =>
          void (uploaded
            ? run(
                () => remove(definition),
                t('LabCollectionData.deleted', {
                  name: collectionDisplay(definition).name,
                })
              )
            : run(
                () => clearHistory(definition),
                t('LabCollectionData.historyCleared', {
                  name: collectionDisplay(definition).name,
                })
              ))
        }
      >
        {uploaded
          ? t('common:actions.delete')
          : t('LabCollectionData.clearHistory')}
      </button>
    </li>
  )

  return (
    <div className="camp-cabin-card">
      <div className="camp-cabin-head">
        <strong className="camp-cabin-name">
          {t('LabCollectionData.pokeDexCollections')}
        </strong>
      </div>
      <p className="camp-cabin-status">
        {t(
          'LabCollectionData.collectionsAndTheirRegisteredHistoryAreKeptInTheActive'
        )}
      </p>
      {ready ? (
        <ul className="lab-data-list">
          {BUILT_IN_COLLECTIONS.map((definition) => row(definition, false))}
          {uploads.map((definition) => row(definition, true))}
        </ul>
      ) : (
        <p className="lab-note">{t('LabCollectionData.loadingCollections')}</p>
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
      {message && <p className="camp-status">{message}</p>}
      <div className="camp-cabin-footer">
        <button
          type="button"
          className="camp-text-btn camp-text-btn--danger"
          disabled={!ready || busy || offline}
          onClick={() =>
            void run(removeAll, t('LabCollectionData.allCollectionDataDeleted'))
          }
        >
          {t('LabCollectionData.deleteAllCollections')}
        </button>
      </div>
    </div>
  )
}
