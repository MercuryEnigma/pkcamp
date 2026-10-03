import type { GameId } from "./types";

/** `previousSave` holds the save that the most recent `updateSave` replaced. */
export type ByteKind = "save" | "previousSave" | "rom";

/**
 * Internal storage seam. `SaveLibrary` (the public API) is implemented in
 * terms of this narrower interface so a future backend — e.g. one backed by
 * Dropbox — can be swapped in without changing the public API in `types.ts`
 * or the calling code in `library.ts`.
 *
 * This seam intentionally knows nothing about "current save" vs "history" as
 * separate concepts beyond raw byte + log storage: it is deliberately dumb,
 * synchronous key/value + log storage. All audit-log semantics (what a log
 * line reads like, ordering guarantees) live in `library.ts`.
 */
export interface SaveLibraryBackend {
  /** Resolves once any durable state has been loaded into the read cache. */
  whenReady(): Promise<void>;

  readBytes(gameId: GameId, kind: ByteKind): Uint8Array | null;
  writeBytes(gameId: GameId, kind: ByteKind, bytes: Uint8Array): void;
  clearBytes(gameId: GameId, kind: ByteKind): void;

  appendHistory(gameId: GameId, entry: string): void;
  readHistory(gameId: GameId): string[];
}

/**
 * A real, working in-memory backend. Not a test mock — this is a legitimate
 * proof-of-concept persistence layer for the current pass, since Dropbox
 * (and any other durable backend) is out of scope for now. Data lives only
 * for the lifetime of the JS heap holding an instance.
 */
export class InMemorySaveLibraryBackend implements SaveLibraryBackend {
  private readonly stores: Record<ByteKind, Map<GameId, Uint8Array>> = {
    save: new Map(),
    previousSave: new Map(),
    rom: new Map(),
  };
  private readonly history = new Map<GameId, string[]>();

  private store(kind: ByteKind): Map<GameId, Uint8Array> {
    return this.stores[kind];
  }

  whenReady(): Promise<void> {
    return Promise.resolve();
  }

  readBytes(gameId: GameId, kind: ByteKind): Uint8Array | null {
    return this.store(kind).get(gameId) ?? null;
  }

  writeBytes(gameId: GameId, kind: ByteKind, bytes: Uint8Array): void {
    // Copy defensively so a caller mutating their source array afterward
    // cannot silently corrupt what the library holds.
    this.store(kind).set(gameId, bytes.slice());
  }

  clearBytes(gameId: GameId, kind: ByteKind): void {
    this.store(kind).delete(gameId);
  }

  appendHistory(gameId: GameId, entry: string): void {
    const existing = this.history.get(gameId);
    if (existing) {
      existing.push(entry);
    } else {
      this.history.set(gameId, [entry]);
    }
  }

  readHistory(gameId: GameId): string[] {
    // Return a copy so callers cannot mutate the internal log.
    return [...(this.history.get(gameId) ?? [])];
  }
}
