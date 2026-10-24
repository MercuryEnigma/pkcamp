# pkCamp restructure: service architecture

The site-wide services the restructure is built on. See `RESTRUCTURE_PLAN.md` for the site map. Each service's design is still to be worked out.

## Services

- **PKHeX**: interfaces with PKHeX.Core through PKHeX.Everywhere to handle saves.
- **storage**: the interface for saving data, to Dropbox or, when signed out, to local browser storage.
  - Owns **all settings**: sprite source, PC settings, and (moved from `localStorage`) the Arcade's key bindings and menu settings. Settings are changed only from the Lab Settings page, the start page, or the Arcade's settings menu.
  - ROMs remain a plain `storage` read.
- **sprite**: the sprite resource resolver.
- **collections**: (new) the "Pokédex" collection lists, match lists, details, etc.
- **emulator**: the mGBA runtime, ROM identification, Gen 3 save slots and GBA input.
- **saveLibrary**: the game roster, game ids and game codes. Pure data with no dependencies.
- **i18n**: translations.
- **activeGame**: (new) Manages the active game save, trainer info, pokemon info, campsite info, etc.
  - Has a "no active game" state (the hub's "Continue" with no game): no save, trainer or save Pokémon, but the Camp Sites are still available.
  - **The single entry for changing the save and Camp Sites.** Every page and service (Camp, trades, backup restore, uploads, cartridge reads, the Arcade) updates them through `activeGame`, which writes to `storage` itself.
  - Announces changes to the save or Camp Sites; other services (e.g. `collections`) listen and react.
  - The game is chosen by page-level glue (reading `?game=` from the URL) calling an `activeGame` method, not by a separate navigation service.
  - Proposed, pending confirmation: the Arcade page uses its own `activeGame` for its game, reading the raw save bytes and writing through it.
- **device**: (new) the device service. the interface for handling devices, encapsulating tradeDevice, saveDump, mysteryGift, pokeTransporter.
  - Those four stay as their own modules underneath `device`; pages use `device` rather than importing them directly.
  - The save-backup and Camp Site trade devices read and write through `activeGame`, not straight from `storage`.

## How pages reach services (proposed, pending confirmation)

Each service is one shared module-level object that any code, including other services, can use. Pages get a `useX()` hook that re-renders them when the service changes. PKHeX moves from a React context to this pattern.

## Dependencies

Rule: pages never use `pkhex` directly; only `activeGame`, `collections` and `device` do. Every page also uses `i18n` and `saveLibrary`.

### Pages → services

- `/pkcamp/` → Start (select game)
  - activeGame: pick the game, validate/persist an uploaded or device-read save
  - storage: setup gate, Dropbox, save/ROM status, ROM upload persistence
  - device: save acquisition from a device and ROM acquisition from GBA (separate from file upload)
- `/pkcamp/hub/` → Hub
  - activeGame: which game is active
- `/pkcamp/camp/` → Camp
  - `mode=move` / `mode=campsite`
    - activeGame: save, Camp Sites, Save button
    - sprite
    - collections (future work)
  - `mode=trade`
    - activeGame
    - device: trade devices
    - sprite
    - collections (future work)
- `/pkcamp/lab/` → Lab
  - `mode=collection` (PC)
    - collections
    - activeGame: which game is active, to enable or disable links
    - sprite
  - `mode=transporter`, `mode=tools`, `mode=gifts`, `mode=saves`, `mode=dumps`
    - device
  - `mode=settings`
    - storage: settings, backups, Dropbox
    - activeGame: restore a backup
    - device: hardware/firmware
    - sprite: source list
  - `mode=news`
    - (none)
- `/pkcamp/arcade/` → Arcade
  - activeGame: save
  - storage: ROM, key bindings
  - emulator
  - collections (guide support)

### Services → services

```
activeGame   → storage, pkhex, saveLibrary
collections  → activeGame (listens for changes, reads save), pkhex, storage (results)
device       → activeGame (trades into the save/Camp Sites), pkhex
sprite       → storage (chosen source)
storage      → saveLibrary
pkhex, emulator, saveLibrary, i18n → nothing
```

## Data flow

The main data types moving between pages and services.

```
                         ┌──────────────────────────── PAGES ─────────────────────────────┐
                         │  Start     Hub     Camp     Lab (PC/Tools/Settings)    Arcade   │
                         └──┬──────────┬────────┬───────────┬──────────────────────┬──────┘
           gameId, upload   │          │        │           │                      │
           save bytes       │   SaveView, Camp  │ edits     │ CollectionResult     │ save bytes
                ▼           ▼          ▼        ▼ (moves)   ▼                      ▼ ▲
        ┌──────────────────────────────────────────────┐  ┌─────────────┐   ┌──────────┐
        │                  activeGame                  │  │ collections │   │ emulator │
        │  holds: gameId, SaveGame, Camp               │─▶│             │   │  (mGBA)  │
        └───┬──────────▲──────────┬─────────▲──────────┘  └──┬───────▲──┘   └────▲─────┘
  SaveBytes,│          │SaveBytes,│ SaveBytes│PokemonNode    │Definitions,       │ StoredRom
  Camp      │          │Camp      ▼ ⇄ SaveGame  (trades)     │Results|           │
            ▼          │      ┌───────┐  ┌────────┐          ▼       │           │
        ┌───────────────────┐ │ pkhex │  │ device │◀─▶ hardware   ┌───────────────────┐
        │      storage      │ └───────┘  └────────┘ (bytes, .pk3) │      storage      │
        │ IndexedDB/Dropbox │                                     │ (same service)    │
        └─────────┬─────────┘                                     └───────────────────┘
                  │ Settings (sprite source id)
                  ▼
              ┌────────┐  SpriteRequest (species, form, shiny) ◀── pages
              │ sprite │  SpriteResolution (image URL)         ──▶ pages
              └────────┘
```

| Type                              | What it is                                                      | Moves between                                                                                                |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `gameId`                          | e.g. `'ruby'`                                                   | Start → activeGame (and the URL)                                                                             |
| **SaveBytes** (`StoredSave`)      | Raw `.sav` bytes plus `updatedAt`                               | storage ⇄ activeGame, activeGame ⇄ pkhex, activeGame ⇄ Arcade/emulator, device → activeGame (cartridge read) |
| **SaveGame**                      | Parsed save: trainer, party, boxes, version                     | pkhex → activeGame → pages                                                                                   |
| **Camp**                          | The Camp Sites: Pokémon stored as `.pk3` bytes by site and slot | storage ⇄ activeGame → pages                                                                                 |
| **PokemonNode**                   | One parsed Pokémon                                              | activeGame ⇄ device (trades), pages (details, sprites)                                                       |
| **Edits**                         | Box moves and slot changes                                      | Camp page → activeGame, then on Save → storage                                                               |
| **StoredRom**                     | ROM bytes                                                       | storage → Arcade → emulator                                                                                  |
| **CollectionDefinition / Result** | A PC list and its owned/seen progress                           | storage ⇄ collections → pages                                                                                |
| **Settings**                      | Sprite source, PC settings, Arcade keys                         | storage ⇄ Start, Lab Settings and the Arcade; storage → sprite                                               |
| **SpriteRequest / Resolution**    | Species, form and shiny in; image URL out                       | pages ⇄ sprite                                                                                               |

Two flows define the design:

- **Save path:** storage → activeGame → pages, then back through activeGame → storage when the player saves. Nothing skips past activeGame.
- **Change signal:** activeGame → collections, so the PC rescans when the save or Camp Sites change.
