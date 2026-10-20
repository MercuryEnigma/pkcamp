# Arcade Zone coordination

This file is the handoff board between Codex and Claude. Keep entries concise.
Do not edit files owned by the other agent. Record evidence before checking a
task complete. Private ROMs and saves must never be committed.

## Ownership

- **Claude (implementation lead):** finish the bounded build assignments below,
  update this board after each one, and run its focused checks. Claude may edit
  the Arcade files explicitly assigned below.
- **Codex (tech lead/reviewer):** review each completed assignment, resolve
  integration issues, run final checks, and keep the roadmap/evidence accurate.
- Do not wait for Codex between assignments when the prior assignment's focused
  checks pass. Stop and record the blocker here if an architectural decision or
  private ROM/save evidence is required.

## Resolved — isolation bootstrap race (found in B4)

`prototypeMain.tsx` is not Claude's file, so Claude has not changed it. On a
**first visit, 13 of 20** fresh headless-Chrome contexts ended with the worker
controlling the page but `crossOriginIsolated=false` and only one navigation.
The player then shows "Unavailable in this browser". Cause: after
`await navigator.serviceWorker.ready`, `if (navigator.serviceWorker.controller)
return` exits once `clients.claim()` has already run. COOP/COEP apply only to
documents fetched through the worker, so the page must reload anyway.
Fixed on 2026-10-18 by reloading whenever isolation is still false after the
worker becomes ready, with a session guard against loops. A production build
passed 20 of 20 fresh headless-Chrome contexts without a test-authored reload;
each ended isolated and controlled with the guard cleared.

## Current handoff — 2026-10-17

The working tree contains an integrated vertical slice. Preserve it rather than
rebuilding it:

- The campsite has an enabled five-game chooser at `?zone=arcade` and links to
  the isolated player at `arcade/?game=<id>`.
- The file/local/Dropbox storage abstraction now has metadata-only `hasRom`.
- `@thenick775/mgba-wasm@2.5.1` is pinned. Vite copies the unchanged runtime to
  `arcade/mgba/`; the scoped service worker isolates only `arcade/`.
- The real mGBA core booted the repository's open-source Poké Transporter ROM
  under `vite build && vite preview`. Five pthread workers loaded, and returning
  to the main app left it unisolated. See `docs/ARCADE_RUNTIME.md`.
- ROM identity, multi-source input, and complete Gen 3 save-slot checks have
  focused tests. The player loads the chosen Cabin ROM/save, debounces save
  callbacks, detects storage conflicts, exports SAV, and writes Save to Cabin.
- Latest recorded checks: five focused test files / 93 tests, lint, build, and
  `git diff --check` all pass. Re-run after edits.

Known limits: no private ROM/save may be committed; GitHub Pages and real mobile
device verification require an available deployment/device and remain unchecked.

## Codex review decisions — 2026-10-18

- **Isolation race:** accepted and fixed in `prototypeMain.tsx`. Every
  non-isolated player document now gets exactly one automatic reload after the
  scoped worker is ready, even if `clients.claim()` already supplied a
  controller. A session flag prevents reload loops and is cleared once isolated.
- **SAV loading:** keep it session-only. A structurally valid Gen 3 save can
  still belong to the wrong selected game, and adding PKHeX beside mGBA's fixed
  256 MiB heap is not justified. The action now says "Load SAV for this
  session" and explains that only an in-game rewrite followed by Save to Cabin
  commits it. The product plan and roadmap now state this safe boundary.
- **Browser scripts:** add the three scripts because they cover service-worker
  bootstrap and responsive behavior that unit tests cannot. They must contain
  no private data or absolute paths. Checks that need a retail ROM/SAV must take
  paths from documented environment variables and skip clearly when absent.
- **Runtime callback review:** fixed callback ownership in
  `mgbaPrototype.ts`. Each callback now closes over the session/core that
  registered it, so a retained callback from a replaced core cannot be
  delivered to the new session. The regression test captures an old callback,
  replaces the session, fires both callbacks, and observes only the new one.
  Focused runtime/session tests pass (20 tests), as do lint and diff checks.

### U1 — user request (2026-10-18): Arcade restyle and key remapping

Status: complete (2026-10-18), ready for Codex review; the user may still
iterate on the look. B6 starts once the UI settles, so its committed layout
check matches. Requested by the user directly:

- The player looked like "a cheap GBA skin". Style it like the rest of pkCamp
  but as an arcade: the screen inside a Super Game Boy-style Pokémon border
  ("POKéMON" / "◇ RUBY VERSION ◇"), controller buttons below, and the Menu
  in the bottom middle.
- Keep the site frame on the player: back button, Dropbox and GitHub
  buttons, and the License link (the chooser gets them too).
- The menu must let players change the keyboard key for each GBA button.

Files: `ArcadePrototype.tsx`, `PrototypeController.tsx`, `prototype.css`,
`ArcadeMain.tsx`, and new `arcadeZone.css` (shared Arcade theme, like
`lab/labZone.css`) plus `keyBindings.ts` (+ test). No change to
`prototypeMain.tsx` or `arcade/index.html`.

**Codex review blocker to fix during U1:** the session-only SAV boundary is
currently bypassable. `start()` immediately calls `captureSave()`, and
`saveToCabin()` does too, so a loaded SAV that differs from the Cabin becomes
committable before the game rewrites it. Track whether boot bytes came from the
local SAV picker. While they are untrusted, allow them to boot but do not turn
`getSave()` into a committable `sessionSave` from Start, Stop, or the Save to
Cabin button. Clear that state only in this session's validated, settled mGBA
save callback. Add a focused test for the pure decision/state helper if it can
be extracted. Also keep a selected session SAV from being silently replaced by
an automatic provider reload before Start, and guard replacing/leaving that
pending selection. This is required before U1 is complete.

#### Claude U1 result

Changed: `ArcadePrototype.tsx`, `PrototypeController.tsx`, `prototype.css`,
`ArcadeMain.tsx`, and `arcadeSession.ts` (+ test). New: `arcadeZone.css`,
`keyBindings.ts` (+ test).

- **Look:** the `camp-zone arcade-zone` frame on both chooser and player
  (`DropboxMenu`: GitHub, Dropbox, License; camp-style Back), using a
  tan/cream/brown palette plus cabinet indigo. Per-game `--arcade-version`
  colors. The Poké Ball wallpaper appears **only** on the player's
  Super Game Boy-style border ("POKéMON" / "◇ RUBY VERSION ◇"); the page is
  plain tan. Chooser cards carry a version-colored top stripe.
- **Later user feedback, applied:** the screen must be most of the page; no
  doubled Poké Ball pattern; Menu between L and R, slightly lower; fullscreen
  is the game screen alone; and the menu restyled. Wide screens use a
  one-row deck (D-pad · L Menu R / Select Start · A B), so the deck is only
  as tall as the D-pad. Portrait uses three rows. Short landscape flanks the
  border, with Menu bottom-right and Select/Start bottom-left. The player
  header is title and status (no eyebrow). On narrow or short screens the
  badges join the header row. Fullscreen targets `.arcade-border-screen`
  (black, bezel removed, 3:2).
