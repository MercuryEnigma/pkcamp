# pkCamp roadmap

## Hub

- [x] Add Start and six-zone world-map menus under `pages/hub/`.
- [x] Restore Dropbox and settings before enabling Start.
- [x] Ask first-time players to select a sprite source; offer optional Dropbox sign-in.
- [x] Show Dropbox controls on both menus when configured and project credits on Start.
- [x] Open Camp and Lab; mark Battle, Safari, Pelago, and Arcade as coming soon.
- [x] Place a subdued Start-menu link below the map's zone cards.
- [x] Start shared storage prefetch and bounded sprite preloading in the background.
- [ ] Replace the zone-card menu with the explorable map.
- [ ] Add stable URL navigation, keyboard/pointer interaction, and accessible map labels.

## Camp Zone

- [x] Add platform-era lodges with the Gen 3 GBA Lodge enabled.
- [x] Import, inspect, explicitly save, and export supported Gen 3 saves and `.pk3` files.
- [x] Provide positional boxes, read-only parties, details, and View/Move/Group modes.
- [x] Add configurable 30-slot Camp Sites with independent staged edits.
- [x] Validate matching Cabin/cartridge versions before imports and restores.
- [x] Persist saves, Camp Sites, and settings in browser storage or Dropbox.
- [x] Add Trading Post and cartridge backup/restore workflows.
- [x] Verify ESP32, GB-Link trades/backups, and GBA ↔ Switch relay from the dev server.
- [ ] Repeat supported device flows from the production/static build.
- [ ] Verify import/edit/export/reopen with representative real saves before expanding support.
- [ ] Expand game generations, field editing, and transfer rules only after validation.
- [ ] Implement emulator save handoff with Arcade, Safari, and Pelago.
- [ ] Add source/device provenance and define standalone Pokémon identity.
- [ ] Define and build the Transfer Station.
- [ ] Complete the [Camp checklist](src/pages/pokestorage/ROADMAP.md).

## Lab Zone

- [x] Add Celio's Lab, collection sheets, Trade Table, Settings, and Patch Notes.
- [x] Validate built-in/uploaded collections and scan committed Gen 3 saves and Camp Sites.
- [x] Store rebuildable collection results, source choices, uploads, and history.
- [x] Migrate legacy browser-only Lab settings and uploads into active storage.
- [x] Open source Cabin boxes/Camp Sites and return to the same Lab entry.
- [x] Share the trading/settings logic and navigation guards with Camp.
- [ ] Specify Mystery Gift sources, contents, compatible games/devices, and recovery behavior.
- [ ] Build Research Tools, starting with verified Mystery Gift workflows.
- [ ] Finish account, compatibility, accessibility, and data-management options.

## Battle Zone

- [ ] Define currency, rewards, prices, purchases, refunds, and inventory ownership.
- [ ] Build the item/decorations shop and inspection UI.
- [ ] Add decoration equipment limits, previews, and persistent assignments.
- [ ] Make reward/purchase transactions recoverable and resistant to duplication.
- [ ] Connect decoration effects to shared Safari/Pelago contracts.

## Safari Zone

- [ ] Specify catching, encounter, reward, and decoration-effect rules.
- [ ] Build/integrate a custom GBA game without distributing a copyrighted base ROM.
- [ ] Run the game through the shared emulator adapter.
- [ ] Version and validate save/Pokémon/reward exchanges with the website.
- [ ] Prove interrupted-session recovery and Dropbox-backed resumption.

## Pelago Zone

- [ ] Specify expeditions, idle time, assignments, rewards, and decoration effects.
- [ ] Build/integrate a custom GBA game without distributing a copyrighted base ROM.
- [ ] Reuse emulator lifecycle and backup/recovery support.
- [ ] Version and validate save/progress/reward exchanges with the website.
- [ ] Make timestamps and interrupted exchanges recoverable across sessions.

## Arcade Zone

- [ ] Verify mGBA WASM formats, browsers, performance, input, audio, and asset/worker loading.
- [ ] Build a player-provided ROM spike that works from the deployed base path.
- [ ] Define shared emulator lifecycle, save I/O, controls, audio, errors, and capabilities.
- [ ] Add play/pause/reset, fullscreen, mappings, and clear recovery states.
- [ ] Prove explicit save import/export and Dropbox backup/restore across reloads.
- [ ] Verify repeated mount/unmount cleanup and recovery with multiple supplied games.
- [ ] Publish the supported-browser matrix and decide ROM-persistence policy.

## Site-wide foundation and cleanup

- [x] Add typed PKHeX, storage, sprite, and hardware service boundaries.
- [x] Add Dropbox PKCE, session restore, copy-up, logout, and offline read-only handling.
- [x] Unify navigation guards for edits, settings, trades, transfers, Dropbox, and page exit.
- [x] Suspend guards in preserved hidden Lab screens.
- [x] Share pending reads with independent byte copies and observable provider settings.
- [x] Cache sprite resolvers and preload at most six images concurrently.
- [x] Track production trade assets separately from ignored personal fixtures.
- [x] Add pinned-source WASM setup before dependency installation in deployment configuration.
- [x] Pass strict maintained-code lint, build, WASM packaging, browser checks, and 327 unit tests locally on October 16, 2026.
- [ ] Verify the updated GitHub Actions workflow from a clean checkout and the deployed site's assets/routes.
- [ ] Record fresh-profile Dropbox restore, revoked-access, and multi-device recovery checks.
- [ ] Define synchronization/conflict, retention, storage-limit, reward, and decoration schemas.
- [ ] Complete privacy, attribution, licensing, and support-matrix reviews.
- [ ] Address Vite/WASM source-map, runtime-URL, and bundle-size diagnostics.
- [ ] Move providers/startup/navigation into `app/` and separate hub/Camp/Lab/news pages.
- [ ] Extract shared Pokémon storage, trading, settings, and collections into `features/`.
- [ ] Consolidate repeated page layouts and move shared UI/hooks/styles into `shared/`.
- [ ] Remove confirmed unused pages, wrappers, functions, assets, and experiments.
- [ ] Keep i18n; relocate initialization/catalogs into `services/i18n/`, then adopt translation keys separately.
- [ ] Expand automated storage-mode, accessibility, transaction, and emulator-lifecycle coverage.
- [ ] Keep each architecture document to one page: one or two current-state paragraphs and one structure/API diagram.
