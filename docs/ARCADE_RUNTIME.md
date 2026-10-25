# Arcade runtime evidence

Candidate: `@thenick775/mgba-wasm@2.5.1`, source revision
`e974b288bd7e5cfc7c7b96f8b4d32b673ddfb68c`. This is prototype evidence,
not final browser support. Private ROMs and saves are not fixtures.

## Running the browser checks

The checks drive headless Chrome through Playwright against a production
build. Start a preview server in one terminal and run them from another:

```sh
npm run build && npm run preview -- --host 127.0.0.1
npm run verify:arcade
```

`verify-arcade-bootstrap` repeats 20 fresh first visits and checks isolation,
refresh, and that the main app stays outside the worker. `verify-game-choose`
covers the five Start cartridges, direct Arcade entry, Exit, and an invalid `?game=`.
`verify-arcade-layout` checks overflow, the 3:2 display, 44-pixel touch targets,
desktop control alignment, and the three menu views at seven viewports.

Optional environment variables:

- `ARCADE_ROM`, `ARCADE_SAVE`: paths to your own `.gba` and `.sav`. With
  `ARCADE_ROM` set, the chooser check also boots the real core; without it,
  that step prints `SKIP`. Files stay in a temporary browser profile.
- `ARCADE_GAME`: the game to open (default `ruby`).
- `ARCADE_BASE_URL`: another server, such as a deployment
  (default `http://127.0.0.1:4173/pkcamp/`).
- `ARCADE_BROWSER_CHANNEL`: the Playwright browser channel (default `chrome`).

## 2026-10-17 local production build

`npm run build` produced `dist/arcade/index.html`, the scoped isolation worker,
and unchanged mGBA JS/WASM assets under `dist/arcade/mgba/`. Keeping mGBA there
is required: its pthread worker URL must be within the `/pkcamp/arcade/` service
worker scope. Serving it from `/pkcamp/mgba/` isolated the document but left
the workers uncontrolled and initialization stalled.

A headless Chromium check against `vite preview`, which supplies no isolation
headers, verified:

- first-visit worker registration/reload reached `crossOriginIsolated=true`;
- the service worker controlled Arcade, and five pthread workers loaded;
- `mgba.js` and `mgba.wasm` returned 200 with correct MIME types;
- the real core loaded and ran the repository's unmodified Poké Transporter GB
  utility ROM, then `quitGame()` returned;
- returning to `/pkcamp/` showed the main app with no service-worker controller
  and `crossOriginIsolated=false`;
- the browser reported no page or console errors. WebGL driver-performance and
  deprecated `ScriptProcessorNode` warnings remain upstream behavior.

The same core also booted behind real COOP/COEP response headers. This separated
the initial scoped-worker bug from the package itself.

## 2026-10-17 retail ROM/save round trip (Pokémon Ruby)

This run predates automatic save sync. "Save to Cabin" below is the manual
commit button it replaced; the same complete-snapshot check now gates sync.

All runs used `npm run build` + `vite preview` and headless Chrome, with the
player-owned `Pokemon Ruby.gba` (AXVE, 16 MiB) and a 131,072-byte save from
the gitignored `src/assets/saves/`. Neither is committed. The scripts used
then lived outside the repository; `scripts/verify-arcade-*.mjs` replaces them.

- **Save callback.** mGBA ignores `addCoreCallbacks` until a core exists, and
  every `loadGame` creates a new core. The adapter now registers after each
  load; before that fix the callback never fired. In-game Start → SAVE → Yes →
  overwrite produced **one** `saveDataUpdatedCallback`. After the 750 ms
  settle, `checkGen3Save` reported a complete newest slot at index **596**
  (the import was 595). Save to Cabin is enabled only for such snapshots.
- **RTC footer.** The committed, downloaded, and reloaded Ruby save is
  **131,088 bytes**: 128 KiB plus mGBA's 16-byte RTC footer.
- **PKHeX.** pkCamp's own `pkhex-wasm` backend (Node) loaded that real save as
  `RubySapphire`, and it passed `assertSaveMatchesCabin('ruby', …)`. It
  re-exported 131,088 bytes with the footer byte-identical and a complete slot
  at index 596.
- **Restart.** Save to Cabin → Reset → Stop → Reload Cabin save read the
  131,088-byte save as bootable, and Play booted it again.
- **Documents.** The player stored the ROM. Back returned to `?zone=arcade`,
  whose chooser then showed Ruby "ROM ready" from the same local storage. The
  main app had no service-worker controller and `crossOriginIsolated=false`.
  Direct entry with no or an unknown `?game=` shows "No game chosen" and a
  link to the chooser.
- **Guards.** Back with an uncommitted save prompted and stayed when
  dismissed. After Save to Cabin it left without a prompt, and with no game
  running it never prompted. Reset asks every time.
- **Layout.** At 320×568, 390×844, 768×1024, 1440×900, 844×390, and 667×375
  (touch, no-hover contexts for phones) there was no page overflow. Every
  control was on-screen and at least 44×44, and the screen was exactly 3:2
  and clear of controls. ArrowLeft on the focused volume slider moved the
  slider rather than the game. A pointer in the D-pad's upper-right held
  up + right, rolled to down, and released cleanly.
- **Checks.** `npm test` passes 48 files / 444 tests.
  `npx oxlint --deny-warnings`, `npx tsc -b`, `npm run build`, and
  `git diff --check` all pass.

### 2026-10-18 first-visit isolation fix

The initial bootstrap returned early when `clients.claim()` supplied a service
worker controller, even though the current document had not been fetched with
COOP/COEP. That produced an unisolated player in 13 of 20 fresh contexts. The
bootstrap now reloads every non-isolated player document exactly once after the
worker is ready, using a session flag to prevent loops and clearing it after
isolation succeeds. Against `vite preview`, **20 of 20 fresh headless-Chrome
contexts** reached `crossOriginIsolated=true` and a controlled document through
the page's automatic flow; none retained the reload flag.

### Implemented, unverified

These have code but no recorded run: failed-write Retry, the conflict path,
pausing on a provider switch, `beforeunload` on browser close/back, the
new-game first save, pausing on a hidden tab, audio (headless), real
multitouch, and rotation. An uploaded SAV deliberately loads into the session
only: the player cannot game-match a save without PKHeX, so a file reaches the
Cabin only after the game writes a new, complete save and automatic sync
stores it.

## Still required before adoption

- GitHub Pages deployment plus repeat, hard-refresh, and direct-entry checks.
- Sapphire, Emerald, FireRed, and LeafGreen round trips (only Ruby so far).
- Desktop Safari/Firefox, plus real iOS Safari and Android Chrome: audio,
  touch, rotation, app switching, and file pickers.
- Dropbox session restoration across main-app/player navigation, failed
  writes, and conflicts.
- Lab refresh after an Arcade commit.
