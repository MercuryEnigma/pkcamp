import type { Generation } from '../saveLibrary'
import type { LocalPokemonLibrary, StoredPokemonFile } from './types'

const DB_VERSION = 2
const POKEMON_STORE = 'pokemon'
export const LOCAL_POKEMON_SLOT_COUNT = 30

function databaseName(generation: Generation): string {
  return `pkcamp-pokemon-gen-${generation}`
}

function requireIndexedDb(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new Error('Local Pokémon storage is not supported by this browser.')
  }
  return indexedDB
}

function openDatabase(generation: Generation): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = requireIndexedDb().open(
      databaseName(generation),
      DB_VERSION
    )

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(POKEMON_STORE)) {
        database.createObjectStore(POKEMON_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        request.error ?? new Error('Unable to open local Pokémon storage.')
      )
    request.onblocked = () =>
      reject(new Error('Local Pokémon storage is blocked by another tab.'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        request.error ?? new Error('Local Pokémon storage request failed.')
      )
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error('Local Pokémon storage transaction failed.')
      )
    transaction.onabort = () =>
      reject(
        transaction.error ??
          new Error('Local Pokémon storage transaction was aborted.')
      )
  })
}

function copyRecord(record: StoredPokemonFile): StoredPokemonFile {
  return {
    ...record,
    bytes: new Uint8Array(record.bytes).slice(),
  }
}

function recordsToSlots(
  records: readonly StoredPokemonFile[]
): (StoredPokemonFile | null)[] {
  const highestStoredSlot = records.reduce(
    (highest, record) =>
      Number.isInteger(record.slot) && record.slot >= 0
        ? Math.max(highest, record.slot)
        : highest,
    -1
  )
  const requiredSlots = Math.max(records.length, highestStoredSlot + 1)
  const capacity = Math.max(
    LOCAL_POKEMON_SLOT_COUNT,
    Math.ceil(requiredSlots / LOCAL_POKEMON_SLOT_COUNT) *
      LOCAL_POKEMON_SLOT_COUNT
  )
  const slots = new Array<StoredPokemonFile | null>(capacity).fill(null)
  const unplaced: StoredPokemonFile[] = []
  const sorted = [...records].sort((left, right) =>
    left.importedAt.localeCompare(right.importedAt)
  )

  for (const record of sorted) {
    if (
      Number.isInteger(record.slot) &&
      record.slot >= 0 &&
      record.slot < capacity &&
      slots[record.slot] === null
    ) {
      slots[record.slot] = copyRecord(record)
    } else {
      // Version-1 records had no slot. Preserve them in import order by
      // assigning the first available positions in the new fixed grid.
      unplaced.push(record)
    }
  }

  for (const record of unplaced) {
    const slot = slots.indexOf(null)
    if (slot < 0) break
    slots[slot] = { ...copyRecord(record), slot }
  }
  return slots
}

function newId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export class IndexedDbLocalPokemonLibrary implements LocalPokemonLibrary {
  async getSlots(
    generation: Generation
  ): Promise<(StoredPokemonFile | null)[]> {
    const database = await openDatabase(generation)
    try {
      const transaction = database.transaction(POKEMON_STORE, 'readonly')
      const completed = transactionComplete(transaction)
      const records = await requestResult(
        transaction.objectStore(POKEMON_STORE).getAll() as IDBRequest<
          StoredPokemonFile[]
        >
      )
      await completed
      return recordsToSlots(records)
    } finally {
      database.close()
    }
  }

  async saveSlots(
    generation: Generation,
    slots: readonly (StoredPokemonFile | null)[]
  ): Promise<void> {
    if (
      slots.length < LOCAL_POKEMON_SLOT_COUNT ||
      slots.length % LOCAL_POKEMON_SLOT_COUNT !== 0
    ) {
      throw new RangeError(
        `Local Pokémon storage requires a positive multiple of ${LOCAL_POKEMON_SLOT_COUNT} slots.`
      )
    }
    const ids = new Set<string>()
    const records = slots.flatMap((record, slot) => {
      if (record === null) return []
      if (ids.has(record.id)) {
        throw new Error(`Duplicate Local Pokémon id ${record.id}.`)
      }
      ids.add(record.id)
      return [{ ...copyRecord(record), slot }]
    })

    const database = await openDatabase(generation)
    try {
      const transaction = database.transaction(POKEMON_STORE, 'readwrite')
      const completed = transactionComplete(transaction)
      const store = transaction.objectStore(POKEMON_STORE)
      store.clear()
      for (const record of records) store.put(record)
      await completed
    } finally {
      database.close()
    }
  }

  async list(generation: Generation): Promise<StoredPokemonFile[]> {
    return (await this.getSlots(generation)).filter(
      (record): record is StoredPokemonFile => record !== null
    )
  }

  async get(
    generation: Generation,
    id: string
  ): Promise<StoredPokemonFile | null> {
    return (
      (await this.getSlots(generation)).find((record) => record?.id === id) ??
      null
    )
  }

  async add(
    generation: Generation,
    file: { fileName: string; bytes: Uint8Array }
  ): Promise<StoredPokemonFile> {
    const slot = (await this.getSlots(generation)).indexOf(null)
    if (slot < 0) throw new Error('Local Pokémon storage is full.')
    const record: StoredPokemonFile = {
      id: newId(),
      slot,
      fileName: file.fileName,
      bytes: file.bytes.slice(),
      importedAt: new Date().toISOString(),
    }

    const database = await openDatabase(generation)
    try {
      const transaction = database.transaction(POKEMON_STORE, 'readwrite')
      const completed = transactionComplete(transaction)
      transaction.objectStore(POKEMON_STORE).add(record)
      await completed
      return copyRecord(record)
    } finally {
      database.close()
    }
  }

  async discard(generation: Generation, id: string): Promise<void> {
    const database = await openDatabase(generation)
    try {
      const transaction = database.transaction(POKEMON_STORE, 'readwrite')
      const completed = transactionComplete(transaction)
      transaction.objectStore(POKEMON_STORE).delete(id)
      await completed
    } finally {
      database.close()
    }
  }
}
