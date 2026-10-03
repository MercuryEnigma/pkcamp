import type { GameId, GameSlotContents, Generation, SaveLibrary } from "./types";
import { ROSTER } from "./roster";
import { InMemorySaveLibraryBackend, type SaveLibraryBackend } from "./backend";
import { IndexedDbSaveLibraryBackend } from "./indexedDbBackend";

/**
 * SaveLibrary implementation. All persistence is delegated to a
 * `SaveLibraryBackend` (see `backend.ts`) so the storage mechanism can change
 * later without touching this class or the public `SaveLibrary` type.
 */
export class InMemorySaveLibrary implements SaveLibrary {
  private readonly backend: SaveLibraryBackend;

  constructor(backend: SaveLibraryBackend = new InMemorySaveLibraryBackend()) {
    this.backend = backend;
  }

  whenReady(): Promise<void> {
    return this.backend.whenReady();
  }

  listGames(generation: Generation): GameId[] {
    return [...ROSTER[generation]];
  }

  listHistory(gameId: GameId): string[] {
    return this.backend.readHistory(gameId);
  }

  getSave(gameId: GameId): Uint8Array | null {
    return this.backend.readBytes(gameId, "save");
  }

  getSaveUpdatedAt(gameId: GameId): Date | null {
    if (!this.getSave(gameId)) return null;

    const prefix = `${gameId}: save updated, `;
    const entry = this.listHistory(gameId)
      .reverse()
      .find((line) => line.startsWith(prefix));
    if (!entry) return null;

    const updatedAt = new Date(entry.slice(prefix.length));
    return Number.isNaN(updatedAt.getTime()) ? null : updatedAt;
  }

  getPreviousSave(gameId: GameId): Uint8Array | null {
    return this.backend.readBytes(gameId, "previousSave");
  }

  updateSave(gameId: GameId, sav: Uint8Array): void {
    const current = this.getSave(gameId);
    if (current) this.backend.writeBytes(gameId, "previousSave", current);
    this.backend.writeBytes(gameId, "save", sav);
    this.log(gameId, "save updated");
  }

  discardSave(gameId: GameId): void {
    this.backend.clearBytes(gameId, "save");
    this.log(gameId, "save discarded");
  }

  getRom(gameId: GameId): Uint8Array | null {
    return this.backend.readBytes(gameId, "rom");
  }

  updateRom(gameId: GameId, rom: Uint8Array): void {
    this.backend.writeBytes(gameId, "rom", rom);
    this.log(gameId, "rom updated");
  }

  discardRom(gameId: GameId): void {
    this.backend.clearBytes(gameId, "rom");
    this.log(gameId, "rom discarded");
  }

  getGame(gameId: GameId): GameSlotContents {
    return {
      save: this.getSave(gameId),
      rom: this.getRom(gameId),
    };
  }

  /**
   * Appends a human-readable audit-log entry for a mutation. This is an
   * audit trail only — there is deliberately no way to restore bytes from a
   * history entry (no `restoreHistory`/`activateSnapshot`). Entries are
   * appended in call order, so `listHistory` returns them most-recent-last.
   */
  private log(gameId: GameId, action: string): void {
    const timestamp = new Date().toISOString();
    this.backend.appendHistory(gameId, `${gameId}: ${action}, ${timestamp}`);
  }
}

/**
 * Shared default instance for application code, backed by IndexedDB so a
 * loaded save actually persists across reloads. Consumers that need an
 * isolated library (tests, or a future scoped session) should construct
 * `new InMemorySaveLibrary()` directly instead of using this singleton.
 */
export const saveLibrary: SaveLibrary = new InMemorySaveLibrary(new IndexedDbSaveLibraryBackend());
