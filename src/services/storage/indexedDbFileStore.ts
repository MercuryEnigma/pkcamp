import { i18n } from '../i18n'
import {
  childrenOf,
  type FileStore,
  type FileStoreEntry,
  type StoredFile,
} from './fileStore'

const DB_NAME = 'pkcamp-storage'
const DB_VERSION = 1
const FILES_STORE = 'files'

interface FileRecord {
  bytes: Uint8Array
  modified: string
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        request.error ??
          new Error(
            i18n.t('services:indexedDbFileStore.localStorageRequestFailed')
          )
      )
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error(
            i18n.t('services:indexedDbFileStore.localStorageWriteFailed')
          )
      )
    transaction.onabort = () =>
      reject(
        transaction.error ??
          new Error(
            i18n.t('services:indexedDbFileStore.localStorageWriteWasAborted')
          )
      )
  })
}

/** Keys inside `folder` (exclusive of the folder path itself). */
function folderRange(folder: string): IDBKeyRange | undefined {
  if (folder === '') return undefined
  return IDBKeyRange.bound(`${folder}/`, `${folder}/￿`)
}

/**
 * Browser-local `FileStore`: one IndexedDB object store keyed by file path,
 * so local data uses the same layout as a cloud provider.
 */
export class IndexedDbFileStore implements FileStore {
  private database: Promise<IDBDatabase> | null = null

  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(FILES_STORE)) {
          request.result.createObjectStore(FILES_STORE)
        }
      }
      request.onsuccess = () => {
        const database = request.result
        // Let a newer tab upgrade the schema; the next call reopens.
        database.onversionchange = () => {
          database.close()
          this.database = null
        }
        resolve(database)
      }
      request.onerror = () =>
        reject(
          request.error ??
            new Error(
              i18n.t('services:indexedDbFileStore.unableToOpenLocalStorage')
            )
        )
      request.onblocked = () =>
        reject(
          new Error(
            i18n.t(
              'services:indexedDbFileStore.localStorageIsBlockedByAnotherTab'
            )
          )
        )
    }).catch((error: unknown) => {
      this.database = null
      throw error
    })
    return this.database
  }

  async read(path: string): Promise<StoredFile | null> {
    const database = await this.open()
    const record = (await requestResult(
      database
        .transaction(FILES_STORE, 'readonly')
        .objectStore(FILES_STORE)
        .get(path)
    )) as FileRecord | undefined
    if (!record) return null
    return {
      bytes: new Uint8Array(record.bytes).slice(),
      modified: new Date(record.modified),
    }
  }

  async write(
    path: string,
    bytes: Uint8Array,
    modified = new Date()
  ): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction(FILES_STORE, 'readwrite')
    const completed = transactionComplete(transaction)
    const record: FileRecord = {
      bytes: bytes.slice(),
      modified: modified.toISOString(),
    }
    transaction.objectStore(FILES_STORE).put(record, path)
    await completed
  }

  async delete(path: string): Promise<void> {
    const database = await this.open()
    const transaction = database.transaction(FILES_STORE, 'readwrite')
    const completed = transactionComplete(transaction)
    const store = transaction.objectStore(FILES_STORE)
    store.delete(path)
    const range = folderRange(path)
    if (range) store.delete(range)
    await completed
  }

  async list(folder: string): Promise<FileStoreEntry[]> {
    const database = await this.open()
    const keys = await requestResult(
      database
        .transaction(FILES_STORE, 'readonly')
        .objectStore(FILES_STORE)
        .getAllKeys(folderRange(folder))
    )
    return childrenOf(keys as string[], folder)
  }
}