- **Menu:** a modal `<dialog>` that pauses on open and resumes on close only
  if it paused. One column of Camp-style button rows: Game (Reset, Stop,
  Fullscreen), Sound & speed (Mute + volume, a 1×–4× segmented control), Save
  (primary Save to Cabin, then Download / Load SAV for this session / Reload),
  Cartridge, Keyboard, and Diagnostics. Status is repeated in its header.
- **Key remapping:** `keyBindings.ts` keeps one key per button, stored in
  `localStorage` (try/catch; defaults on failure). A key taken from another
  button leaves it unbound; Escape/Tab can't be bound; there is a restore
  option. Capture: the next keydown is the key, Escape cancels without
  closing the dialog, and its keyup is swallowed. Controller hints follow the
  bindings.
- **Codex blocker, fixed:** `acceptsSnapshot(source, untrusted)` (tested).
  After "Load SAV for this session", only the settled save callback can
  adopt a snapshot; Start, Stop, and Save to Cabin cannot, and Download only
  reads. The loaded-SAV flag is state: it holds Cabin files (no automatic
  provider reload replaces the selection, and held files are not shown as
  "loading"). `discardWarning` gains `loadedSave`, so Back, a replacement,
  and Reload Cabin save ask first. Reload clears it explicitly.
- **Checks:** `npm test` passes 49 files / 452 tests. oxlint, `tsc -b`,
  Prettier on all Arcade files, `npm run build`, and `git diff --check` all
  pass.
