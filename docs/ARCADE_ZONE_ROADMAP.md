# Arcade Zone roadmap

Product scope is in the [plan](ARCADE_ZONE_PLAN.md). Work through these stages
in order; complete the runtime decision before building the full player.
Check items only with recorded evidence. Record build revisions, test commands,
browser/device results, and unresolved failures in a technical reference linked
here when created. Keep private ROMs and saves out of source control.

Evidence for checked items is in [Arcade runtime evidence](ARCADE_RUNTIME.md).
Unchecked items there marked "implemented, unverified" have code but no
recorded run yet.

## 1. Runtime prototype and decision

- [x] Inspect current navigation, storage, Dropbox initialization, save validation, and build/deployment code before editing.
- [x] Pin a candidate `@thenick775/mgba-wasm` version and inspect its shipped APIs/assets.
- [x] Build a minimal `/pkcamp/arcade/` player entry using the real core and a supplied ROM/save.
- [x] Scope the isolation service worker to `/pkcamp/arcade/`; keep the main app outside its control.
- [x] Confirm isolation and worker/WASM loading after a fresh visit, worker activation/reload, refresh, and direct entry (`npm run verify:arcade`).
- [ ] Verify a production-style build without development isolation headers, then verify on GitHub Pages before accepting the runtime.
- [ ] Confirm the main app's sprites, embeds, and account flow still work after visiting the player.
- [x] Prove raw 128 KiB plus optional RTC-footer Gen 3 save import/export, in-game Save, PKHeX validation, and restart with the exported save.
- [x] Determine when the save callback yields a complete snapshot; prevent partial-save commits.
- [ ] Verify new-game first saves, RTC, all ten GBA inputs, user-activated audio, pause/resume, and shutdown.
- [ ] Test the prototype on real iOS Safari and Android Chrome plus desktop browsers; record versions and playable performance.
- [ ] Verify local storage and Dropbox restore across the document transition; reuse initialization code without assuming in-memory state survives.
- [ ] If the prototype fails, record the failure and evaluate a single-threaded mGBA binding with explicit save import/export and host-controlled persistence.
- [ ] For any fallback, repeat the same save, browser, hosting, and lifecycle checks before accepting it.
- [ ] Record the chosen build/binding, source revision, deployment approach, and evidence before proceeding.

## 2. Emulator adapter and assets

- [x] Add a narrow `services/emulator/` interface for ROM/save loading, playback, reset, input, volume, complete save snapshots, change notification, and disposal.
- [x] Implement direct mGBA bindings behind that interface; keep storage writes outside the adapter.
- [x] Disable automatic save-state restoration and prevent emulator-managed saves from overriding the supplied Cabin save.
- [x] Lazy-load matched JS/WASM/worker assets under the configured base path.
- [x] Handle initialization failures and cancellation without late callbacks or leaked runtimes.
- [x] Make cleanup idempotent, including repeated React mount/unmount, audio, workers, inputs, listeners, and object URLs.
- [x] Package licenses, notices, source links, and reproducible asset/build instructions.

## 3. Shared ROM/save session

- [x] Capture provider and game identity after storage is ready; load the existing shared ROM/save into independent working bytes.
- [x] Validate ROM game codes against the selected game and save structure before boot; Cabin keeps PKHeX game matching, including the Ruby/Sapphire exception.
- [x] Handle missing ROM and missing save separately; never erase a stored save when starting a new game.
- [x] Automatically sync each complete, settled in-game save through the captured provider's `putSave`.
- [ ] Preserve existing daily save history and hardware-backup meanings; publish changes through the shared storage wrapper.
- [ ] Implement ROM insert/replacement/download and session-only SAV upload/download with validation and replacement protection — implemented; browser run pending.
- [ ] Keep progress pending until a write succeeds; retain failed-write bytes for Retry or Download SAV without silent provider fallback — implemented and unit-tested; browser run pending.
- [ ] Compare stored save bytes with the session baseline before committing and handle conflicts without automatic overwrite — implemented and unit-tested; browser run pending.
- [ ] Pause on provider changes and prevent stale loads/writes targeting another game or provider — implemented and unit-tested; browser run pending.
- [ ] Track unsaved progress, including before a new game's first valid save; protect reset, replacement, Back, and browser exit — implemented and unit-tested; browser run pending.
- [x] Test round trips, invalid files, first saves, write failures/retries, conflicts, provider changes, and stale callbacks (`arcadeSync`, `arcadeSession`, `gbaRom`, and `mgbaRuntime` tests).

