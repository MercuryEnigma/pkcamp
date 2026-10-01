import type { SaveLibraryBackend } from "./backend";
import type { GameId } from "./types";

const DB_NAME = "pkcamp-save-library";
const DB_VERSION = 1;
const BYTES_STORE = "bytes";
const HISTORY_STORE = "history";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BYTES_STORE)) db.createObjectStore(BYTES_STORE);
      if (!db.objectStoreNames.contains(HISTORY_STORE)) db.createObjectStore(HISTORY_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function byteKey(gameId: GameId, kind: "save" | "rom"): string {
  return `${gameId}:${kind}`;
}

/**
 * IndexedDB-backed implementation of the `SaveLibraryBackend` seam
 * (backend.ts) — an internal implementation detail behind the already-
 * approved boundary, not a change to it.
 *
 * `SaveLibraryBackend` itself is synchronous, but IndexedDB is inherently
 * async. This reconciles the two with a write-through in-memory cache: every
 * read/write completes synchronously against the cache (satisfying the
 * interface), while every write also durably persists to IndexedDB in the
 * background. On construction, the cache is hydrated from IndexedDB
 * asynchronously and best-effort; a read that races hydration simply sees
 * nothing yet, same as a truly empty library — there is no synchronous way
 * around that given the interface this must satisfy.
 *
 * Safe to construct outside a browser (e.g. under vitest/Node, which has no
 * `indexedDB` global): it degrades to in-memory-only behavior rather than
 * throwing.
 */
export class IndexedDbSaveLibraryBackend implements SaveLibraryBackend {
  private readonly bytesCache = new Map<string, Uint8Array>();
  private readonly historyCache = new Map<GameId, string[]>();
  private readonly hydration: Promise<void>;

  constructor() {
    this.hydration = this.hydrate();
  }

  whenReady(): Promise<void> {
    return this.hydration;
  }

  private async hydrate(): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    try {
      const db = await openDb();
      await Promise.all([
        this.hydrateStore(db, BYTES_STORE, this.bytesCache),
        this.hydrateStore(db, HISTORY_STORE, this.historyCache as Map<string, unknown>),
      ]);
      db.close();
    } catch (error) {
      console.error("IndexedDbSaveLibraryBackend: hydration failed", error);
    }
  }

  private hydrateStore(
    db: IDBDatabase,
    storeName: string,
    cache: Map<string, unknown>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = db.transaction(storeName, "readonly").objectStore(storeName).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        cache.set(cursor.key as string, cursor.value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private persist(storeName: string, key: string, value: unknown): void {
    if (typeof indexedDB === "undefined") return;
    openDb()
      .then((db) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      })
      .catch((error) => console.error("IndexedDbSaveLibraryBackend: persist failed", error));
  }

  private deletePersisted(storeName: string, key: string): void {
    if (typeof indexedDB === "undefined") return;
    openDb()
      .then((db) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      })
      .catch((error) => console.error("IndexedDbSaveLibraryBackend: delete failed", error));
  }

  readBytes(gameId: GameId, kind: "save" | "rom"): Uint8Array | null {
    return this.bytesCache.get(byteKey(gameId, kind)) ?? null;
  }

  writeBytes(gameId: GameId, kind: "save" | "rom", bytes: Uint8Array): void {
    const copy = bytes.slice();
    const key = byteKey(gameId, kind);
    this.bytesCache.set(key, copy);
    this.persist(BYTES_STORE, key, copy);
  }

  clearBytes(gameId: GameId, kind: "save" | "rom"): void {
    const key = byteKey(gameId, kind);
    this.bytesCache.delete(key);
    this.deletePersisted(BYTES_STORE, key);
  }

  appendHistory(gameId: GameId, entry: string): void {
    const updated = [...(this.historyCache.get(gameId) ?? []), entry];
    this.historyCache.set(gameId, updated);
    this.persist(HISTORY_STORE, gameId, updated);
  }

  readHistory(gameId: GameId): string[] {
    return [...(this.historyCache.get(gameId) ?? [])];
  }
}
