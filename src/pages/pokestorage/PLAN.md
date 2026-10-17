# Camp Zone product plan

Camp is the safe workspace for bringing Pokémon and saves into pkCamp,
inspecting/organizing them, and deliberately sending validated data to another
activity, backup, or device. It supplies committed data to Lab research and
future emulator activities. It does not define the economy, Safari/Pelago
gameplay, or collection rules. See the [site plan](../../../PLAN.md) for those
zones and the [Camp checklist](ROADMAP.md) for task status.

## Lodges and Cabins

Players choose a platform-era lodge, a supported game Cabin, or Camp Sites.
The roster names games through Gen 9, while formats should become usable only
after their parser, writer, and UI behavior are verified. Gen 3 is the initial
scope. Each game identifier names one active save and ROM slot; filenames must
not create implicit profiles. Multiple profiles and ROM-hack variants require
a separate design.

## Inspection and editing

A Cabin should show positional parties/boxes and the identity, trainer, moves,
stats, ribbons, forms, shiny/egg, item, and ability information the adapter can
reliably provide. View selects details, Move swaps supported individual box or
Camp entries, and Group preserves rectangular selections including empty
positions. Parties remain view-only until legality and capacity rules are
designed. Unsupported edits must stay unavailable rather than guessing.

Manual imports and movement create working copies. Game and Camp edits have
independent Save actions, with clear dirty indicators and navigation/page-exit
protection. Export serializes through the adapter. Corrupt or mismatched input
must not silently replace valid data, and every loaded WASM editor needs an
explicit owner and cleanup lifecycle.

## Camp Sites

Standalone Pokémon live in configurable sites with 30 fixed positions per
site, initially ten sites per generation. Import should prefer the viewed site,
then another empty position; neither import nor resizing should compact data.
Unreadable files still occupy their original positions and should survive
unrelated saves. Shrinking may remove only trailing empty sites. Other file
formats and long-term account identity/provenance need explicit contracts.

## Backups, Dropbox, and appearance

Browser storage and Dropbox must expose the same data model, with account
restore, visible storage status, explicit commits, and manual export recovery.
Unreachable Dropbox should leave unsaved work visible and avoid silent writes
to local storage. Save history, recovery UI, multi-device conflicts, retention,
and limits need further policy. ROM distribution is excluded; persistence
beyond player-selected local ROMs requires a separate decision.

Sprite selection should follow saved preferences across zones and sessions.
Missing variants require honest fallbacks. Shared settings and bounded image
preloading should reduce repeated work without sharing editable Pokémon state.
Production hosting, licensing, attribution, and reproducible asset acquisition
need a defined pipeline.

## Trading and physical devices

The Trading Post should select two compatible sources, preview what moves, and
show device support, permissions, progress, cancellation, and recovery. Stored
trades must target the original selected position and detect changed source
bytes. Device capabilities determine whether received bytes can be returned;
a placeholder must be disclosed when firmware cannot supply them. Reverting
PkCamp writes must never imply undoing a physical-console trade.

Cartridge restores must validate the selected game and preserve the original
cartridge save before overwriting it. GBA ↔ Switch relay is distinct from a
stored-data exchange. Real-device verification is required for each supported
path, including the production deployment; mocked protocol tests alone are
insufficient. Cross-generation transfers and the Transfer Station require
research before implementation.

## Other-zone handoff and release readiness

Lab should derive research only from committed saves and Camp Sites, provide
source locations, and let players visit those locations without losing their
research context. Emulator handoff must identify the game/save, provide an
explicit export/return path, and stage returned bytes for validation instead
of silently overwriting a backup. Rewards remain separate until a shared
product contract connects them.

A dependable release requires safe import/inspect/organize/save/export,
account restore, verified emulator handoff, documented hardware paths, and
rebuildable research after commits. Shared UI/layout extraction and unused-code
cleanup should preserve that behavior. Keep i18n and relocate it into a
site-wide service; the current implementation belongs in
[ARCHITECTURE.md](ARCHITECTURE.md), not in this plan.
