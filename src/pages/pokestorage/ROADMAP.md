# Camp Zone roadmap

## Lodges and save inspection

- [x] Model fixed game identifiers through Gen 9; open the Gen 3 GBA Lodge only.
- [x] Restore the selected game's committed browser/Dropbox save.
- [x] Show positional party/box grids, details, and sprite fallbacks.
- [x] Stage manual save uploads until explicit Save Game.
- [x] Catch invalid files and reject mismatched Cabin versions.
- [x] Export working saves and standalone Pokémon through the adapter.
- [x] Discard stale restore/upload results after replacement or unmount.
- [ ] Verify representative real-save edit/export/reopen workflows for every enabled format.
- [ ] Expand generations and fields only after validating their capabilities.

## Working copies and Camp Sites

- [x] Add View, Move, and Group with read-only parties.
- [x] Support positional box/Camp moves, swaps, and rectangular groups.
- [x] Preserve empty positions and reject occupied group destinations.
- [x] Configure 30-slot Camp Sites without shrinking past occupied positions.
- [x] Stage imports/removal/movement with independent game and Camp dirty state.
- [x] Preserve unreadable Pokémon files in their original Camp positions.
- [x] Require explicit Save Game and Save Camping Pokémon actions.
- [x] Protect Back, Dropbox, save replacement, and page exit through shared guards.
- [ ] Broaden movement, dirty-state, accessibility, and large-save cleanup tests.

## Persistence, settings, and sprites

- [x] Keep saves, ROM slots, Camp Sites, settings, and Lab data behind StorageProvider.
- [x] Support IndexedDB and Dropbox with PKCE, copy-up, restore, and logout.
- [x] Keep daily current/previous saves and separate hardware backups.
- [x] Preserve unsaved work during storage failures without local fallback.
- [x] Share pending reads while keeping byte copies/editors independent.
- [x] Bind async settings work to its original provider.
- [x] Publish saved sprite settings and preload through a bounded queue.
- [ ] Record clean-profile Dropbox login/save/restore and revoked-access recovery.
- [ ] Define conflict handling, retention/limits, source provenance, and Pokémon identity.
- [ ] Design a history/recovery UI and locally hosted licensed sprite pipeline.

## Trading and cartridge transfers

- [x] Add two-sided selection from save backups, Camp Sites, GB-Link, and ESP32.
- [x] Preserve source slots and validate Pokémon at adapter boundaries.
- [x] Show permissions, compatibility, progress, cancellation, and recovery states.
- [x] Revert recorded PkCamp writes independently of physical-device state.
- [x] Support GBA cartridge read/write with matching-game validation and pre-write backup.
- [x] Protect active trades/transfers with the application navigation registry.
- [x] Track the production GB-Link placeholder outside personal fixtures.
- [x] Verify GB-Link, ESP32, cartridge backup, and GBA ↔ Switch relay on real hardware from the dev server.
- [ ] Repeat supported flows from the production/static deployment.
- [ ] Define Transfer Station and cross-generation transfer behavior.

## Emulator and Lab handoff

- [x] Scan committed Cabin/Camp data into rebuildable Lab collections.
- [x] Open a source Cabin box/Camp Site and return to the same Lab entry.
- [x] Reuse trade/settings behavior in both zones and suspend hidden Lab guards.
- [ ] Define emulator save identity, lifecycle, and handoff contracts.
- [ ] Send a selected save to Arcade/Safari/Pelago and stage returned data explicitly.
- [ ] Show storage/device provenance alongside source locations.

## Verification and organization

- [x] Pass strict lint, production build, WASM packaging, browser checks, and 327 unit tests locally on October 16, 2026.
- [x] Prepare pinned-source WASM dependencies before installation in deployment configuration.
- [ ] Verify the updated workflow from a clean GitHub Actions checkout.
- [ ] Separate Camp/Lab pages and extract shared features, UI, hooks, and styles.
- [ ] Consolidate settings/trade layouts and remove confirmed unused code.
- [ ] Keep i18n and move it into a site-wide service before adopting translation keys separately.
- [ ] Finish privacy, attribution, licensing, and browser/device compatibility reviews.
