# Gen III Pokédex Service

## Purpose

Create a shared, read-only TypeScript service that extracts Pokémon reference data from Ruby, Sapphire, Emerald, FireRed, LeafGreen, and compatible ROM hacks.

The Arcade Guide uses this data for species and location research. The Lab PC uses it to enrich collection entries with descriptions, stats, learnsets, evolution requirements, and encounter locations. Existing save and Camp scans remain responsible for ownership and collection progress.

## Extraction and data model

- Implement the parser under `src/services/pokedex`, independently of React, storage, and translation rendering.
- Use HexManiac Advance as the reference for ROM readers, pointers, text decoding, table definitions, discovery, and optional TOML metadata. Retain required license attribution for ported code and definitions.
- Identify supported ROM layouts using headers, revisions, and structural validation. Run extraction in a Web Worker.
- Extract identity, base stats, types, catch rate, experience, EV yields, abilities, breeding data, held items, learnsets, evolutions, Pokédex text, measurements, and wild encounters.
- Use **National Dex numbers as public species identifiers**. Convert ROM species references before publishing species, evolution, family, and location indexes.
- Retain ROM species IDs internally for parsing and diagnostics. Exclude species without a reliable National Dex mapping and return warnings. Do not fabricate mappings or overwrite conflicting entries.
- Preserve forms or variants separately within a National Dex entry when reliably identifiable; report ambiguous mappings.
- Store structured evolution methods and parameters, including referenced item and move IDs. Preserve unknown encodings for diagnostics and mark their descriptions unavailable.
- Preserve ROM move IDs with extracted names and optional verified standard move mappings.
- Calculate encounter probabilities from slot weights, grouped by map, species, method, and conditions. Distinguish slot probability from encounter activation rates.
- Represent unavailable data explicitly rather than as empty collections that imply verified absence.
- Persist species once. Store location indexes as deduplicated National Dex number lists; retain encounter details on species records.

## Public service and lifecycle

Expose these capabilities:

```ts
extract(rom, options?): Promise<PokedexDataset>
load(gameId, options?): Promise<PokedexDataset>
getSpecies(dataset, nationalDexNumber)
getEvolutionFamily(dataset, nationalDexNumber)
getEncounters(dataset, nationalDexNumber)
getLocation(dataset, mapId)
searchSpecies(dataset, query)
```

- `extract` accepts ROM bytes or a file and optional TOML metadata, without persisting results.
- `load` reads the selected game's ROM and sidecar through Storage Service, validates them, and extracts and persists when necessary.
- Lookup functions receive an explicit dataset so simultaneous consumers cannot accidentally read another game's information.
- Include schema version, extractor version, ROM SHA-256, metadata fingerprint, detected game details, capability availability, and structured warnings in each dataset.
- Share concurrent loads for the same ROM and metadata. Reject obsolete results when the selected game, ROM, metadata, or storage provider changes.
- Expose loading, ready, unsupported, and error states to consumers. Extraction failure must not prevent playing the ROM or browsing collections.

## Storage and localization

Persist the dataset at:

```text
saves/{gameId}/{gameId}.gba
saves/{gameId}/pokedex.json
```

- Add Pokédex read, write, and removal operations to the existing Storage Service, including provider and shared-load wrappers.
- Use the existing local and Dropbox backends; introduce no separate IndexedDB cache.
- Reuse a sidecar only when its schema, extractor version, ROM hash, and metadata fingerprint match. Re-extract obsolete or malformed data.
- Invalidate derived data when a ROM is replaced; remove its sidecar when the ROM is discarded.
- Keep successfully extracted data usable in memory if persistence fails, and expose the save failure.
- Keep this sidecar separate from collection scan results in `pokedex/{collectionId}.json`.

Extend the i18n service with move-name resolution and evolution-description formatting:

- Add English and Spanish catalogs for standard move IDs, evolution methods, and interpolated requirement descriptions.
- Resolve verified standard moves through translated catalogs. For custom or renamed moves, use extracted ROM names without assigning unrelated standard translations.
- Resolve item and move parameters into readable names inside evolution descriptions.
- Translate structured warnings and unavailable-data messages at display time.
- Store structured values rather than rendered translations. Language changes update both screens without re-extraction; ROM flavor text remains in its source language.

## Guide and Lab PC integration

- Replace the Arcade Guide placeholder with species search, species details, evolution-family navigation, and location encounter browsing.
- Let the Lab PC load the selected game's dataset independently of whether Arcade has been opened.
- Add reference information to the existing collection entry screen, linked by National Dex number.
- Clearly identify the reference ROM when collection matches span multiple games.
- Preserve collection requirements, registration, matches, and Camp navigation.
- Show unavailable or partial reference information without blocking existing screens or silently substituting vanilla facts for unsupported hack data.

Story walkthroughs, live emulator location tracking, save editing, and broader ROM-hack save compatibility are outside this service.

## Delivery and validation

Implement in this order:

1. Types, ROM reader, supported vanilla layouts, text decoding, and identity mapping.
2. Species fields, move dictionaries, learnsets, evolutions, and Pokédex entries.
3. Maps, encounters, probability calculations, and indexes.
4. Worker lifecycle, Storage Service persistence, invalidation, and shared loading.
5. i18n resolvers and Guide/Lab integration.
6. Expanded or relocated table discovery and TOML overrides, validated against specific compatible hacks.

Add meaningful regression tests alongside each stage:

- Validate all five vanilla games against trusted reference data using locally supplied ROMs; do not commit ROMs.
- Use synthetic fixtures for pointer bounds, malformed tables, decoding, identity conversion, missing mappings, and conflicting mappings.
- Verify moves, evolutions, family cycles, encounter grouping, probability calculations, and location deduplication.
- Test compatible expanded layouts and explicit warnings for unsupported custom structures.
- Test sidecar reloads, hash/version/metadata invalidation, ROM replacement/removal, provider changes, concurrent loads, and persistence failures.
- Verify English/Spanish rendering, custom move-name fallback, and language switching without extraction.
- Verify Guide and Lab show the same ROM-specific information while collection ownership remains save-based.
- Run the relevant Vitest suites, `npm run check:i18n`, lint, and production build.

Acceptance: a supported ROM produces one reusable dataset that powers both screens, survives reload through the selected storage backend, and never presents uncertain mappings as verified facts.