## 4. Two-page navigation and file tools

- [x] Enable Arcade in the world menu and add the five-game chooser under `pages/pokestorage/arcade/`.
- [x] Show shared ROM/save readiness and active provider; avoid loading all ROM bytes just to render the chooser.
- [x] Open the selected game's player with inline missing-file prompts and tools.
- [x] For the separate-entry approach, validate the game URL parameter, support direct entry, and restore the chooser on Back.
- [ ] Reuse storage/session and navigation-guard logic across entries; establish the player entry's own guard registration.
- [ ] Provide guarded internal navigation plus browser exit/back handling appropriate to the chosen entry; never depend on unload-time async writes — implemented; browser run pending.
- [x] Render Play/Pause, Reset, Mute/Volume, supported Fullscreen, and all planned ROM/SAV actions.
- [x] Show loading, saving, saved, retry, and conflict states for automatic save sync; normal play needs no separate save button.
- [x] Pause around replacement dialogs and prevent duplicate operations.
- [x] Keep exactly two user-facing pages; use inline panels/dialogs for file tools and help.

## 5. Controller and responsive layout

- [x] Render D-pad, A, B, L, R, Start, and Select on desktop and mobile.
- [x] Add keyboard bindings and visible hints; ignore shortcuts in editable fields and dialogs.
- [ ] Support simultaneous touches, diagonals, held inputs, pointer capture, and independent keyboard/touch input ownership.
- [ ] Release inputs on cancellation, lost capture, blur, pause, page hiding, and teardown.
- [ ] Start audio from a user gesture and pause when hidden; require an explicit resume on return.
- [x] Preserve the 240 × 160 display's 3:2 aspect ratio with crisp scaling.
- [x] Implement desktop, phone portrait, and phone landscape layouts with controls clear of gameplay.
- [ ] Support safe areas, at least 44-pixel touch targets, rotation without restart, and scrolling outside controller surfaces.
- [x] Keep controls and file tools reachable without horizontal overflow at 320, 390, 768, 1440, and 1920 CSS-pixel widths and short landscape viewports (`npm run verify:arcade`).
- [ ] Verify keyboard focus, button names/states, status announcements, and fullscreen controls where supported.
- [ ] Add meaningful automated input cleanup/multitouch coverage. Browser layout checks are in `scripts/verify-arcade-layout.mjs`.

## 6. Integrated verification and completion

- [ ] Verify all five games through chooser → player → in-game Save → automatic sync → Cabin reload → Lab refresh.
- [ ] Repeat shared-data flows with local storage and Dropbox, including failed writes and account restoration.
- [ ] Verify imports/downloads, reload/reset, missing files, replacement cancellation, and guarded navigation.
- [ ] Check real iOS/Android audio, touch, rotation, app switching, file pickers/downloads, and first/repeat player visits.
- [ ] Verify desktop browser behavior and repeated session cleanup with real mGBA, not only a mocked adapter.
- [x] Run relevant tests, `npm run lint`, `npm run build`, and `npm run verify:arcade`; record results and remaining limitations.
- [ ] Verify deployed asset URLs, service-worker scope/update behavior if used, direct player entry, and return navigation.
- [ ] Update current architecture docs and link this checklist from the site roadmap; document verified browser support.
- [ ] Mark complete only when required production and real-device checks have evidence; leave unavailable checks unchecked.
