# Arcade Zone product plan

Arcade lets players play Ruby, Sapphire, Emerald, FireRed, and LeafGreen using
mGBA WASM directly. pkCamp owns the player UI, controls, and shared ROM/save
handling through a small emulator adapter. gbajs3 is an implementation reference.
The [site roadmap](../ROADMAP.md#arcade-zone) tracks remaining work.

## Game-first flow

The player picks a game once on Start, from cartridge cards showing ROM/save
availability. Start can also manage a game's ROM without entering the Hub. The
Hub's Arcade card opens `/pkcamp/arcade/?game={gameId}` with a full page load
and is disabled when no game is selected. Exit Arcade returns to
`/pkcamp/hub/?game={gameId}`; a missing or invalid `?game=` redirects to the
Hub. The player is the only Arcade page. File tools and help stay in its menu
and dialogs. A missing ROM prompts Insert ROM on the player; a missing save
allows a new game.

## Shared ROMs and saves

Use the same per-game ROM and committed save as the Cabin and Lab through the
active local or Dropbox storage provider. Keep emulator working data separate
until a complete in-game save is automatically synchronized. Lab cartridge
dumps currently download files and can be imported into Arcade; they are not automatically stored.

Validate ROM identity against the selected game and check save structure before
booting. Imported SAV files remain session-only until the game writes a new,
complete save. The player does not load PKHeX; Cabin validates game identity
using its existing Ruby/Sapphire exception.

Each complete, settled in-game save automatically updates the captured Camp
storage provider through existing storage/history behavior. Serialize writes,
coalesce newer snapshots, and publish confirmed changes to Cabin and Lab.
Show Saving, Saved, Retry, and conflict feedback. File uploads/downloads live
in Advanced options; normal play requires no second save button. Save states
remain separate from standard `.sav` data and are deferred.

Show pending changes and save results. Protect progress before leaving,
resetting, replacing files, or switching providers. Reject stale callbacks and
detect changed source saves before overwriting. Failed cloud writes retain
session data for Retry or Download SAV without switching storage silently.

## Controls and responsive layout

Provide visible D-pad, A, B, L, R, Start, and Select buttons, with simultaneous
touch inputs and keyboard support. On-screen controls are drawn by a controller
skin: a built-in default, or Delta `.deltaskin` files imported and managed in
the Arcade tab of Lab Settings and stored on this device. Release held inputs when focus is lost or
play stops. Include Play/Pause, Reset, Mute/Volume, and supported Fullscreen.
Start audio through a user gesture and pause when the page is hidden.

Desktop uses a bounded handheld layout: screen centered, D-pad left, A/B and
Start/Select right, shoulders above, and a compact Menu/Speed/Restart row below.
Phone portrait places the display above the controller;
landscape uses side controls where space allows. Preserve the GBA's 3:2 picture,
keep controls clear of gameplay, and support rotation without restarting.
Touch targets must be at least 44 pixels, with safe-area spacing, visible focus,
and reachable file tools on narrow or short screens.

## Runtime and delivery

The player uses pinned `@thenick775/mgba-wasm@2.5.1` in a separate
`/pkcamp/arcade/` entry. Its scoped service worker supplies isolation for the
threaded runtime on static hosting. The main app remains outside that scope;
shared storage initializes independently in each document.

Production-preview bootstrap, raw save round trips, and browser layout evidence
are recorded in the runtime reference. GitHub Pages, Dropbox, all five retail
games, and physical iOS/Android checks remain release verification tasks. If the
threaded runtime fails a target browser, evaluate a single-threaded binding with
explicit save I/O and emulator-owned persistence disabled.

Keep zone UI under `pages/pokestorage/arcade/` and runtime bindings under
`services/emulator/`. Lazy-load matched JS/WASM assets, clean up runtime and
input resources on exit, and include required licenses and source/build links.

Verify all five games from Arcade through automatic save sync, Cabin reload,
and Lab refresh with local storage and Dropbox. Cover invalid files, new-game saves,
failed writes, provider changes, conflicts, and navigation protection. Check
real iOS/Android touch, audio, imports/downloads, and portrait/landscape layouts
alongside desktop browsers; run relevant tests, lint, and production build.

Speed controls support 0.5×, 1×, 2×, and 4×. Cheats, rewind, multiplayer,
e-Reader, physical gamepad mapping,
BIOS management, and additional games are deferred.
