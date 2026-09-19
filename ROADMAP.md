# pkcamp — Browser Pokémon Stadium Hub

## Context

The goal is a single browser-based hub — a modern, full-featured Pokémon Stadium
— unifying save file management, Pokédex tracking, an item shop, two minigames
(Safari Zone, Pelago Zone), and device connectivity (GB-Link cartridges, Switch
via `frlg-ldn-trade`) into one persistent profile. The current `pkcamp` repo
(a static GitHub Pages content site) will be replaced by this app; its existing
content becomes a "patch notes" view inside Options.

The entire system runs **without any cloud backend**: GitHub Pages for static
hosting, WebUSB/WebSerial for direct browser-to-cartridge-adapter
communication, a local Raspberry Pi service (USB gadget Ethernet) for Switch
trading, and Dropbox (OAuth 2.0 PKCE) as the sole data store so the user owns
100% of their data — identity, config, saves, Pokédex progress, decorations,
and shop currency/inventory all live in the user's own Dropbox.

This checklist organizes the confirmed architecture into parallel workstreams
so different areas can be built out independently against the same shared
contracts (Dropbox data schema, pkhex-wasm as sole save-data authority, PiClient
API, narrative runtime).

## Confirmed Architecture

- **Hosting** — single static SPA on GitHub Pages, no cloud backend anywhere
- **Frontend** — React + Vite
- **Game engine** — Phaser (Safari Zone + Pelago Zone canvases only)
- **Narrative/cutscenes** — inkjs, one shared runtime for React and Phaser dialogue
- **Localization** — react-i18next / i18next, JSON catalogs bundled with the app
- **Save editing** — pkhex-wasm embedded as a library, client-side, sole authority
  on raw save data (full edit: Gen 3–7, SwSh, BDSP, SV, Legends Z-A; read-only:
  Gen 1–2, LGPE, PLA)
- **Data & identity** — Dropbox is the entire data store (OAuth 2.0 PKCE, no
  server secret): settings, saves, Pokédex CSVs, decorations, shop
  currency/inventory
- **GB-Link** — WebUSB/WebSerial, direct browser-to-adapter, no server
- **Switch trading** — Raspberry Pi (USB gadget Ethernet), local systemd Python
  service wrapping `frlg-ldn-trade`, HTTP/WebSocket over the tethered USB link,
  LAN-only, single-user, exchanges only commands/metadata/`.pk*`/`.ek*` files
- **Sprites** — sourced from multiple GitHub sprite repos, manually
  license-reviewed per repo

## Workstream Checklist

### 1. Platform / Core Shell
- [ ] Scaffold React + Vite app, GitHub Pages deploy pipeline (CI on push to main)
- [ ] Establish common design language/component library (shared UI kit that
      every section's individual pages build on top of)
- [ ] Build six-section navigation shell (Pokémon, Pokédex, Shop, Safari Zone,
      Pelago Zone, Options)
- [ ] Implement Dropbox OAuth 2.0 PKCE flow (login/logout, token refresh)
- [ ] Define the Dropbox data schema/folder layout (config, saves, Pokédex
      CSVs, decorations, shop file) as a shared contract for all other teams
- [ ] Migrate current pkcamp content into a "patch notes" view under Options
- [ ] Build Options UI alongside the Dropbox integration: sprite-source
      configuration, save-file management, device (GB-Link/Pi) settings

### 2. Save & Data Engine
- [ ] Integrate `pkhex-wasm`, establish it as the sole read/write path for all
      save data (no other component touches raw save bytes)
- [ ] Build save upload/download flow against Dropbox
- [ ] Build Pokémon management UI alongside the save engine: box/party viewer,
      editing, trade/transfer flow
- [ ] Build Pokédex CSV generation/update logic from save reads
- [ ] Define shop/economy save file format (currency + item inventory)

### 3. Minigames (Phaser)
- [ ] Set up Phaser inside the React app (mount/unmount per zone)
- [ ] Safari Zone: catching gameplay loop, zone decoration rendering
- [ ] Pelago Zone: idle collection sim, Pokémon assignment from save data
- [ ] Shared Phaser <-> React state bridge (inventory, currency, decorations)

### 4. Device Connectivity
- [ ] GB-Link: WebUSB/WebSerial client, pairing/connect UI, trade/transfer flow
- [ ] Pi: systemd Python service wrapping `frlg-ldn-trade` (new service, does
      not exist yet), exposing HTTP/WebSocket command API
- [ ] Browser-side PiClient abstraction (connect, status, start/stop trade,
      event subscription) per confirmed design
- [ ] End-to-end trade flow: browser -> Pi -> Switch, `.pk3`/`.ek3` handoff
      into pkhex-wasm

### 5. Content & Narrative
- [ ] Sprite sourcing pipeline: pull from multiple GitHub repos, normalize
      naming/folder conventions, manual license review per source
- [ ] inkjs integration as the shared narrative runtime (React + Phaser)
- [ ] Author initial cutscenes/story progression flags
- [ ] i18n setup (react-i18next), initial translation catalog structure
- [ ] Build Pokédex UI alongside content/narrative work: completion view,
      per-entry detail, tied into cutscene/story flags where relevant

### 6. Shop / Economy
- [ ] Shop UI: browse/purchase items against Dropbox-stored currency/inventory
- [ ] Decoration application to Safari Zone / Pelago Zone from purchased items
- [ ] Currency-earning hooks from gameplay (Safari Zone, Pelago Zone)

## Cross-cutting (applies to every workstream)
- [ ] Each component gets its own test plan defined at detail/implementation time
- [ ] Pi/device security hardening is explicitly out of scope for this project

## Verification
- No traditional backend exists to "run" — verification is per static deploy:
  `npm run build` succeeds and the GitHub Pages deploy serves the SPA
- Dropbox auth: manual OAuth PKCE flow test (login, token refresh, logout)
- pkhex-wasm: round-trip test (load a real save, edit, export, confirm byte-level
  correctness) before trusting it as sole save-data authority
- GB-Link: manual hardware test against a real adapter
- Pi: manual hardware test over USB gadget Ethernet with a real trade
