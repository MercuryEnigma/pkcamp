# FR-LDN — Product Roadmap

_Updated September 30, 2026._

## Product vision

Build a modern, browser-only Pokémon Stadium-style website hosted on GitHub
Pages. A player enters through a splash screen, starts the experience, and
explores a map whose areas each lead to a distinct activity. Pokémon, saves,
collection progress, rewards, and decorations connect those activities and
persist across sessions.

This roadmap records the current direction, not a claim that every named
component already supports every planned use. The capabilities, browser
requirements, integration surfaces, and licenses of
[`pkhex-wasm`](https://github.com/EthanThatOneKid/pkhex-wasm),
[`@thenick775/mgba-wasm`](https://www.npmjs.com/package/@thenick775/mgba-wasm),
and [switch.gblink.io](https://switch.gblink.io/) must be verified before their
behavior is treated as a requirement.

## Product constraints

- The application is a static, browser-only client deployed to GitHub Pages;
  it will not depend on a project-owned application server.
- Players provide their own ROMs. The project will not distribute commercial
  ROMs or include them in the deployed site.
- Dropbox is the intended account-backed store for saves, Pokémon-related
  data, collection progress, rewards, decorations, and site state.
- Hardware and emulator integrations must meet the same shared-state
  contracts rather than creating isolated copies of player progress.
- Features that require browser device APIs must detect support and explain
  unavailable or permission-denied states clearly.
- Unknown mechanics or third-party capabilities remain discovery items until
  they are tested and documented.
- API and service boundary decisions require the project owner's involvement;
  implementation work must not silently introduce or reshape those contracts.

## Intended player loop

Enter the map → manage or bring in Pokémon and saves → play games and explore
collections → earn items and decorations → use those rewards to change future
activities → persist progress to the player's account.

## World map

| Area        | Theme and host                     | Primary activity                                                                         |
| ----------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Camp Zone   | Campsite and ranch run by Hayley   | Manage Pokémon and save backups; use the trade corner to interact with physical devices. |
| Lab Zone    | Pokémon laboratory run by Brigette | View the Pokédex, collection sheets, and options.                                        |
| Battle Zone | Shopping district                  | Buy and inspect items and decorations for use elsewhere.                                 |
| Safari Zone | Gated safari                       | Play a custom GBA Safari game; decorations influence which Pokémon can appear.           |
| Pelego Zone | Thick jungle                       | Play a custom GBA idle expedition game; decorations influence expeditions.               |
| Arcade Zone | Large arcade tower                 | Play player-provided ROMs in the browser and back up their saves.                        |

## Current foundation

- [x] React + Vite application scaffolded for GitHub Pages.
- [x] Existing pkcamp content moved into a patch-notes view under Options.
- [x] Initial `react-i18next` catalog structure added.
- [x] Forked `pkhex-wasm` into `vendor/pkhex-wasm` and exposed a typed browser
      adapter backed by `PKHeX.Facade`; Gen 3 save and `.pk3` parsing,
      serialization, positional box writes, and movement are working.
- [x] Built the Poké Storage proof of concept in Camp; Gen 3 has working save
      views.
- [x] Added one browser-local save/ROM slot per game id and configurable
      **Camping Pokémon** boxes for each generation. Each generation defaults
      to one 30-slot box. These use IndexedDB as a proof-of-concept persistence
      layer; Dropbox is not yet integrated.
- [x] Added Gen 3 party, box, and details views plus explicit View, Move, and
      Group modes. Party Pokémon are view-only; box Pokémon can move between
      save boxes and Camping Pokémon.
- [x] Save-box and Camping Pokémon changes are staged independently, require
      explicit Save actions, and warn before in-app navigation or page exit
      while unsaved.
- [x] Added a site-wide sprite resolver boundary with a parameterized,
      user-selectable source for the proof of concept.
- [ ] Replace the current section-oriented navigation with the splash screen
      and explorable six-area map described above.

## Immediate priority: prove the two new integration paths

These discovery tracks can proceed together. Their results define the stable
interfaces used by the later milestones.

### A. mGBA WASM and player-provided ROMs

- [ ] Add `@thenick775/mgba-wasm` and prove that it loads from a production
      GitHub Pages build, including deployment from the repository base path.
- [ ] Build a minimal Arcade spike that lets the player choose a local ROM,
      launch it, use controls and audio, pause it, and exit cleanly.
- [ ] Verify supported ROM types, save types, save detection, browser support,
      performance, input options, audio behavior, and worker/WASM asset loading.
- [ ] Prove explicit save import, export, backup, and restore without losing or
      silently overwriting an existing save.
- [ ] Decide whether ROM bytes may ever be persisted. The default direction is
      local-only ROM selection; Dropbox synchronization is for saves and site
      state unless a later decision says otherwise.
- [ ] Define an emulator adapter with lifecycle, ROM loading, save I/O, input,
      audio, error, and capability boundaries so the Arcade, Safari, and Pelego
      zones can share the integration.
- [ ] Document the supported-browser matrix and a graceful fallback for
      browsers that cannot run the emulator reliably.

**Exit gate:** a player can open a ROM they supplied, play it in the deployed
static app, export its save, reload the page, restore that save, and continue.

### B. Switch and GBA hardware through switch.gblink.io

- [~] Reproduce the current switch.gblink.io flow with supported physical GBA
  and Switch hardware and record the required adapters, firmware, browsers,
  permissions, and user steps.
  -- Switch support added
  -- no GBA
- [x] Determine the supported integration boundary: redirect or companion
      workflow, reusable client package, documented protocol, or a direct
      browser integration. Do not assume the older ESP32-specific architecture.
- [x] Confirm which data can move between the browser and each device, including
      Pokémon formats, saves, metadata, and trade/session status.
- [~] Review licenses, security expectations, origin restrictions, and any
  dependency on services outside the GitHub Pages app.
- [x] Define a device adapter around capabilities and events so the Camp trade
      experience does not depend on one transport implementation.
- [x] Prove a Pokémon round trip between the website's data model and real
      hardware, with `pkhex-wasm` validation at the data boundary.

**Exit gate:** the supported hardware path and integration method are documented
from evidence, and one end-to-end real-device transfer succeeds without a
project-owned backend.

## Delivery milestones

### 1. Arcade vertical slice

- [ ] Turn the mGBA spike into the first shippable activity in the Arcade Zone.
- [ ] Add ROM selection, recent-save selection, play/pause/reset controls,
      fullscreen behavior, key/controller mapping, and clear error states.
- [ ] Back up emulator saves to Dropbox after explicit account authorization;
      retain manual local import/export as a recovery path.
- [ ] Test repeated mount/unmount cycles so navigation does not leak workers,
      audio contexts, event listeners, or unsaved progress.

**Done when:** the Arcade works from the production static deployment and save
recovery has been tested with more than one player-provided game.

### 2. Shared player-state foundation

- [ ] Define a Dropbox folder and document schema for current settings, saves,
      Pokémon data, collection progress, rewards, inventory, decorations, and
      per-zone state.
- [ ] Implement Dropbox OAuth 2.0 PKCE, logout, token recovery, and scoped
      access suitable for a static application.
- [ ] Define ownership and mutation rules for raw saves, extracted Pokémon, and
      derived Pokédex/collection data. Validate every import and export through
      `pkhex-wasm` where its verified capabilities apply.
- [ ] Make synchronization explicit and show the last successful synchronization
      state.
- [ ] Define shared contracts for rewards and decorations without deciding
      unverified gameplay rules prematurely.

**Done when:** the same account can restore its current site state and saves in
a fresh browser session.

### 3. Splash screen, map, Camp, and Lab

- [ ] Build the splash screen and Start flow.
- [ ] Build the explorable map with all six selectable areas, keyboard and
      pointer navigation, accessible labels, and stable deep links.
- [ ] Establish the shared visual language and reusable area/activity shell.
- [x] Build the Gen 3 Camp proof of concept for importing, inspecting, and
      organizing save-box and Camping Pokémon.
- [x] Add local save export to the Camp (download the current Gen 3 `.sav`).
- [ ] Add Dropbox persistence to the Camp.
- [ ] Expand the Camp's working save support beyond Gen 3.
- [x] Add the Camp trade corner using the verified switch.gblink.io/device
      approach, including connection, permission, progress, cancellation, and
      recovery states.
- [ ] Build the Lab's Pokédex and collection sheets from derived save and
      Pokémon data.
- [ ] Move account, data-management, compatibility, and accessibility options
      into the Lab while keeping patch notes available there.

**Done when:** a player can enter through the splash screen, navigate the full
map, manage a save in Camp, connect through the verified hardware flow, and see
the resulting collection progress in the Lab.

### 4. Battle Zone economy and cross-zone rewards

- [ ] Design the currency, reward, purchase, inventory, and refund rules.
- [ ] Build the Battle Zone shop for browsing, buying, and inspecting items and
      decorations.
- [ ] Define how decorations are equipped, limited, previewed, and stored.
- [ ] Add an auditable transaction model so crashes or synchronization conflicts
      cannot duplicate or destroy purchases.
- [ ] Connect equipped decorations to stable inputs consumed by Safari and
      Pelego rather than embedding zone-specific rules in the shop.

**Done when:** a purchase persists across sessions and an equipped decoration
can safely alter a test activity through the shared contract.

### 5. Safari and Pelego custom GBA games

- [ ] Specify the Safari game's catching loop, encounters, rewards, and the way
      decorations influence appearances.
- [ ] Specify the Pelego game's expedition loop, idle-time rules, assignments,
      rewards, and the way decorations influence expeditions.
- [ ] Build or integrate the two distinct ROM hacks without shipping copyrighted
      base ROM data.
- [ ] Define and version the data exchange format between each ROM save and the
      website for Pokémon, rewards, decorations, timestamps, and metadata.
- [ ] Run both games through the shared emulator adapter and reuse the Arcade's
      save backup and recovery path.
- [ ] Validate all imported results before committing them to shared player
      state, and make interrupted exchanges recoverable.

**Done when:** both custom games run in the deployed browser client, consume
decorations, return validated progress or rewards, and resume from Dropbox-backed
saves.

### 6. Post-MVP release hardening

- [ ] Publish a tested support matrix for browsers, devices, adapters, ROM/save
      formats, and accessibility/input modes.
- [ ] Add automated tests for state schemas, transactions, emulator lifecycle,
      and data adapters; retain real-device checks for hardware paths.
- [ ] Verify privacy behavior, OAuth scopes, permission prompts, local data
      cleanup, and recovery from revoked access.
- [ ] Complete license and attribution review for code, firmware integrations,
      sprites, music, fonts, and custom-ROM assets.
- [ ] Add actionable diagnostics for emulator, Dropbox, save-parser, and device
      failures without exposing player data.
- [ ] Verify production builds and GitHub Pages routing on every release.

## Open decisions

The following are deliberately unresolved and should become requirements only
after a documented decision or working spike:

- The exact capabilities and supported formats of mGBA WASM, plus the verified
  generation/format matrix for the `PKHeX.Facade`-backed adapter beyond Gen 3.
- Whether any ROM persistence beyond the local browser is appropriate.
- The long-term representation and provenance model for Pokémon outside a save.
  The current Gen 3 proof of concept stores standalone `.pk3` bytes in
  configurable 30-slot browser-local boxes; Dropbox, other `.pk*` formats, and
  account-level identity remain unresolved.
- Reward sources, prices, progression balance, and decoration effects.
- Safari and Pelego mechanics and their website/ROM data exchange protocol.
- Dropbox conflict policy, storage limits, retention, and multi-device behavior.
- The minimum supported browser/device matrix for emulator and hardware features.

## Verification gates

- `npm run build` succeeds and the deployed GitHub Pages site loads its routes,
  workers, WASM, and static assets from the correct base path.
- mGBA: a real player-provided ROM and save complete the Arcade exit gate.
- `pkhex-wasm`: representative supported saves survive parse, edit, export, and
  reopen checks before it is trusted for player data.
- Dropbox: login, save, and restore pass in a clean browser profile.
- Hardware: the documented flow passes on real supported GBA/Switch hardware;
  mocks alone cannot close the milestone.
- Content: no deployed artifact contains a commercial ROM or unlicensed asset.
