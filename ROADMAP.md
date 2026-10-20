# pkCamp roadmap

## Hub

- [x] Add Start and the zone-card menu under `pages/hub/`.
- [x] Restore Dropbox and settings before enabling Start.
- [x] Ask first-time players to select a sprite source; offer optional Dropbox sign-in.
- [x] Show Dropbox controls on both menus when configured and project credits on Start.
- [x] Open Camp and Lab, show Arcade as coming soon, and hide the deferred Battle/Safari/Pelago cards.
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
- [x] Verify representative real-save import/edit/export/reopen workflows for enabled Gen 3 formats.
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
- [x] Specify Mystery Gift sources, contents, compatible games/devices, and recovery behavior.
- [x] Add the Research Tools hub and GBA save download and restore workflows.
- [x] Validate Research Tools hardware workflows; detailed coverage is in the [Lab checklist](src/pages/pokestorage/lab/ROADMAP.md).
- [x] Add automatic GB-Link firmware updates with installed/latest versions in shared Settings.
- [x] Harden cancellation, late device selection, repeated shutdown, and guarded hardware settings navigation.
- [ ] Complete remaining production, accessibility, and automated checks in the [Research Tools checklist](src/pages/pokestorage/lab/ROADMAP.md).
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

Detailed sequencing and acceptance evidence are tracked in the
[Arcade checklist](docs/ARCADE_ZONE_ROADMAP.md).

- [ ] Verify mGBA WASM formats, browsers, performance, input, audio, and asset/worker loading.
- [ ] Build a player-provided ROM spike that works from the deployed base path.
- [x] Define shared emulator lifecycle, save I/O, controls, audio, errors, and capabilities.
- [x] Add play/pause/reset, fullscreen, mappings, and clear recovery states.
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
- [ ] Run lint, the full test suite, and the production build for the release commit.
- [x] Verify the updated GitHub Actions workflow from a clean checkout and the deployed site's assets/routes.
- [ ] Record fresh-profile Dropbox restore, revoked-access, and multi-device recovery checks.
- [ ] Define synchronization/conflict, retention, storage-limit, reward, and decoration schemas.
- [x] Publish license notices, source links, modification records, and image credits.
- [ ] Complete privacy and support-matrix reviews.
- [ ] Address Vite/WASM source-map, runtime-URL, and bundle-size diagnostics.
- [ ] Move providers/startup/navigation into `app/` and separate hub/Camp/Lab/news pages.
- [ ] Extract shared Pokémon storage, trading, settings, and collections into `features/`.
- [ ] Consolidate repeated page layouts and move shared UI/hooks/styles into `shared/`.
- [x] Remove unused Options/Splash/wrappers, dirty-state callbacks, template assets/styles, and obsolete previews.
- [x] Remove the unused router wrapper/dependency; preserve component-state navigation.
- [x] Keep i18n and relocate initialization/catalogs into `services/i18n/` with a shared instance export.
- [ ] Adopt translation keys in screens and add language selection separately.
- [ ] Expand automated storage-mode, accessibility, transaction, and emulator-lifecycle coverage.
