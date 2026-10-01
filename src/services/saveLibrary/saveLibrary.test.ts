import { describe, expect, it } from "vitest";
import { InMemorySaveLibrary } from "./library";
import type { SaveLibrary } from "./types";

function makeLibrary(): SaveLibrary {
  return new InMemorySaveLibrary();
}

describe("SaveLibrary", () => {
  it("lists the recognized roster for a generation", () => {
    const library = makeLibrary();

    expect(library.listGames(3)).toEqual([
      "ruby",
      "sapphire",
      "emerald",
      "firered",
      "leafgreen",
    ]);
    expect(library.listGames(9)).toEqual(["scarlet", "violet"]);
  });

  it("round-trips a save through update/get/discard", () => {
    const library = makeLibrary();
    const bytes = new Uint8Array([1, 2, 3, 4]);

    expect(library.getSave("ruby")).toBeNull();

    library.updateSave("ruby", bytes);
    expect(library.getSave("ruby")).toEqual(bytes);

    library.discardSave("ruby");
    expect(library.getSave("ruby")).toBeNull();
  });

  it("reports when the current save was last updated", () => {
    const library = makeLibrary();

    expect(library.getSaveUpdatedAt("ruby")).toBeNull();

    const beforeUpdate = Date.now();
    library.updateSave("ruby", new Uint8Array([1]));
    const updatedAt = library.getSaveUpdatedAt("ruby");

    expect(updatedAt).not.toBeNull();
    expect(updatedAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate);

    library.discardSave("ruby");
    expect(library.getSaveUpdatedAt("ruby")).toBeNull();
  });

  it("appends a human-readable, most-recent-last audit entry per mutation", () => {
    const library = makeLibrary();

    expect(library.listHistory("scarlet")).toEqual([]);

    library.updateSave("scarlet", new Uint8Array([9]));
    library.discardSave("scarlet");

    const history = library.listHistory("scarlet");
    expect(history).toHaveLength(2);
    expect(history[0]).toMatch(/^scarlet: save updated, \d{4}-\d{2}-\d{2}T/);
    expect(history[1]).toMatch(/^scarlet: save discarded, \d{4}-\d{2}-\d{2}T/);
  });

  it("combines save and rom bytes via getGame", () => {
    const library = makeLibrary();
    const sav = new Uint8Array([5, 6]);
    const rom = new Uint8Array([7, 8]);

    expect(library.getGame("firered")).toEqual({ save: null, rom: null });

    library.updateSave("firered", sav);
    library.updateRom("firered", rom);

    expect(library.getGame("firered")).toEqual({ save: sav, rom: rom });
  });
});
