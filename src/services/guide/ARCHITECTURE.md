# Guide service

`guide`, the app's `GuideService` instance, owns the selected ROM's reference
data. Game selection starts initialization immediately, independently of the
save adapter. Hub, Camp, and Lab navigation keep the same instance and dataset.

```ts
void guide.select(gameId, provider)
const unsubscribe = guide.subscribe(render)
const state = guide.getSnapshot()
const species = guide.getSpecies(25)
const family = guide.getEvolutionFamilyEdges(25)
const [egg] = guide.getEggMoves(25)
const fathers = egg
  ? guide.getEggMoveFathers(egg.move.romId, egg.hatchedAs)
  : []
const obtaining = guide.getAcquisitionRoutes(25)
```

`select` is idempotent for the same game, provider, and metadata. It shares an
unfinished initialization and retains the completed dataset. Query methods do
no storage reads, hashing, parsing, or cloning. Published data is frozen so
consumers can share it safely. React views use `useGuide` to subscribe; opening
a view never starts extraction.

On selection, the service reads the ROM and `saves/{gameId}/pokedex.json` in
parallel. It validates the sidecar against the ROM hash, schema version,
extractor version, game, and metadata fingerprint. A valid sidecar is restored;
otherwise the pure extractor runs in a worker. Data becomes ready before the
sidecar write completes. A failed write adds a warning while keeping data usable.

A different game, provider, metadata selection, or ROM replacement invalidates
the old work and aborts its worker. Successful ROM writes and removals publish
storage change events; GuideService automatically reloads or clears its data.
Errors and unsupported layouts are distinct states. `refresh` explicitly
retries initialization. `clear` releases the selected dataset.

Arcade uses a separate document because the threaded emulator requires cross
origin isolation. It initializes GuideService when storage is ready, alongside
ROM loading, and restores the saved sidecar. JavaScript instances do not survive
a full document navigation or browser reload. The Arcade Guide subscribes to
that initialized instance and does not load data when opened. The worker entry
is under `arcade/` in development and `arcade/workers/` in production so the
isolation service worker supplies the required response headers.

`extractor.ts`, `rom.ts`, `vanilla.ts`, and `worker.ts` have no React, storage,
or i18n dependencies. The worker receives ROM bytes and returns structured data.
Move and evolution labels are rendered by the existing i18n service.

The Lab PC keeps its collection requirements and matches in its original three
columns. Its Species Data tab uses a separate, scrollable detail view in the
same screen and labels the reference game.

## Reference extraction and derived information

The optional table readers use the HMA pointer sources (or named TOML anchors)
for egg move streams, TM/HM dictionaries and compatibility masks, map banks,
map names, and ordinary wild encounter headers. Missing or damaged tables have
explicit capability states; they do not turn into verified empty results.

`pokedex.ts` reads the Pokédex entry table (category, page text, height in
decimetres, weight in hectograms), the regional Dex number (Hoenn order table,
or National 1-151 for FR/LG), and the item table, whose names label wild held
items from the base-stats row. The same row supplies base friendship, growth
rate, Safari flee rate and color. All of it is cached in the sidecar; views do
not show it yet. `learnsets.ts` also reads move tutors (15 in FR/LG, 30 in
Emerald; Ruby/Sapphire have none) from their list and per-species bitmask.
Warnings mean the ROM failed to yield data; features not extracted yet are
not warnings. `hasReadFailures` drives the Species Data banner on the PC and
in the Arcade; it ignores `storage-unavailable`, which is a save failure. In-game trades have one table per game; gifts, static
encounters, fossils and egg gifts live only in event scripts and are not read.

Evolution families include every branch and predecessor, ordered from the
base or baby stage. `getEggMoves` follows predecessor links so evolved species
also show inherited egg moves. `getEggMoveFathers` combines ROM learnsets,
gender ratios, Egg Groups, retained pre-evolution moves, and the first breedable
stage of baby families to list compatible fathers. TM/HM entries retain their
machine kind and number alongside the ROM move ID.

Wild encounters retain the map ID and ROM map name, method, level range, slot
probability, activation rate, and conditional alternate tables. Slot weights
are grouped separately for grass/cave, Surf, Rock Smash, Old Rod, Good Rod, and
Super Rod. Probabilities are fractions conditional on an encounter, not the
chance of activating one. Location indexes deduplicate National Dex numbers.

`getAcquisitionRoutes` prefers known wild sources, then follows evolution and
breeding steps to the selected species. If no wild source is known, it returns
direct evolution or breeding methods with an explicitly unknown source location.
Breeding uses parsed egg groups and gender ratios; Gen III incense requirements,
Ditto requirements, and the Nidoran/Volbeat/Illumise offspring rules are retained.
Cycles and ambiguous breeding roots are bounded rather than guessed.

Arcade and the PC use shared reference components for linked family lines,
move-category tabs, and encounter-type location tabs. Species mentioned in
evolution, breeding, and acquisition details can be opened in place.

Gift, stationary, roaming, and other encounters generated by special engine
logic are not inferred from ordinary wild tables. ROM flavor text, tutor moves,
and item encounter details remain outside the extracted data in this version.
Extractor version 0.3.0 invalidates older sidecars so these tables are generated
once when the ROM is next selected.