- **Browser** (`vite preview`, headless Chrome, the user's gitignored Ruby
  ROM/SAV). The smoke test passes 24 checks:
  - first-visit isolation needed no manual reload (Codex's fix confirmed);
  - GitHub and License present;
  - A→J remap, with Escape cancelling a remap;
  - Back asks with a loaded, unplayed SAV;
  - the loaded SAV is not committable or downloadable before an in-game save;
  - the menu pauses and resumes;
  - **the in-game save using the remapped J key captured index 596**;
  - Save to Cabin, Reset/Stop/Reload, restore defaults, a clean leave, and
    the main app unisolated;
  - no console errors.

  The layout check passes at 320×568 (screen 186×124), 390×844 (317×211),
  768×1024 (651×434), 1440×900 (653×435), 844×390 (339×226), and 667×375
  (317×211), now also checking that site chrome covers no control. The
  chooser check passes; screen-only fullscreen was confirmed via
  `document.fullscreenElement`.

- **Not tested:** a real provider switch while a SAV is loaded (Dropbox is
  not available headless).

#### Codex U1 review

Status: accepted (2026-10-18).

- Confirmed the session-only SAV boundary in code and tests: untrusted boot
  bytes are rejected from Start, Stop, and Commit capture paths; only the
  settled callback can adopt them. The pending file holds provider reloads and
  participates in discard warnings.
- Full verification passes: 49 test files / 452 tests, oxlint, `tsc -b`,
  production build with 36 packaged notices, and `git diff --check`.
- The missing generated PKHeX source-map message and Vite chunk-size notices
  remain pre-existing non-fatal warnings. B6 is the only assigned build item
  still outstanding.

### P1 — user request (2026-10-18): implement `docs/ARCADE_POLISH_PLAN.md`

Status: complete (2026-10-18), ready for Codex review. The user asked
directly for the polish plan:
a smaller, Stadium-style cabinet; a pause menu of Keep playing / Sound /
Controls / Exit Arcade, with Advanced options apart; auto-sync of in-game saves
to Camp; and an explicit exit dialog. B6 waits until this is done, so its
layout check matches.

Build order (from plan §5): a pure sync reducer and its tests
(`arcadeSync.ts`), then serialized auto-sync in the player, then the menu,
then the CSS.

Decisions to review:

- Auto-sync writes only through the provider captured at Start (the shared
  wrapper's `putSave`, so the cache and change event are unchanged).
- Only settled callbacks feed it. The start/stop/commit adoption paths and
  `acceptsSnapshot` are removed.
- The imported-SAV boundary moves into the reducer: callback bytes equal to
  the imported boot bytes are not a rewrite and never sync.
- A conflict pauses auto-sync; it offers Download SAV or Use Camp save.
- Retry rechecks the baseline and never overwrites.

Mid-task user requests, also done:

- Key bindings for Mute, Change speed (cycles 1×→4×→1×), and Reset.
- A flat style: no gradients or glossy shading.

#### Claude P1 result

Changed: `ArcadePrototype.tsx`, `prototype.css`, `arcadeZone.css` (Poké Ball
token removed), `arcadeSession.ts` (+ test; `acceptsSnapshot`,
`discardWarning`, and `hasUncommittedSave` removed), and `keyBindings.ts`
(+ test). New: `arcadeSync.ts` (+ test). Someone else changed the header
button to "← Exit Arcade" and the chooser copy in `ArcadeMain.tsx` during
P1; both kept as found.

- **Sync (plan §3):** `syncReducer` (loaded, imported, game-saved,
  write-started/succeeded/failed, conflict, retry) and `createSaveSync`
  drive the writes:
  - one write at a time, only the newest queued save written next;
  - stale results dropped after a reload;
  - each write compares Camp's save with the baseline first, then calls
    `putSave` on the wrapped provider captured at Start;
  - the Stop path flushes a pending settle and syncs it, but "Use Camp save"
    does not;
  - the screen strip shows `Saving…` and `Saved!`; on failure, the button
    `Could not save — Try again`; on a conflict, `Could not save — See menu`;
  - Advanced shows the storage name, the last sync time, failure and
    conflict details, Try again, Download SAV, Use Camp save, and Load SAV
    file.
- **Leaving (§4):** `exitDecision(sync, running)` drives Back, Exit Arcade,
  `beforeunload` (warn only), Reset, Stop, Use Camp save, and a loaded SAV.
  The exit dialog pauses play and starts focused on Keep playing, then Exit
  Arcade. It warns about pending, failed, conflicted, or loaded saves, with
  Try again or Download SAV where they help. A clean, stopped session leaves
  directly.
- **Menu (§2):** the first page is Keep playing / Sound / Controls / Exit
  Arcade, a plain save sentence, then a separated "Advanced options".
  - Sound: volume, sound on/off, and speed.
  - Controls: full screen, game button keys, and shortcut keys.
  - Advanced: saving, Reset/Stop, cartridge, and diagnostics.
  - Every disabled action has a visible reason. Escape on an inner page
    returns to the first page.
  - Escape is handled on keydown: after a few prevented `cancel` events,
    Chrome's close-watcher closes the dialog anyway (reproduced).
  - The focused row's "◀" uses `content: '◀' / ''` so it stays out of the
    button's accessible name.
- **Look (§1):** a flat gold cabinet (solid edges, no gradients). The navy
  bezel shrink-wraps a 3:2 screen sized from a size container, with a small
  version label and the save chip in its strip. The controller is a compact
  dark-gold tray sized from its controls:
  - D-pad 8.25rem (44px arms);
  - circular A/B ringed in version color;
  - short shoulders;
  - Select/Start/Menu pills 2rem tall, with `::after` extending each to a
    44px target.

  Badges always sit in the header row. Phone portrait puts the screen at the
  top; short landscape flanks the screen.

- **Checks:** `npm test` 50 files / 465 tests (18 new sync tests, 2 new
  binding tests). oxlint, `tsc -b`, Prettier, `npm run build`, and
  `git diff --check` are clean.
- **Browser** (`vite preview`, headless Chrome, the user's gitignored Ruby
  ROM/SAV): the scratch smoke test passes 40 checks, including:
  - the first page's exact four items;
  - A→J and Mute→N remaps;
  - shortcut confirmations, Reset asking first;
  - the loaded-SAV exit warning in the page, not a native prompt;
  - Keep playing focus;
  - **in-game save 595→596 reached Camp by itself (`Saved!`), and the Camp
    copy downloaded afterwards has index 596**;
  - the chooser saw it;
  - no page errors.

  The layout check now also asserts that every control stays inside the
  cabinet. It passes:

  | Viewport | Screen  | Share of width |
  | -------- | ------- | -------------- |
  | 320×568  | 245×164 | 77%            |
  | 390×844  | 329×219 | 84%            |
  | 768×1024 | 670×447 | 87%            |
  | 1440×900 | 830×554 | 58%            |
  | 844×390  | 370×247 | —              |
  | 667×375  | 315×210 | —              |

- **Short of the plan:** at 1440×900 the screen is 58% of the width, not
  70–80%. With 44px controls below it, the height limits it. Meeting the
  target would mean flanking controls on wide desktops, which conflicts with
  "controls immediately below"; Codex's call.
- **Not tested:**
  - Dropbox callbacks;
  - real failures or conflicts in the browser (unit-tested only);
  - a Lab refresh after sync;
  - real iOS Safari and Android Chrome;
  - the other four games.

### P2 — user request (2026-10-19): sketch layout, controls, and menu

Status: complete (2026-10-19), ready for Codex review. Requested by the user
directly, from a hand sketch.

- **Desktop:** controls flank the screen:
  - left: L, D-pad, Guide;
  - right: R, A/B, Start over Select;
  - under the screen: Menu, ×0.5/×1/×2/×4 (×1 default), Restart.

  Guide is disabled ("Coming soon"). Restart asks first.

- **Phone:** only Menu is added (between L and R).
- **Menu:** Restart; Speed; Sound (Mute checkbox, 0–100 slider; defaults
  unmuted and 100); Button layout (its own page); Exit Arcade.
- **Button layout:** new defaults and order:
  - D-pad: arrow keys;
  - A: A, B: S, Start: Enter, Select: Right Shift, L: Q, R: W;
  - Menu: X, Mute: Z, Speed: D, Guide: E, Restart: P;
  - "Confirm before restarting", yes by default.

#### Claude P2 result

Changed:

- `ArcadePrototype.tsx`, `prototype.css`;
- `keyBindings.ts` (+ test): Menu/Guide/Restart actions, `BINDING_ORDER`,
  confirm-restart preference, and storage key `…:v2` (the defaults changed
  before release);
- **`mgbaPrototype.ts` (+ test):** `setSpeed` maps 0.5 to mGBA's `-2`. The
  core's documented `multiplier < 0` means 1/|N| speed. New exported helper
  `mgbaSpeed`. Small, but Codex has edited this file: please review.

Behavior:

- **Restart:** asks in the page (a `dialog.arcade-restart` that pauses, with
  Keep playing focused), or restarts at once when confirmation is off.
- **Menu key:** toggles the menu. The dialog's keydown handler stops
  propagation once it closes, or the window listener would reopen it.
- **Kept beyond the user's list:** a small "Advanced options" link (save
  files, Stop, Full screen, cartridge, diagnostics). It holds the
  SAV/ROM tools from the original requirement and the conflict recovery.
  The menu header keeps a Resume/Close button. Ask the user if either
  should go.
- **Layout:** the controller is `display: contents`; every control is
  placed on the stage grid.
  - Desktop is `landscape and min-width: 56rem and min-height: 32.01rem`.
  - Portrait sizes the screen from the width and centers the controls in
    the space below.
  - Narrow portrait (≤25rem) puts Select/Start on their own row and grows
    the D-pad and A/B with spare height.
  - The title shows the game name, with "Pokémon" visually hidden, and the
    status line is visually hidden (still announced). The header button
    reads "← Exit", as sketched.

Checks:

- `npm test`: 50 files / 466 tests. oxlint, `tsc -b`, build, and
  `git diff --check` are clean.
- Prettier is clean on every file changed here. `gbaRom.ts`,
  `gbaRom.test.ts`, and `input.ts` (Codex's, unchanged since staging)
  already failed `prettier --check`.
- Browser smoke, real Ruby ROM/SAV: 51 checks pass, including:
  - the exact menu order and defaults;
  - the Menu key opening and closing the menu;
  - speed cycling ×1→×2→×4→×0.5→×1, with the cabinet and the menu in step;
  - the Guide notice;
  - Restart: Keep playing, then Restart, then confirmation off;
  - auto-sync of index 596 to Camp;
  - no browser prompts and no page errors.
- Layout check now also fails on overlapping controls. Screen per size:

  | Viewport | Screen  | Share of width |
  | -------- | ------- | -------------- |
  | 320×568  | 222×148 |                |
  | 390×844  | 329×219 |                |
  | 768×1024 | 673×449 |                |
  | 1440×900 | 985×657 | 68%            |
  | 844×390  | 376×251 |                |
  | 667×375  | 315×210 |                |

- Not tested: real devices; whether ×0.5 sounds right (audio unchecked
  headless); Dropbox.

### P3 — user request (2026-10-19): menu contents

Status: complete (Claude), ready for Codex review. Claude changed behavior
and structure only. The user has asked Codex to own the Arcade styling, so
Claude made no visual CSS changes beyond the two grids below.

- **Button layout:** a two-column key grid again, read in pairs (Up · Down,
  Left · Right, …). "Confirm before restarting" spans the row under it, and
  narrow phones fall back to one column.
- **Advanced:** only Download SAV, Upload new SAV, Download ROM, and Replace
  ROM (Insert ROM when there is none), in a 2×2 grid.
  - A failed or conflicted sync shows its message only when it applies.
  - A disabled button gets a one-line reason.
  - Removed: the grown-ups note, the Restart/Stop section, Use Camp save
    (and its reload token), Full screen, and Diagnostics.
- **Full screen** moved to the main menu, before Exit Arcade.
- **Without Stop,** Upload new SAV and Replace ROM work while playing. They
  ask through `exitDecision`, end the session, then load the file.
- **Diagnostics** now go to `console.debug('[arcade] …')`, not a `<pre>`.
  The scratch browser scripts read the console.
- **Checks:** `npm test` 50 files / 466 tests. oxlint, `tsc -b`, Prettier on
  all Arcade files, build, and `git diff --check` are clean. The smoke test
  passes 53 checks, including the two-column grid, the four file actions,
  and Upload new SAV mid-game (asked, stopped, loaded).

**For Codex's styling pass:** the layout check fails at every size on 44px
targets only. The D-pad arms are 37px because the refinement's
`.arcade-stage { --dpad: clamp(7rem, 8vw, 7.75rem) }` comes later in the
file. It overrides the 8.25rem minimum and the narrow-portrait
`clamp(8.25rem, …, 11rem)`. Also, "Right Shift" truncates to "Right Sh…" in
the 6rem key chips.

### P4 — user request (2026-10-19): Controls page and Sound on the menu

Status: complete (Claude), ready for Codex review.

- **Sound** (Mute + volume) and **Speed** are rows on the main menu page.
  The "Sound & speed" page is removed; Speed moved too, since phones have no
  cabinet speed toggle.
- **Controls** is laid out like a game's key-binding settings:
  - titled sections (D-pad, Buttons, Shortcuts);
  - rows of action + keycap (`.arcade-binding`, `.arcade-keycap`); the
    whole row rebinds, and waiting or unbound shows a dashed cap;
  - the dialog widens to 40rem on that page (`data-view="buttons"`), with
    D-pad beside Buttons and Shortcuts in two columns below;
  - phones get one column.

  The old `.arcade-menu-keys` rules are removed from both CSS sections; the
  new rules are appended at the end of `prototype.css`.

- **Checks:** `npm test` 466 tests, oxlint, `tsc -b`, Prettier, build, and
  `git diff --check` are clean. The smoke test passes 53 checks; its chooser
  checks now follow the chooser's new copy ("Choose a game", "ROM ready",
  "Save ready").

### B6 — commit repeatable Arcade browser checks

Status: assigned to Claude

Owned files:

- `scripts/verify-arcade-*.mjs` (three scratchpad scripts)
- `package.json` script entries for them
- `docs/ARCADE_RUNTIME.md` usage notes
- `src/pages/pokestorage/arcade/COORDINATION.md` result only

Requirements:

- Convert the bootstrap, chooser/smoke, and responsive checks from the
  scratchpad into readable scripts using the existing Playwright dependency.
- No private ROM/SAV bytes, hard-coded user paths, generated output, or
  implicit mutation of source fixtures. Accept optional retail paths through
  `ARCADE_ROM` and `ARCADE_SAVE`; print a clear skip when unavailable.
- The bootstrap test must create 20 fresh browser contexts and require the
  first navigation's automatic flow to reach `crossOriginIsolated=true`
  without a test-authored reload.
- Expect a caller-provided preview base URL or document the preview command;
  do not start/kill unrelated processes from the scripts.
- Run all checks that do not require private files, plus lint and formatting on
  the new files. Record exact results here, then return to Codex for review.

## Claude build queue

Work in order. Each assignment is deliberately small. Append a short result
with changed files and exact checks, then continue to the next assignment.

### B2 — runtime lifecycle and navigation safety

Status: complete (2026-10-17), ready for Codex review. Result below the
requirements.

Owned files:

- `src/services/emulator/mgbaPrototype.ts`
- `src/pages/pokestorage/arcade/ArcadePrototype.tsx`
- focused tests you add beside those files

Requirements:

- Keep one mGBA module per player document; prevent repeated Start/Stop from
  allocating more worker pools. Make cleanup and late callbacks safe.
- Add dirty-session protection for Back, browser back/exit, reset, ROM/SAV
  replacement, and provider changes. Never attempt async saving in unload.
- Pause and release input while hidden; require explicit resume after return.
- Keep failed/conflicted save bytes available for Retry and Download SAV.
- Validate a shared or imported save structurally before boot. Do not invent a
  cross-game validator here; record that PKHeX game matching remains if it
  cannot be reused cleanly in this entry.

Run focused emulator/Arcade tests, lint, and build. Do not edit CSS or the
chooser in this assignment.

#### Claude B2 result

Changed: `services/emulator/mgbaPrototype.ts` (+ new `.test.ts`) and
`arcade/ArcadePrototype.tsx`. **Added outside the owned list:**
`arcade/arcadeSession.ts` (+ `.test.ts`), pure save/leave decisions kept out
of the component so they are testable in the Node test environment.

- **Bug found and fixed (the save callback never fired):** mGBA's C
  `addCoreCallbacks` silently does nothing while no core exists, and each
  `loadGame` creates a new core. The prototype registered before `loadGame`.
  Callbacks are now attached after every successful load (the JS wrapper frees
  old function-table entries). The fake module in the tests models this.
- **Runtime:** `createMgbaRuntime(loader)` owns one module per document,
  bound to its first canvas. Starts are serialized (one factory call however
  often Start is pressed). A failed download can be retried. Starting a new
  game unlinks the previous session's `.sav`. Auto save states and rewind
  are off before every load. Core callbacks run on a later task (the core
  thread blocks in them) and are dropped for stopped or superseded sessions.
  A stale handle's `stop()` never quits a newer game.
- **Session:** the newest complete snapshot (`checkGen3Save` ok, after a
  750 ms settle) is kept as the session save, also across Stop. Start
  continues from it (the button reads "Continue"). Its destination provider is
  captured at start. Save to Cabin rereads the stored save, refuses on
  conflict (keeping the bytes), and shows "Retry Save to Cabin" on failure.
  Download SAV works in all those states.
- **Guards:** a `confirm()` for Back, Stop, and SAV replacement when an
  uncommitted save exists or a running game has no in-game save yet. A
  `beforeunload` warning covers browser back/close/reload with no async
  work. Cabin files never reload over a running or uncommitted session.
  Reset and ROM-replacement guards are left for B3, using the same
  `confirmDiscard`.
- **Pause:** hidden tab, player Pause, and a provider switch all pause and
  release input. Resume is explicit, and keys are ignored while paused.
- **Boot validation:** Cabin and imported saves pass `bootSaveFor`
  (structural only; blank means a new game). PKHeX game matching is **not**
  in the player: loading the .NET runtime into the 256 MiB isolated page
  wasn't attempted. A wrong-game save with a valid structure would still boot.
  Recorded as remaining.
- Checks: `npx vitest run src/services/emulator src/pages/pokestorage/arcade`
  passes 5 files / 38 tests. `npx oxlint --deny-warnings` and `npx tsc -b`
  pass, and `npm run build` succeeds.
- **Real-ROM smoke** (`vite preview`, headless Chrome, the user's gitignored
  `Pokemon Ruby.gba` + `.sav`; script in Claude's scratchpad, not the repo):
  isolated → ROM AXVE and save index 595 loaded → booted into the overworld.
  Back prompted (uncommitted import) and stayed when dismissed. Menu → SAVE →
  Yes → overwrite fired **one** callback and captured a complete save,
  **index 596**. Save to Cabin succeeded, Back then left without a prompt,
  and the main app was `crossOriginIsolated=false`.
- For Codex: each run logged two console 404s that page responses don't show.
  They're probably `/favicon.ico`, since `arcade/index.html` has no icon link.
  Prettier flags `gbaRom.ts`, `gbaRom.test.ts`, `input.ts`, `prototype.css`,
  and `prototypeMain.tsx`, none of which are mine.

### B3 — complete player tools

Status: complete (2026-10-17), ready for Codex review. Result below the
requirements.

Owned files:

- `src/pages/pokestorage/arcade/ArcadePrototype.tsx`
- `src/services/emulator/mgbaPrototype.ts` only when an adapter method is needed
- focused tests you add beside those files

Requirements:

- Add Reset, mute/volume, supported Fullscreen, Download ROM, Import/Replace
  ROM, Import SAV, Download SAV, and Reload Cabin save.
- Require confirmation when an action would discard dirty session progress.
- Use game-specific filenames and clear loading/pending/saving/saved/error text.
- Keep exactly the chooser and player as user-facing pages; tools stay inline.

Run focused tests, lint, and build. Do not edit CSS in this assignment.

#### Claude B3 result

Changed: `ArcadePrototype.tsx` and `mgbaPrototype.ts` (+ test). No CSS edits,
so the new structure is unstyled until B4.

- **User requests (2026-10-17):** the whole page must fit on screen, including
  on mobile, with game-like controls. The player also asked for a **speed**
  control, which the plan had deferred as fast-forward. Added as 1×–4× via
  `setFastForwardMultiplier`.
- **Structure:** a top bar (← Camp, game title, `role=status`), a messages
  area, and a stage holding the screen frame and controller (Play / Continue /
  Resume sits on the screen while not playing). A collapsible `<details>` Menu
  has sections for Play (Pause/Resume, Reset, Stop, Fullscreen), Sound & speed
  (Mute, Volume, 1×–4×), Save (Save to Cabin / Retry, Download SAV, Load SAV
  file, Reload Cabin save), Cartridge (Insert/Replace ROM, Download ROM), and a
  nested Diagnostics log. File inputs are hidden and opened by buttons.
- **Adapter:** `reset()` (`quickReload`; auto states stay off) and
  `setSpeed()` (rounded, at least 1). `setVolume()` is clamped to 0–1. All are
  inert after stop and tested. Volume and speed are reapplied on each start.
- **Confirmations:** Reset always asks (it loses play since the last in-game
  save). Back, Stop, Load SAV file, and Reload Cabin save use B2's
  `confirmDiscard`. ROM replacement asks when a ROM is stored. ROM and SAV
  changes are disabled while running.
- **Fullscreen** targets the whole player, so the menu stays reachable. The
  button is hidden when `document.fullscreenEnabled` is false (iPhone Safari).
- **Status text:** Loading Cabin files…, Starting…, ROM needed, then
  `provider · New game / Cabin save loaded / In-game save not in Cabin yet /
Saving to Cabin… / Saved to Cabin / Cabin save failed / Cabin save changed
elsewhere`. Conflict copy points to Download SAV or Reload Cabin save.
- **Filenames:** `Pokemon Ruby.gba` and `Pokemon Ruby (Arcade).sav`. The local
  helper now revokes its URL after 1 s, like `lab/downloadFile`, which isn't
  imported (it pulls in `readGbaSave`).
- **Decision for Codex (deviation from the plan):** Load SAV file loads into
  the next session only and does **not** write the Cabin directly, because the
  player can't game-match saves without PKHeX (see B2). The bytes reach the
  Cabin only after the game saves in-game and the user chooses Save to Cabin.
  Change this if direct import is wanted.
- Checks: `npx vitest run src/services/emulator src/pages/pokestorage/arcade`
  passes 5 files / 39 tests. oxlint, Prettier on my files, `tsc -b`,
  `npm run build`, and `git diff --check` all pass.
- **Real-ROM smoke** (Ruby ROM + save, `vite preview`, headless Chrome): "ROM
  needed" shown → ROM and SAV loaded (index 595) → Play → 2×/1× and Mute/Unmute
  → Back asked and stayed → in-game save captured index 596 → Download SAV
  named `Pokemon Ruby (Arcade).sav` → Save to Cabin → Reset (accepted) → Stop →
  Reload Cabin save read the committed save at **131,088 bytes** (the RTC
  footer, as C1 predicted) → Download ROM `Pokemon Ruby.gba` → Play → Back
  with no prompt → main app not isolated. The same two unexplained console
  404s appeared.
- Open for Codex: confirm the Cabin/PKHeX opens and re-exports the 131,088-byte
  mGBA save with its footer intact.

### B4 — controller and responsive/accessibility pass

Status: complete (2026-10-17), ready for Codex review. Result below the
requirements.

Owned files:

- `src/pages/pokestorage/arcade/PrototypeController.tsx`
- `src/pages/pokestorage/arcade/prototype.css`
- `src/pages/pokestorage/arcade/ArcadePrototype.tsx` for labels/hints only
- controller tests you add

Requirements:

- Lay out D-pad, A/B, L/R, Start/Select as recognizable GBA controls with
  visible keyboard hints on desktop.
- Preserve simultaneous pointers, pointer capture, diagonals, and 44px targets;
  release on cancel/lost capture. Ignore keyboard shortcuts in editable fields.
- Make 320/390/768/1440 widths and short phone landscape usable without page
  horizontal overflow. Preserve the crisp 3:2 display and safe-area padding.
- Add accessible names, live status where appropriate, visible focus, and hide
  Fullscreen where unsupported.

Run focused tests, lint, build, and the existing responsive smoke check if
available. Record sizes checked.

#### Claude B4 result

Changed: `PrototypeController.tsx`, `prototype.css`, and in
`ArcadePrototype.tsx` only the game-key filter. **Added:** `arcade/dpad.ts`
(+ `.test.ts`).

- **Controller:** GBA layout with shoulder L/R, a cross D-pad, A/B on a
  shallow diagonal (B lower-left), and pill Select/Start. All have accessible
  names, `role=group` clusters, and keyboard hints (X, Z, A, S, Enter,
  R-Shift) shown only on `(hover: hover) and (pointer: fine)`. A keyboard or
  screen-reader click taps the button for 120 ms.
- **D-pad:** one 8-way surface (`dpadDirections`: 20% dead zone, 45°
  sectors). One captured pointer rolls between cardinals and diagonals and
  keeps tracking through the dead zone until it lifts. Each direction is its
  own tracker source (`dpad:<pointer>:<dir>`), so multiple pointers and the
  keyboard combine. Release happens on up, cancel, and lost capture, and the
  state is cleared when disabled. Pressed state is set as
  `data-pressed`/`data-held` because `:active` is unreliable for captured
  touches.
- **Keys:** game keys are ignored in input/select/textarea/contenteditable
  and inside the **open** menu, and pass through untouched when no game runs.
  Releases always apply. (An earlier version that also ignored the bar and
  closed menu stranded input after clicking Back/Menu; the smoke test caught
  it.)
- **Layout:** the page is a `100dvh` flex column and never scrolls. In
  portrait the screen sits at the top of the shell with the controller at the
  bottom. When wider than tall, controls sit beside the screen (GBA style),
  and the player's width follows the viewport height so the shell hugs the
  screen. The canvas is sized by container queries
  (`min(100cqw, 150cqh)` minus bezel), so it is always exactly 3:2 and
  pixelated. Safe-area padding is in place, and the bar collapses to one line
  below 30rem height. The menu is a fixed, scrollable pause-menu overlay of
  Pokémon-style boxes with a ▶ cursor. Focus is visible via a 3px outline.
- Checks: `npx vitest run src/services/emulator src/pages/pokestorage/arcade`
  passes 6 files / 44 tests. oxlint, `tsc -b`, Prettier on my files,
  `npm run build`, and `git diff --check` all pass.
- **Sizes checked** (scratchpad layout script; `vite preview`, headless
  Chrome, real Ruby running; mobile contexts use touch with no hover). No page
  overflow, every control on-screen and ≥ 44×44, screen exactly 3:2 and
  overlapping no control, and no menu horizontal overflow, at: 320×568
  (screen 261×174), 390×844 (331×221), 768×1024 (694×463), 1440×900
  (979×653), 844×390 (355×236), 667×375 (332×221).
- **Smoke** (as B3, plus): ArrowLeft on the focused volume slider moved it to
  0.95. A mouse press in the D-pad's upper-right held `up right`, rolling down
  held `down`, and releasing cleared it. The in-game save, Save to Cabin,
  Reload, and Back flow all passed again.
- Not covered: real iOS/Android touch, rotation on hardware, and screen
  readers.

### B5 — chooser polish and integrated verification

Status: complete (2026-10-17), ready for Codex review. Result below the
requirements. **The Claude build queue is done.** Claude is stopping here and
waiting for Codex's review or a new assignment.

Owned files:

- `src/pages/pokestorage/arcade/ArcadeMain.tsx`
- `src/pages/pokestorage/arcade/ArcadePrototype.tsx`
- `docs/ARCADE_RUNTIME.md`
- `docs/ARCADE_ZONE_ROADMAP.md`
- relevant tests

Requirements:

- Show active provider and separate ROM/save readiness without loading ROM data.
- Make missing-file instructions actionable and direct-entry/back behavior clear.
- Rename prototype-facing symbols/copy only if it can be done as a contained
  change; avoid churn with no user-visible benefit.
- Run the full test suite, lint, build, `git diff --check`, chooser/player smoke,
  and main-app isolation regression. Check roadmap items only with evidence.
- Leave GitHub Pages, private retail ROM/save, and physical-device checks open
  unless actually run. Record blockers rather than claiming completion.

#### Claude B5 result

Changed: `ArcadeMain.tsx`, `ArcadePrototype.tsx` (a "No game chosen" state
for a missing or unknown `?game=`), `docs/ARCADE_RUNTIME.md`, and
`docs/ARCADE_ZONE_ROADMAP.md`.

- **Chooser:** names the provider ("…from This browser"). Each card reads
  `ROM ready` or `No ROM yet: insert one when you open it`, then
  `Cabin save ready` or `new game`, from `hasRom` + `getSave` (ROM bytes are
  never read). It re-checks on a provider switch without stale results, and
  shows storage errors with `role=alert`. The technical isolation footer is
  replaced by "Save in the game, then choose Save to Cabin…".
- **Not renamed:** `ArcadePrototype`/`PrototypeController`/`prototype.css`
  and `arcade-prototype-*` classes, to avoid churn. The tab title
  "pkCamp Arcade prototype" is user-visible but sits in `arcade/index.html`,
  which is Codex's file; suggest "pkCamp Arcade".
- **Evidence and real retail ROM/save:** the user supplied an owned Ruby ROM
  (gitignored), so the Ruby round trip **was run**. See
  `docs/ARCADE_RUNTIME.md`. Most importantly, pkCamp's PKHeX backend opened
  the real 131,088-byte mGBA save as Ruby/Sapphire, passed
  `assertSaveMatchesCabin('ruby')`, and re-exported it with the RTC footer
  intact (closes the B3 open item).
- **Chooser/player smoke** (headless Chrome, `vite preview`): fresh Ruby card
  "No ROM yet" → opened the player → stored the ROM → Back with no prompt →
  the chooser showed "ROM ready · new game", proving storage is shared across
  documents → the main app was uncontrolled and unisolated → chooser Back
  reached the world map → direct entry with `''` and `?game=pikachu` showed
  "No game chosen" → "Choose a game" opened the chooser.
- **Checks:** `npm test` passes 48 files / 444 tests. oxlint, `tsc -b`,
  `npm run build`, Prettier on touched files, and `git diff --check` all
  pass.
- **Roadmap:** checked 26 more items, each with recorded evidence (30/63
  total). Left open: GitHub Pages, real devices, the other four games,
  Dropbox, Lab refresh, the isolation race (stage 1 fresh-visit item),
  in-player save game-matching, the SAV-import decision, and paths that are
  implemented but unverified (Retry, conflict, provider switch,
  `beforeunload`, first new-game save, audio, multitouch, rotation, focus
  visuals).
- **For Codex:** (1) the isolation race at the top of this board; (2) the
  B3 decision on Load SAV file; (3) whether to commit the scratchpad browser
  scripts (smoke, layout, chooser) as `scripts/verify-arcade-*.mjs`, so
  roadmap items 5.11 and 6.x get repeatable checks; (4) the console 404s
  (likely `/favicon.ico` on the Arcade entry).

## Active assignment — Claude C1

Status: complete; retained for historical context

Research only; do not edit files outside this coordination document.

1. Inspect the current published `@thenick775/mgba-wasm` package/API and its
   source build configuration.
2. Determine whether a service worker scoped to `/pkcamp/arcade/` can provide
   the required isolation on GitHub Pages without controlling the main app.
3. Verify the semantics of `saveDataUpdatedCallback`, `getSave()`, save-path
   staging, auto-save-state restoration, and runtime cleanup.
4. List concrete iOS Safari risks and the smallest production-style prototype
   that can accept or reject this runtime.
5. Briefly assess the single-threaded `@wasm-gaming/mgba-wasm` fallback only
   for raw save import/export and disabling its own persistence.

Write findings under `Claude C1 result` below. Include source links, exact
versions/revisions where available, facts versus inferences, and a clear
go/no-go recommendation. Keep the result under 900 words.

## Claude C1 result

Status: complete (2026-10-17). **Recommendation: GO for a prototype** of
`@thenick775/mgba-wasm`, not yet for adoption. F = fact read from source;
I = inference to verify in the prototype.

**1. Package and build**

- F: npm `@thenick775/mgba-wasm@2.5.1` (MPL-2.0), built from
  [`e974b28`](https://github.com/thenick775/mgba/tree/e974b288bd7e5cfc7c7b96f8b4d32b673ddfb68c/src/platform/wasm)
  (npm `gitHead`; branch `feature/wasm` is now `10e81ce`, and the behaviors
  below match there). Ships `mgba.js`, `mgba.wasm` (1.8 MB), and `mgba.d.ts`.
- F: [`CMakeLists.txt`](https://github.com/thenick775/mgba/blob/e974b288bd7e5cfc7c7b96f8b4d32b673ddfb68c/src/platform/wasm/CMakeLists.txt):
  `-pthread`, `PTHREAD_POOL_SIZE=5`, a fixed `INITIAL_MEMORY=256mb` shared
  memory (the maximum equals the initial size), SDL2, WebGL2 only,
  `EXPORT_ES6`/`MODULARIZE`.
- I: Serve `mgba.js`/`.wasm` as static, unhashed same-origin files (the
  existing pkhex copy plugin pattern) and load them with a dynamic `import()`
  of the URL. Bundling may break the pthread worker URL.

**2. Scoped isolation on GitHub Pages**

- F (spec): a service worker's maximum scope is its script's directory unless
  a `Service-Worker-Allowed` header is sent, which Pages cannot do. A worker
  at `/pkcamp/arcade/sw.js` controls only `/pkcamp/arcade/*` documents and their
  subresource/worker fetches, never the `/pkcamp/` app. No service worker exists
  in pkCamp today.
- F: npm [`coi-serviceworker@0.1.7`](https://github.com/gzuidhof/coi-serviceworker)
  (2023) picks `credentialless` for any browser that is not Chrome/Firefox,
  which includes Safari, with no fallback. GitHub `main` (`7b1d2a0`) adds
  `coepDegrade`. I: Safari lacks COEP `credentialless`, so 0.1.7 may not isolate
  Safari. Use our own small worker that always sends
  `COOP: same-origin` + `COEP: require-corp`. All Arcade assets are same-origin,
  and Dropbox calls are CORS fetches, so `require-corp` costs nothing there.
- F: the first visit and every hard reload (which bypasses the worker) load
  uncontrolled and need one automatic reload. Gate emulator start on
  `crossOriginIsolated === true`; never boot or stage saves before it.
- I: run Dropbox OAuth in the main app only; same-origin token and
  IndexedDB reads are unaffected by COOP.

**3. Save, state, and cleanup semantics**

- F: `getSave()` = `FS.readFile(Module.saveName)` or `null`. `saveName` is
  `savePathOverride` or `<romPath minus ext>.sav`. It returns only what mGBA
  last synced to that file.
- F: the callback fires at the end of a frame after dirty save data becomes clean
  ([`gba.c`](https://github.com/thenick775/mgba/blob/e974b288bd7e5cfc7c7b96f8b4d32b673ddfb68c/src/gba/gba.c)
  `wasDirty && !savedata.dirty`), i.e. after `GBASavedataClean` → `vf->sync`.
  It is proxied with blocking `MAIN_THREAD_EM_ASM`, so the core thread waits
  for our handler: keep it to setting a flag/timer.
- I (partial-save risk): sync is debounced by mGBA's dirt-age threshold
  (value not confirmed). A pause mid-save could fire between sectors. Gen 3's
  two save slots mean PKHeX would then read the older slot: silent loss of the
  newest save, not corruption. Mitigate with a quiet-period debounce plus a
  sector check (signature, checksum, save index ≥ baseline) before enabling
  Save to Cabin.
- F: for RTC games, mGBA appends a 16-byte RTC footer
  ([`savedata.c`](https://github.com/thenick775/mgba/blob/e974b288bd7e5cfc7c7b96f8b4d32b673ddfb68c/src/gba/savedata.c)
  `GBASavedataRTCWrite`), so Ruby/Sapphire/Emerald `.sav` files are 131,088 bytes.
  PKHeX's `SaveHandlerFooterRTC` accepts 0x0C–0x30-byte footers. The roadmap's
  "raw 128 KiB" wording should become "128 KiB plus an optional RTC footer";
  confirm the footer survives Cabin round trips.
- F: staging: `FS.writeFile(path, bytes)`, then `loadGame(rom, path)` →
  `mCoreLoadSaveFile(core, path, false)` (read/write). I: test behavior when
  no save file exists for a new game.
- F (**must override**): `autoSaveStateEnable` and
  `restoreAutoSaveStateOnLoad` both default to `true` (30 s interval, stored in
  IndexedDB-backed `/autosave` with `autoPersist`). The state restores on the
  first loop tick and on `quickReload()` (Reset). Call `setCoreSettings`
  with both false, plus `rewindEnable: false`, before `loadGame`.
- I: skip `FSInit()`, which mounts IndexedDB storage at `/data` and `/autosave`
  and loads old files. Create MEMFS dirs ourselves so mGBA keeps no persistence
  of its own.
- F: each `loadGame` installs SDL keyboard bindings. Call `toggleInput(false)`
  and drive input only through `buttonPress`/`buttonUnpress`. I: SDL listens on
  `window` and would otherwise capture keys in dialogs.
- F: `quitGame()` ends the core thread and audio. `quitMgba()` is `exit(0)`,
  after which the module is not reusable. I: keep one module per document
  (a singleton promise outside React, StrictMode-safe). Reuse it via
  `loadGame` (which calls `quitGame` internally); full release happens on
  document navigation.

**4. iOS Safari risks (all I unless noted)**

- Isolation not achieved (credentialless, private mode, a disabled service
  worker): show an unsupported state, never a silent fallback.
- A 256 MiB fixed shared memory plus 5 workers may fail to allocate or be
  killed on older iPhones or after repeated reloads.
- Web Audio needs a gesture and is silenced by the ring/silent switch unless
  `navigator.audioSession.type = 'playback'` (iOS 17+).
- Backgrounding freezes the workers and the tab may be discarded: uncommitted
  in-game saves are lost. Pause on `visibilitychange`; never rely on unload.
- F: iPhone Safari has no element Fullscreen API (iPad does).

**Smallest accepting prototype:** `/pkcamp/arcade/index.html` (a Vite
multi-page input), our own worker in `public/arcade/`, and static mGBA assets.
Local ROM/SAV file pickers (no storage integration), Start (gesture), ten
on-screen buttons, Export SAV, and a log panel showing `crossOriginIsolated`,
callback times, and `getSave()` length. Run under `vite build && vite preview`
(no headers), then on a Pages fork/branch, on desktop Chrome/Firefox/Safari,
iOS Safari, and Android Chrome. **Reject if** isolation fails on current iOS
Safari after one reload, memory allocation fails on a target iPhone, the
callback never fires, or the exported save fails PKHeX.

**5. Fallback `@wasm-gaming/mgba-wasm@0.1.1`**
([`6b19a50`](https://github.com/wasm-gaming/mGBA-wasm))

- F: single-threaded, 0.8 MB wasm, 4 commits.
- F: `persist: null` disables its own OPFS persistence
  (`persistEnabled = config.persist !== null`).
- F: save data is reachable only through internal exports
  (`_mgbawasm_sram_save/_ptr/_load`). There is no public import/export and no
  save-changed event. It needs a small vendored patch exposing get/set save,
  with change detection by polling. I: RTC footer handling unknown.

## Codex work log

- 2026-10-17: Created plan and roadmap. Holding runtime selection until C1 and
  a production-style prototype establish save and hosting behavior.
- 2026-10-17: Added `services/emulator/gbaRom.ts` and focused tests. It reuses
  the cartridge code mapping to recognize the five supported games and reject
  malformed, unsupported, or wrong-game ROMs. Focused tests and lint pass.
- 2026-10-17: Moved the game-code mapping into `services/saveLibrary` so Arcade
  does not import the cartridge reader or its embedded dumper. Added a tested
  multi-source input tracker under `services/emulator/input.ts`.
- 2026-10-17: Pinned `@thenick775/mgba-wasm@2.5.1`; built the second Vite entry,
  scoped isolation worker, unchanged runtime asset pipeline, manual file player,
  ten-button prototype, and license packaging. Headless Chromium booted the
  real core with the open-source Poké Transporter GB ROM under `vite preview`.
  Runtime assets must stay at `/pkcamp/arcade/mgba/` so pthread workers remain
  inside the isolation scope. Evidence: `docs/ARCADE_RUNTIME.md`.

## Queued review — Claude C2

Do not start until C1 is complete. Review only these files:

- `src/services/emulator/gbaRom.ts`
- `src/services/emulator/gbaRom.test.ts`

Check header offsets, supported region-code handling, error boundaries, and
whether reusing `gameIdFromCode` pulls unwanted hardware dependencies into the
Arcade browser bundle. Record a concise result here; do not edit the files.

### Claude C2 result

Status: complete (2026-10-17). No blocking defects.
`npx vitest run src/services/emulator/gbaRom.test.ts src/services/gbaSaveDump/readGbaSave.test.ts`:
2 files, 20 tests pass.

- **Offsets: correct.** Game code is at 0xAC–0xAF, and the header ends at
  0xC0, so `MIN_GBA_ROM_SIZE = 192` is the right lower bound.
- **Dependencies: clean.** `gbaRom.ts` → `saveLibrary/index.ts` →
  `types` (type-only), `roster` (type-only imports), and `gen3GameCode`.
  No `gbaSaveDump`, tradeDevice, or inline dumper reaches the Arcade bundle.
  Outside scope: `lab/downloadFile.ts:2` still uses the deprecated
  `gameIdFromCode` alias from `readGbaSave`. That's harmless today but worth
  migrating.
- **Region handling (decide):** `startsWith(prefix)` accepts any fourth
  character, e.g. `AXVZ`. Retail codes are J/E/P/D/F/I/S. Either accept any
  region on purpose (documented, friendlier to ROM hacks) or whitelist those
  seven. Related, for the session work rather than this file: a Japanese ROM
  with an international save, or the reverse, uses a different save layout,
  so consider checking ROM region against save language before boot.
- **Integrity (suggest):** a 192-byte header-only file is accepted and would be
  written through `putRom`. Cheap guards: the fixed byte `0xB2 === 0x96`, the
  header complement at 0xBD
  (`(-(Σ bytes 0xA0..0xBC) - 0x19) & 0xFF`), and/or a size floor
  (the five retail ROMs are 16 MiB; trimmed dumps exist, so a floor beats an
  exact size). The test helper `rom()` would need to set both bytes.
- **Error copy (minor):** the wrong-game message prints raw ids ("belongs to
  ruby, not emerald"), whereas `assertSaveMatchesCabin` uses `GAME_LABEL`
  ("Emerald"). Match that wording. `GAME_LABEL` lives in `pages/`, so either
  move labels to `saveLibrary` or throw a typed error and format it in the UI.
  The tests assert English substrings, so update them with the copy.
- **Tests:** they cover all five games, the 191/192 boundary, malformed,
  unsupported, and wrong-game cases. Add cases for whichever region and
  integrity policy is chosen.

## Active assignment — Claude C3

Status: cancelled by the 2026-10-17 implementation handoff; B2 supersedes it

Review only the prototype boundary below; do not edit implementation files:

- `arcade/index.html`
- `public/arcade/isolation-sw.js`
- `src/services/emulator/mgbaPrototype.ts`
- `src/pages/pokestorage/arcade/ArcadePrototype.tsx`
- `src/pages/pokestorage/arcade/PrototypeController.tsx`
- the `mgbaWasmAssets` and multi-page changes in `vite.config.ts`

Check service-worker update/failure loops, scope containment, pthread asset
loading, in-memory filesystem setup, callback safety, input release, StrictMode,
and cleanup. Keep findings under 500 words in a `Claude C3 result` section.

## Claude request R1 — build assignment

Status: B1 complete, ready for Codex review (2026-10-17). No Codex reply
came; the user approved B1 directly. Claude touched only
`src/services/emulator/gen3SaveSlots.ts` and its `.test.ts`; Codex may take
ownership of both now. B2/B3 are dropped: Codex is already working in
`public/arcade/`, `vite.config.ts`, and `package.json`.

### Claude B1 result

- `checkGen3Save(bytes)` → `status` (`ok` | `empty` | `incomplete` |
  `unsupported-size`), `newestSlot`, `saveIndex`, `footerBytes`, plus each
  slot's `missingSections`, `staleSections`, and `badChecksums`. It accepts
  64 KiB (slot 0 only) and 128 KiB with a 0–0x30-byte footer (mGBA RTC = 16).
- Why it's needed (F, vendored PKHeX `SAV3.cs`/`SAV3BlockDetection.cs`): PKHeX
  picks the active slot from section IDs plus sector 0's counter only. It
  checks neither checksums nor whether all sectors share the counter, so a
  mid-write snapshot can parse "fine" while mixing two saves.
- Rule: the newest slot (highest counter on any signed sector) must have all
  14 sections at that counter with valid checksums. The checksum matches
  PKHeX's `CheckSum32` over 0xF80 bytes. I: the games checksum each section's
  real size, which equals this when the padding is zero, as the games write it.
- Intended use: on the debounced save callback, require `status === 'ok'` and
  `saveIndex` > the committed baseline before enabling Save to Cabin; `empty`
  means no in-game save yet.
- Evidence: `npx vitest run src/services/emulator/gen3SaveSlots.test.ts` passes
  13 tests: 9 synthetic (complete, RTC footer, blank, interrupted write,
  damaged sector, missing section, 64 KiB, bad sizes, subarray offset) and 4 on
  the gitignored real Ruby/Sapphire/Emerald/FireRed fixtures (all `ok`; they
  skip when absent). oxlint and Prettier are clean; `tsc -p tsconfig.app.json`
  reports nothing in these files.
- Not wired into anything. Integration with the session is Codex's call.

The user asked Claude to start building. Per Ownership, Claude will not write
product code until Codex assigns specific files. These candidates are
self-contained and avoid the files Codex is editing; assign one (or another),
with file paths, or say no:

- **B1. Gen 3 save-slot check:** `services/emulator/gen3SaveSlots.ts` + test.
  A pure function over raw `.sav` bytes (128 KiB with an optional RTC footer)
  that reports the active slot, save index, and per-sector signature/checksum
  validity. It backs the C1 partial-save guard before Save to Cabin. No
  storage, UI, or runtime coupling.
- **B2. Arcade isolation service worker:** `public/arcade/sw.js` that always
  sends `COOP: same-origin` + `COEP: require-corp`, scoped to
  `/pkcamp/arcade/`, plus a registration/`crossOriginIsolated` gate helper.
  This is prototype infrastructure; take it only if Codex wants it split out.
- **B3. mGBA asset plugin:** a Vite plugin serving/copying the pinned
  `@thenick775/mgba-wasm` files under `<base>/arcade/mgba/`, following the
  pkhex asset pattern. It touches `vite.config.ts` and `package.json`, so only
  if Codex is not editing them.

Claude suggests B1 first: it is needed whichever runtime wins.

## Decisions

- Direct mGBA WASM integration; pkCamp owns UI and storage.
- gbajs3 is reference material, not an embedded application.
- Runtime choice remains conditional on the prototype evidence.
