# pkCamp product plan

pkCamp is a static, browser-only Pokémon activity hub inspired by Pokémon
Stadium. A player enters through Start, chooses a zone, manages or brings in
Pokémon and saves, explores collections and games, earns items/decorations,
and uses those rewards in later activities. Dropbox connects supported player
data across sessions; manual downloads remain a recovery path. The product
must work without a project-owned application server.

## Hub

Start provides one clear entry action, optional Dropbox access, first-run
sprite selection, and project credits. Account restoration and settings load
before entering; save and sprite prefetch runs in the background. The world
map connects all six zones, exposes account status, and provides a subdued
return to Start. The map should eventually support exploration, accessible
keyboard/pointer interaction, and stable URLs while preserving cross-zone
return state.

## Camp Zone

Hayley's campsite/ranch is the workspace for saves and Pokémon. Platform-era
lodges contain fixed game Cabins, with Gen 3 first and other formats enabled
only after their readers/writers are verified. Players inspect positional
parties/boxes, organize supported box Pokémon and Camp Sites, and explicitly
save each changed area. Camp Sites hold standalone Pokémon without silently
repacking them. Imports and cartridge restores must match the selected game.

The Trading Post connects committed saves, Camp Sites, physical GBA hardware,
and supported Switch workflows through one device boundary. Capability checks,
permissions, progress, cancellation, backups, and recovery must reflect what
each device can actually do. A future Transfer Station and emulator handoff
should reuse shared data contracts. Detailed scope and unresolved decisions
are in the [Camp plan](src/pages/pokestorage/PLAN.md).

## Lab Zone

Celio's laboratory turns committed saves and Pokémon into Pokédex and
collection research. Built-in and uploaded definitions describe what entries
require; scans produce rebuildable owned/seen/unseen records with history and
source locations. A player can visit a matching Cabin box or Camp Site and
return to the same entry. Unsaved editor changes do not count toward research.

The Trade Table shares Camp's trade engine, and Settings manages the same
account, backups, appearance, and data. Patch Notes remains reachable. Research
Tools begins with Mystery Gifts only after supported delivery contents,
games/devices, data sources, and failure/recovery behavior are specified.

## Battle Zone

The Battle Zone is a shopping district for items and decorations. Its economy
needs explicit currency, earning, pricing, purchase/refund, inventory, and
equipment rules. Transactions must persist safely without duplicating rewards
or losing purchases during interruptions or conflicts. Equipped decorations
should expose documented effects to other zones rather than embedding their
gameplay rules in the shop.

## Safari Zone

The Safari Zone runs a custom GBA catching activity through the shared emulator.
Decorations influence encounters through verified, versioned inputs. The game's
catching loop, appearances, rewards, and website exchange format need a product
design before implementation. Pokémon and reward results must be validated
before changing account state, with recoverable save/resume behavior.

## Pelago Zone

The jungle-themed Pelago Zone runs a custom GBA expedition/idle activity.
Players assign Pokémon, influence expeditions with decorations, and recover
validated progress and rewards. Idle-time accounting, timestamps, assignments,
and interrupted exchanges need explicit rules. It should reuse Arcade's
emulator and save-recovery integration while retaining its own gameplay loop.

## Arcade Zone

The Arcade lets players run ROMs they supply, with controls/audio, pause/reset,
fullscreen, input mapping, and explicit save import/export/backup. An initial
mGBA WASM spike must prove browser support, supported formats, worker/runtime
loading, lifecycle cleanup, and recovery from the production deployment.
A common emulator boundary should then support Arcade, Safari, and Pelago.
ROM selection defaults to local-only; broader persistence requires a separate
decision. The site must not distribute commercial ROMs or copyrighted base-ROM
content for custom games.

## Shared product rules and organization

Player data should have the same meaning in browser storage and Dropbox.
Parsing/writing belongs to the Pokémon adapter, persistence to storage,
presentation assets to the sprite service, and connections to device/emulator
boundaries. Edits require explicit commits; navigation protects unsaved work
and active tasks. Unreachable cloud storage must not silently redirect writes.
Shared reads must not share mutable editors. API/service contract changes
require the project owner's involvement.

The approved organization direction separates `app/`, sibling zone pages,
shared `features/`, UI/hooks/styles in `shared/`, and framework-free services.
Remove confirmed unused code after preserving reachable behavior. Keep i18n
and move its configuration/catalogs into a site-wide service; translating
inline screen text is a separate follow-up. Multi-device conflict policy,
retention, identity/provenance, reward schemas, sprite licensing/hosting, and
the browser/device support matrix remain design decisions.

## Delivery and documentation

Prove the emulator integration before building the shared Arcade vertical slice
and custom games. Expand data support only with representative-file checks,
then integrate rewards across zones. Release readiness requires deployed-site
checks, fresh-profile account recovery, and real-device evidence in addition
to automated tests; mocks cannot establish hardware support.

[ROADMAP.md](ROADMAP.md) contains only milestone/task checklists.
[ARCHITECTURE.md](ARCHITECTURE.md) and directory architecture documents describe
only current implementation, each limited to one page with one or two
paragraphs and a diagram showing components and important methods. Product
intent and unresolved design belong in plans; task status belongs in roadmaps.
