# Game-first restructure implementation plan

Status: implementation underway. The agreed behavior is in [RESTRUCTURE_PLAN.md](./RESTRUCTURE_PLAN.md); service boundaries are in [RESTRUCTURE_ARCHITECTURE.md](./RESTRUCTURE_ARCHITECTURE.md). Recommendations below do not silently turn the remaining open questions into agreed decisions.

Implemented so far:

- Phase 1 foundation: one validated route parser/URL builder, History API navigation with shared leave guards, real static Hub/Camp/Lab entries, canonical Camp redirects, setup gating, invalid-route redirects, no-game Arcade disabling, and direct Arcade exit to the selected-game Hub.
- Phase 2 service layer: one lazy, retryable PKHeX runtime shared by the existing context bridge, plus a tested `activeGame` service that owns committed and draft save/Camp state; deduplicates selection loads; supports no-game, box/site edits, save/Camp transfer, import/export, resize/clear, replacement/removal/restore, and secondary-save operations; reports partial commits; retains failed work; rejects stale provider/selection completions; and publishes successful changes. Route selection now hydrates the service, provider changes clear it and return to Start, and startup no longer prefetches every save.
- Phase 3 service layer: a shared `collections` service now scans the committed selected save plus Camp Sites, incrementally replaces only rescanned-source matches, preserves other-game matches and ownership history, retains unreadable Camp positions, and reacts to active and secondary save changes. It owns enabled collections, two-item recency, overflow, aggregate progress, and per-collection entry/match/query/filter/mobile-tab/scroll session state. Stored results use the new migration-free format with OT/ID match summaries. The existing PC consumes a transitional service adapter and no longer offers source exclusions.

- Pages from [RESTRUCTURE_DESIGN.md](./RESTRUCTURE_DESIGN.md): Start, Hub, Lab menu, PC, Transporter, Research Tools and its three tool pages, Settings (with an Arcade tab), Patch Notes, Camp (`move`, `campsite`, `trade`) and the Arcade player's header are built on the shared frame (`SitePage`, `PageHeader`, `SiteCard`, `Panel`, `OptionGroup`, `Dialog`). Camp runs on `activeGame` drafts. See [ARCHITECTURE.md](./ARCHITECTURE.md).

Still transitional: Trade mode uses `useTradeSession`, which writes storage directly (Camp reloads `activeGame` afterwards), so Phase 6's `device` facade and `activeGame`-routed trades are not complete. The Settings Arcade tab is not addressable by `&tab=arcade` (routing is read-only for AI). The Arcade key bindings still live in `localStorage` rather than `storage`. `ArcadeMain.tsx` is removed; `scripts/verify-game-choose.mjs` (formerly `verify-arcade-chooser.mjs`) checks Start selection and direct Arcade entry.

## Outcome and boundaries

The player selects a game once on Start, then visits Hub, Camp, and Lab within one application lifetime. The selected save and Gen 3 Camp Sites stay in memory. Every save/Camp mutation goes through `activeGame`, which owns persistence and publishes changes. Camp retains explicit Save and discard confirmation. Arcade remains a separate document with its own service instance and isolation scope.

Data migration and backward compatibility with pre-restructure app data are out of scope: only the developer has used the app so far. Storage layouts, settings, and collection-result formats may change without legacy readers, conversion jobs, or backfills. Use defaults or a fresh baseline for incompatible old app data. This planning decision does not delete any existing files. Keep support for Dropbox and browser storage, valid game-save/ROM imports, and correctness of Camp positions and new-session data. Starting a new Arcade game without a save remains deferred. This work does not add support for generations the current editors/emulator cannot handle.

## Layout brief from the desktop and mobile sketches

Source: three sketch photos supplied on October 20, 2026, covering Start, Hub, Camp, and the Lab landing menu. Use these compositions when implementing the corresponding phases. The sketches establish layout direction; unclear labels, control behavior, and percentage markings remain open below. They do not replace the agreed routes or service boundaries.

### Shared page frame

- Hub and zone headers show Back on the left, the selected game name beside it, the page/zone title in the header, and GitHub/Dropbox badges on the right. The drawings use a tab-like angled edge around the title/header area; carry that visual direction into the shared frame.
- On mobile, retain the same context and navigation in a compact header. The selected game is context, not another game picker. With no game selected, avoid showing a stale game name; exact empty-state wording remains a copy choice.
- Use responsive CSS for the same page and service state rather than separate desktop/mobile routes. Resizing must preserve the draft, selected Pokémon, selected box/site, and remembered PC entry.
- Choose breakpoints from available content space and verify intermediate widths, landscape phones, and browser zoom. Treat the supplied percentages as provisional proportions until clarified; do not hard-code viewport heights from them.
- Keep touch targets usable, icon actions accessible by name, visible keyboard focus, and important controls reachable without sideways page scrolling. Do not infer that the pencil drawings require icon-only labels everywhere.

### Start / select game

- Desktop: a centered “Select a game to start” heading, five Gen 3 game cards arranged as a compact group with two cards above three, and a wide Continue action beneath. Keep the layout spacious rather than stretching cards across the entire viewport.
- Mobile: the same heading and five cards in a compact wrapping grid, followed by Continue. Preserve card information/actions at small widths rather than scaling the desktop drawing down as an image.
- Reuse the GBA cartridge designs already built in `ArcadeMain.tsx` and `arcadeZone.css`, extracting shared presentation before removing the Arcade chooser. Keep save/ROM availability states; omit trainer name and trainer ID for now. Do not add trainer-summary persistence for this phase.
- The five drawn cards are Ruby, Sapphire, Emerald, FireRed, and LeafGreen. Use these as the initial visible roster; any treatment of other generations stays outside this layout until explicitly decided.
- Include the credits and the “Continue without save” action from the sketch, alongside the License link and top-right GitHub/Dropbox badges. “Continue without save” means the existing no-game Hub state; it does not start an empty selected-game save. Retain the first-run setup dialog. This clarification supersedes the earlier proposal to replace the credits block with only a License link.
- Selecting a cartridge with a save continues to that game's Hub. Selecting one without a save changes the Start page to a game-specific acquisition screen offering save upload from a file or save retrieval from a connected device, reusing the existing acquisition workflow. Validate and persist through `activeGame` before continuing to Hub; cancel returns to game selection.
- Keep save acquisition and ROM acquisition separate. Adjust the cartridge controls to provide distinct save/ROM actions; the ROM button opens a dialog offering a file upload or a ROM read from GBA. ROM import validates the chosen game and persists through storage; it must not trigger cartridge navigation, replace a save, or require changing the active game. Device access goes through `device`.
- Read availability through provider-scoped status queries rather than parsing every save on Start. Expose loading/error/cancellation states for both acquisition paths.

### Hub

- Desktop: use an asymmetric map-like group of large rounded destination panels: Arcade on the left, a larger Camp panel on the right, and a wide Lab panel below. Keep generous whitespace and the shared game/header context.
- Mobile: arrange Arcade and Camp side by side with Lab as a wide panel below. Reflow further if the available width cannot support readable labels and touch targets.
- The sketch proportions describe hierarchy, not additional navigation. Each panel remains a single destination; Arcade retains the agreed disabled state when no game is selected.

### Camp

- Desktop `mode=move` and `mode=campsite` always show two grids. With a game selected, the left grid always displays that active save's boxes; the right grid displays another box from the same save in Move, or Camp Sites in Campsites. Each grid has its own title and previous/next navigation.
- In `mode=trade`, keep the selected save's boxes on the left and put the trading section on the right. The detailed trading section is not drawn yet; its placement is confirmed.
- The bottom-right selector offers “Boxes” (`mode=move`) and “Campsite” (`mode=campsite`); it changes the route mode, not the selected game. The bottom-left Trade button enters `mode=trade`.
- The center controls select the existing interaction types: **View**, **Move**, and **Group** (`view`, `moveOne`, `groupMove` in `PokemonStorageView.tsx`). Keep these separate from the URL's `move|campsite|trade` modes; changing an interaction type does not navigate to a different Camp mode.
- Mobile: stack the existing interaction content vertically. Keep the active-save/source grid first. In **View**, show the existing Pokémon detail content beneath that grid. In **Move** and **Group**, show the second box/Camp Site grid beneath the first grid. Preserve the existing View/Move/Group interactions; use vertical scrolling rather than a source/destination side switch. Keep box/site navigation, Save, mode selection, and Trade accessible. Preserve held Pokémon/group selection while scrolling or changing boxes/sites.
- The header retains Back, selected game, Camp, and the two global badges. Save remains explicit and the dirty state must remain visible even when the action controls move for mobile.
- The selected-save left grid applies when a game is selected. With no game, preserve the agreed Camp Site editing and device/Camp Site trading behavior; do not fabricate a save. The precise no-game trading composition is not supplied by these sketches.
- Changing the displayed side, box, site, or interaction type must not itself discard or commit a draft. Route-mode transitions that discard edits still use the shared confirmation guard. Drag-and-drop alone is insufficient for the mobile layout.
- Detailed Pokémon-detail and trade-section controls are not supplied; preserve required functionality without treating an invented composition as approved.

### Lab landing menu

- Desktop: a large PC / Collections panel on the left; Transporter and Research Tools panels stacked on the right; Settings below that stack; a smaller Patch Notes tile near the lower left.
- Mobile: use a compact two-by-two panel arrangement for PC, Transporter, Research Tools, and Settings. Keep full accessible names even if visible labels are shortened. Show Patch Notes as a simple hyperlink, like License, rather than another tile.
- Transporter stays a top-level Lab destination. Its panel position follows the supplied composition; do not interpret the earlier “top of the menu” wording as requiring it to displace the large PC panel.
- These sketches cover the Lab landing menu only. The collection/PC page and Research Tools page layouts are pending the user's next drawings. Keep their route and data/service work planned, but defer decisions about their internal layout.
- Settings, individual research tasks, transporter, and the Arcade player do not have detailed new layout references in this batch.

### PC / collection page

Source: PC desktop/mobile sketch supplied on October 20, 2026, plus the accompanying tab behavior.

- Opening PC immediately restores the most recently viewed collection. This extends the already agreed in-app PC memory: ordinary Hub/Camp/Lab navigation preserves it, while refresh, Arcade, and account changes clear it. Unless clarified otherwise, the first PC visit in a new app session falls back to the first available built-in collection.
- The collection switcher is a tab strip. It shows the current collection first, the second most recently viewed collection second, an overflow `…` control for other collections, and a `+` control. Selecting another collection updates the recency order without changing the URL.
- The `+` control opens a dialog with a multi-select over every collection definition currently available to the app. Checked collections are enabled in the PC; unchecking disables them. Apply the selection as one action, keep at least one collection enabled, and fall back to the most recently viewed remaining collection if the current one is disabled. This is collection visibility management, not the old JSON-upload flow.
- The current and second-most-recent tabs are drawn only from enabled collections. The `…` control lists all other enabled collections outside those two tabs. Opening one promotes it to current, shifts the prior current to second, and moves the displaced tab back into `…`.
- A total research-progress tracker spans the top of the PC workspace. Its numerator is the sum of registered items across every enabled collection and its denominator is the sum of all items in those collections. The tracker is independent of the currently selected collection; entries repeated in separate collections count once in each collection's contribution.
- Desktop uses a stable split view below the tracker. The left pane contains the collection tabs, searchable/filterable entry list, status marks, and scrolling. The right pane shows the selected entry and one matching Pokémon at a time. Selecting a row updates the right pane without replacing the entire PC page.
- The right viewer places the Pokémon image in the upper-left area, followed by the entry's Pokédex number and species name. Beneath the name, list collection constraints beyond species when applicable. Do not repeat species as an additional constraint.
- The viewer's middle section shows data for the matching Pokémon: Nickname, OT, ID, level, and species. When an entry has multiple matches, left/right arrows change the displayed match while keeping the entry selected. Preserve the displayed match index when the user switches between desktop/mobile layouts or moves between the mobile tabs, and clamp it safely when a rescan changes the match count.
- The viewer's bottom section has one “View in Camp” link for the currently displayed match. Selected-game save matches open the relevant box in `mode=move`; Camp Site matches open the relevant site in `mode=campsite`; another game's save match remains visible but the link is disabled with an explanation.
- Mobile retains the collection tabs and total tracker, then uses an explicit **List / View** tab toggle. List contains the searchable collection entries; View contains the same selected-entry/match viewer used on desktop. Selecting an entry switches to View. Returning to List preserves collection, query/filter state, selected row, and scroll position. Do not squeeze the desktop split panes side by side.
- Search stays with the entry list. Preserve keyboard list navigation, visible selection, status filters, loading/partial/offline messages, and accessible names for the symbolic `…` and `+` controls.
- The sketch replaces the current collection dashboard as the normal PC entry point. Per-collection progress, rebuild/reset, source errors, and collection metadata still need accessible placement, likely in a compact options area rather than a separate dashboard; final placement is not established by the drawing.

### Sketch clarifications pending

Whether the percentage markings are exact targets remains unanswered. Until clarified, treat them as approximate layout guidance. Detailed trade-section layout remains open; the mobile Move/Group grid layout and View detail placement are now confirmed. The PC match viewer, mobile List/View toggle, two-recent-tab behavior, enabled overflow, and collection enable/disable dialog are confirmed. PC recency remains in app-session memory under the earlier agreement.

Confirmed answers are incorporated above: desktop grids and mode selector, existing View/Move/Group interactions with vertically stacked mobile details/destination grids, existing cartridge design, no trainer fields, separate file/device save acquisition and file/GBA ROM dialog, credits, and desktop/mobile Patch Notes placement.

Record answers here and in the affected phase before implementing dependent behavior. Collection and Research Tools layout sketches are expected separately; their absence does not block service, routing, or the supplied landing-page layout work.

## Decisions to settle before their dependent phase

| Decision                           | Recommended implementation                                                                                                                                                                                                                                                                            | Needed before                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Routing                            | URL-driven navigation shared by Start/Hub/Camp/Lab; normal transitions use history entries, redirects replace them. Centralize route parsing, URL building, and guarded navigation in page glue. Prove Back/Forward cancellation before choosing a custom history adapter versus a router dependency. | Phase 1                       |
| Static hosting                     | Build real `hub/index.html`, `camp/index.html`, and `lab/index.html` entries loading the common app; retain the existing separate Arcade entry. Internal navigation stays client-side.                                                                                                                | Phase 1                       |
| Service access                     | Shared module-level services with stable snapshots, subscriptions, and React `useSyncExternalStore` hooks. PKHeX initialization becomes shared and lazy; pages stop acquiring adapters.                                                                                                               | Phase 2                       |
| Draft ownership                    | `activeGame` owns a committed baseline and an isolated Camp draft. Discard restores the baseline without fetching; only successful persistence advances the committed revision. Collections scan committed state.                                                                                     | Phase 2                       |
| Other-save operations              | Explicit service methods can read/write a secondary save for trades or backup management without changing the selected game. These operations are not ordinary page-navigation reads.                                                                                                                 | Phase 2                       |
| Cache refresh and conflicts        | Reload on fresh document startup, selection change, or storage/account change. Ordinary zone transitions reuse memory. Preserve Arcade's fresh persisted-byte comparison before a write; expose it through `activeGame`, never satisfy it from the session cache.                                     | Phase 2, finalized in Phase 8 |
| Missing save on a direct zone link | Return to Start with the requested game so upload can finish there; do not invent an empty save or silently enter new-game Arcade mode.                                                                                                                                                               | Phase 4                       |

The roster contains games beyond Gen 3; current Camp and Arcade flows use Gen 3. The Start sketch shows the five Gen 3 games. Use an explicit supported-game list shared with route validation; recognized but unsupported games must not accidentally reach Gen 3 editors. Do not add other-generation cards to the supplied composition without a separate decision.

## Phase 0 — Baseline and contracts

- Record the current build/test/lint results and navigation, Arcade, and hardware verification behavior. Separate existing failures from regressions.
- Inventory save/Camp reads and writes in `SaveViewer`, `LocalPokemonView`, `GbaSavePanel`, `TradeSelectionPanels`, `useTradeSession`, `useSettingsForm`, `CartridgeSaves`, `ArcadePlayer`, and `tradeDevice/localTradeDevice.ts`.
- Inventory direct PKHeX/device imports across pages, including hooks and nested components; those are consumers to migrate, not just zone entry points.
- Define the route table, service snapshot types, draft lifecycle, change event shape, and supported-game list before wiring screens.
- Use the layout brief above for shared header, card, destination-panel, and responsive grid requirements. Resolve each sketch clarification before its dependent UI work; do not wait for PC/Research Tools drawings to begin independent service work.
- Review existing `ai-permissions.toml` boundaries before application edits. The existing note mentions `Campsite.tsx` and a root build file, but the planned scope also reaches `src/App.tsx`, `src/pages/context/*`, root HTML/package/scripts, and new static entry directories. Resolve applicable write restrictions for the concrete files touched, without widening permissions repository-wide.

Acceptance: baseline recorded; every current save/Camp writer has a migration destination; proposed contracts distinguish committed data from drafts and active saves from secondary saves.

## Phase 1 — Routing and static entries

Primary areas: `Campsite.tsx`, `NavigationProvider.tsx`, `navigationGuard.ts`, new page-level route helpers, `vite.config.ts`, and HTML entry points.

1. Add one parser/URL builder for `/`, `/hub/`, `/camp/`, `/lab/`, and `/arcade/`, relative to `BASE_URL`. Validate game and mode values, including supplied modes on pages that do not support them. Specify duplicate/empty parameter handling in tests. Settings tabs are `backups|appearance|storage|hardware`.
2. Encode redirects: setup incomplete → Start; unknown game/mode → Start; Camp without mode → `move`; no-game `campsite` → `move`; no-game Arcade → no-game Hub. Preserve the game on valid links.
3. Centralize navigation confirmation. Check before changing the route or selected game, unmounting the editor, or discarding a draft. Include Exit, mode switches that discard edits, Back to PC, badges, account actions, and browser Back/Forward. Avoid duplicate prompts from nested callers.
4. For history cancellation, restore the previous history position/URL while preserving the mounted editor and draft. Guard restoration events so they do not prompt again. Keep the native unload warning for refresh, close, and document navigation.
5. Add static entries and Vite inputs for Hub/Camp/Lab. Preserve Arcade's isolation service-worker and mGBA worker scope; isolation must not extend to other zones.
6. Keep old screens usable through temporary adapters until the later phases replace their internal navigation. Decide how to handle the existing `?zone=arcade` link explicitly; the final navigation emits only the agreed routes.

Acceptance: direct load and refresh work for every static entry in the built site, including the `/pkcamp/` base. Invalid links and setup redirects terminate without loops. Browser Back/Forward cancellation keeps both editor contents and URL intact.

## Phase 2 — Shared PKHeX and `activeGame`

Primary areas: `services/pkhex`, new `services/activeGame`, storage integration, and transitional context adapters.

1. Expose one lazy PKHeX initialization promise and loading/error/retry snapshot. Keep the existing context as a temporary bridge until all page consumers migrate; avoid a second WASM initialization.
2. Implement `activeGame` selection/loading/error/no-game states. Own raw committed bytes, parsed save, Camp data, revisions, provider identity, and draft state. Pages receive read views and commands, never writable `SaveGame` objects that bypass the service.
3. Deduplicate selection loads. Scope caches and async work to the actual provider/account instance, not just the string `dropbox`. Reject late completions from earlier selections/providers. Dispose replaced parsed saves and drafts exactly once.
4. Add commands for box/site moves, import/export, save replacement/removal, restore, Camp resize/clear, and draft commit/discard. Include explicit secondary-save operations required by trades/settings. Validate uploads inside the service before persistence.
5. Persist through the captured provider, then update the committed snapshot and publish revisioned changes. Retain retryable dirty data on failure; never report a failed write as saved or fall back to local storage when Dropbox fails.
6. Define multi-resource commit results: storage cannot atomically save a save file and Camp Sites, or both ends of a trade. Track which writes succeeded, keep remaining changes retryable, and preserve existing trade recovery behavior. Do not promise rollback that the provider cannot guarantee.
7. On account change, clear provider-specific snapshots and PC session state, then return to Start through the common guard path. A late write must never update another account's current snapshot.
8. Replace startup-wide save prefetching where it fetches unrelated saves. Status cards use metadata/existence queries where available; do not read every save merely to display a badge. Trainer details are deferred; no trainer-summary store is needed. Do not retain the old chooser's all-save byte reads merely to display availability.

Acceptance: a selected save/Camp loads once across repeated Hub/Camp/Lab visits; concurrent consumers share a load. Tests cover no-game behavior, stale loads, provider changes, failed and partial writes, draft discard without fetching, and parsed-object ownership. Strict Mode remounts do not dispose the service's live save.

## Phase 3 — `collections` service and incremental PC history

Primary areas: new `services/collections`, existing `lab/collectionService.ts`, `collectionResults.ts`, `researchSnapshot.ts`, scanners, and PC hooks.

1. Move collection orchestration out of page modules. Retain reusable matching/evaluation code and built-in definitions; expose one service snapshot and hook.
2. Subscribe to committed `activeGame` changes. Coalesce related changes and serialize scans. Capture selection/provider/revisions; ignore stale scan results before publishing or persisting them.
3. Read the selected committed save and Camp from `activeGame`; do not use `loadCollectionSources` to fetch all games. With no selected game, scan only Camp Sites.
4. Merge by source: replace matches and fingerprints only for successfully rescanned sources; retain all other games' prior matches and metadata. Derive owned/seen/unseen from the merged matches and history. Removing the last selected-source match must not erase a valid other-game match.
5. Treat unreadable sources as failed scans, not empty sources. Preserve their previous matches. An explicitly deleted save or successfully emptied Camp is a known-empty source and may clear its matches. Ensure deletion events can update history even when the deleted save is not selected.
6. Define the new stored-result format without converting pre-restructure results. Incompatible old results can start from a fresh baseline. Within the new format, retain other-game matches and first/last-owned dates across incremental scans, handle definition changes by entry identity, and define reset-history behavior under the restricted scan scope. Remove obsolete PC source preferences rather than carrying forward prior exclusions.
7. Store open collection/entry in service session memory. Preserve it across Hub/Camp/Lab navigation; clear it on document reload, Arcade visit, or account change. Do not encode the entry in the URL or browser storage.
8. Track collection recency and the enabled collection set in the same session state. Expose the current and second-most-recent enabled collections as tabs and every other enabled collection through `…`. The `+` dialog updates the enabled set; prevent an empty set and repair recency/current selection when collections are disabled. Retain each collection's selected entry, displayed match index, search/filter state, mobile List/View tab, and list scroll position so switching collection tabs and returning from Camp does not reset the workspace.
9. Derive the total research tracker from all enabled collection results. Keep aggregate calculation separate from the selected collection, recompute immediately after result or enabled-set changes, and avoid a second source scan merely to update the total. Disabled collections contribute neither registered nor total items.

Acceptance: regression fixtures cover preserved other-game matches, selected-source replacement, no-game scans, removal/deletion, unreadable sources, fresh-baseline handling, definition changes, stale async runs, aggregate progress, session recency, match-index clamping, and restoring per-collection UI state. Ordinary updates never fetch unrelated saves.

## Phase 4 — Start and Hub

Primary areas: `StartMenu.tsx`, `WorldMap.tsx`, `useHubStartup.ts`, `DropboxMenu.tsx`, extracted cartridge components/styles from `ArcadeMain.tsx` / `arcadeZone.css`, existing save/ROM acquisition panels, and hub CSS.

- Replace Start with the existing GBA cartridge designs and “Continue without save.” Show save/ROM status without trainer name/ID or another game picker in the zones. Retain loading, retry, and first-run sprite-source selection.
- Follow the supplied five-cartridge desktop group and compact mobile grid; place Continue without save beneath them, and retain credits and License. Separate save/ROM acquisition controls from the cartridge's navigation target; do not nest interactive buttons inside a cartridge button.
- On selection, use `activeGame`; if there is no save, change Start to the selected-game acquisition screen with file upload and existing device-read options. On success, validate and persist through `activeGame`, then enter that game's Hub. Cancellation returns to selection; failed/invalid reads or uploads stay recoverable without replacing valid data.
- The separate ROM button opens a file/GBA acquisition dialog. Reuse device read/import capabilities through `device` and store ROMs through storage. Validate the ROM/game, show progress/cancellation, and update cartridge availability without navigating to Hub. Extract acquisition UI rather than requiring a detour through Research Tools.
- Start now depends on `device` as well as `activeGame` and storage. Implement the acquisition subset of the facade in this phase (ahead of Phase 6's remaining migrations); do not introduce temporary direct page imports of the underlying hardware services.
- Continue selects the explicit no-game state while retaining access to Camp Sites. Entering a direct zone link hydrates selection through the same service method after setup validation.
- Hub links carry the game and provide Back to Start. Disable Arcade semantically and visually with no game selected.
- Build the shared selected-game header and asymmetric Hub destination panels from the layout brief. On mobile, Arcade/Camp share a row and Lab spans the row below when space permits.
- Retain the requested credits and License link. Keep GitHub and Dropbox badges throughout the app; route Dropbox to Lab Settings / storage using the common guard.

Acceptance: selected-game, no-save upload, upload cancellation, no-game, first-run, and connected/offline provider flows reach the expected routes. Desktop/mobile compositions match the sketches, upload controls do not accidentally navigate, and availability checks do not cause repeated full-save reads. File/device save acquisition and file/GBA ROM acquisition are separate, cancellation is recoverable, and neither ROM action nor a failed acquisition accidentally enters Hub. Loading/status UI remains keyboard accessible.

## Phase 5 — Camp modes

Primary areas: `PokeStorageMain.tsx`, `SaveViewer.tsx`, `LocalPokemonView.tsx`, `PokemonStorageView.tsx`, and trade UI.

- Replace Camp's activity/generation/lodge navigation with route-driven `move|campsite|trade` and a compact mode control.
- Implement two desktop grids for both Move and Campsites: selected-save boxes stay left, and the right grid shows same-save boxes or Camp Sites respectively. In Trade, keep save boxes left and replace the right grid with the trading section. Use the bottom-right Boxes/Campsite mode selector, bottom-left Trade button, and center View/Move/Group interaction controls. On mobile, place View details below the source grid, or stack the destination box/Camp Site grid below it for Move and Group. Reuse the existing interactions and preserve draft/selection state, Save, and box/site navigation across resizing and scrolling.
- `move` with a game edits only that save's boxes; without a game it edits Camp Site boxes. `campsite` shows transfers between the selected save and Camp Sites and is hidden without a game.
- Use service-owned drafts and Save for manual moves/transfers. Pages stop loading, disposing, or mutating parsed saves and stop persisting Camp/save bytes directly. Preserve unreadable Camp entries and stable positions when rewriting readable entries.
- `trade` uses the selected game as its primary save when present; secondary-save/device selection belongs only to the counterpart workflow. Without a game, offer device ↔ device and Camp Sites ↔ device.
- Route backup/settings actions to Lab Settings. Remove Camp Settings and obsolete pickers from the live flow after replacement consumers work.
- Carry initial box/site and the Back-to-PC return target in app memory. Cross-game PC links cannot switch the selection. A direct Camp visit has Exit to Hub.

Acceptance: each mode opens directly for selected-game and no-game routes. Save, discard, cancelled navigation, PC return, and persisted Camp positions work; mode switches cannot drop drafts silently. The existing Move/Group interactions work by touch between vertically stacked mobile grids; View details appear below the first grid. Resizing between desktop columns and mobile stacking, or scrolling between grids, loses neither edits nor selection.

## Phase 6 — `device` facade and remaining writers

Primary areas: new `services/device`, `tradeDevice/localTradeDevice.ts`, trade hooks, `GbaSavePanel.tsx`, Lab cartridge/gift/dump/transporter tools, and settings hooks.

- Wrap existing `tradeDevice`, `gbaSaveDump`, `mysteryGift`, and `pokeTransporter` modules rather than rewriting hardware protocols. Export the operations, state, errors, firmware controls, and cleanup required by pages.
- Route local-save and Camp Site trade devices through `activeGame`, including counterpart save writes. Migrate upload, cartridge read/import, backup restore, deletion, clear, and resize paths.
- Move PKHeX validation/conversion from page hooks into `activeGame`, `collections`, or `device` according to ownership. Pure display types may be shared; pages may not acquire adapters or invoke PKHeX operations.
- Preserve connection ownership, task cancellation, disconnect-on-leave, firmware behavior, and partial-trade recovery. Prevent device/restore operations from racing an active Camp draft without an explicit service policy.

Acceptance: mocked hardware tests and the existing lifecycle verifier pass. All migrated page/device mutations reach the same committed state and change events, including writes to nonselected counterpart saves.

## Phase 7 — Lab navigation and unified settings

Primary areas: `LabMain.tsx`, `LabMenu.tsx`, `ResearchTools.tsx`, `CollectionView.tsx`, `LabSettings.tsx`, shared settings sections, and storage settings types.

- Drive all Lab modes from the route. Label Collections as PC, remove Lab Trade Table, and place PokeTransporterGB at the top of the Lab menu. Research Tools contains Gifts, Cartridge Saves, and ROM/BIOS Dumps.
- Use the supplied Lab landing composition: prominent PC at left, Transporter/Research Tools/Settings at right, and the small lower Patch Notes tile; use four primary panels plus a simple Patch Notes hyperlink on mobile. The PC internal layout now follows the supplied split desktop and list/detail mobile sketch; continue to await the Research Tools drawing.
- Tool Back links return to tools; transporter and the other top-level modes return to the Lab menu; Exit returns to Hub. Settings tabs follow URL changes as well as initial load.
- Consume `collections` snapshots and remembered entry state. Show other-game matches with disabled Camp links and a clear reason; enable selected-save and Camp Site links with the agreed modes.
- Replace the PC dashboard-first flow with the aggregate tracker, recent-collection tab strip, and immediate collection view. On desktop keep the entry list and match viewer mounted side by side; on mobile use the explicit List/View toggle without losing list or match state. Reuse `CollectionGrid` matching/display helpers and `EntryDetails` behavior where they fit, while removing the current nested dashboard → grid → entry navigation.
- Build the match viewer with image, Pokédex number/species name, non-species constraints, Nickname/OT/ID/level/species data, match arrows, and one context-aware View in Camp link. Announce match position (for example, “2 of 3”) and arrow disabled states accessibly.
- Implement `…` as the chooser for enabled collections outside the two recent tabs. Implement `+` as an accessible multi-select dialog for enabling/disabling available collections, with Apply/Cancel behavior and at least one collection required. Keep both controls keyboard-usable and give them explicit accessible labels rather than announcing punctuation alone.
- Consolidate settings into Lab. Backup restores/deletions/site changes use `activeGame`; hardware uses `device`; preferences and ROMs remain storage operations. Avoid a competing top-level active-game selector in Settings; any backup target control is explicitly scoped to backup management.
- Move Arcade key bindings and menu preferences into storage-owned settings with defaults. Do not import legacy localStorage values or maintain old-format compatibility. Updates within the new settings format must preserve unrelated current settings.

Acceptance: every documented Lab mode and settings link is reachable directly; PC return survives ordinary zone navigation. PC opens its latest collection, maintains the two recent tabs, shows aggregate research progress, updates the desktop viewer in place, switches between mobile List/View, pages through matches, and preserves remembered entry/match/query/scroll state across Camp visits. New settings initialize with defaults, preserve unrelated current preferences on update, and synchronize through either storage provider; no legacy-data conversion is required.

## Phase 8 — Arcade integration

Primary areas: `ArcadePlayer.tsx`, `playerMain.tsx`, `arcadeSync.ts`, `arcadeSession.ts`, `keyBindings.ts`, and input/menu hooks.

- Link directly from Hub to `/arcade/?game=…`; remove `ArcadeMain.tsx` and its chooser flow after extracting the cartridge presentation into Start and migrating all callers. Retain shared cartridge assets/styles used by Start.
- Validate setup/game before booting isolation or mGBA. No game redirects to Hub; invalid values redirect to Start. No save follows the Start upload path; brand-new games remain deferred.
- Initialize a document-local `activeGame` for raw save access. Load PKHeX only if the operations used require it. ROMs remain storage reads; settings/input consume storage-owned preferences.
- Preserve the sync driver's ordering, retry, conflict, and exit behavior, but perform save writes through `activeGame`. A conflict check must read persisted data fresh from the underlying provider, including bypassing any provider byte cache; it must compare against the last successful baseline. Keep the game session pinned to its starting provider.
- Exit uses a full load to the selected-game Hub. That fresh app lifetime loads the latest saved bytes and clears PC entry memory. Keep badges compatible with the isolated document and route storage settings through the existing Arcade exit protections.

Acceptance: real mGBA boot/save/retry/exit checks pass; changed persisted bytes cause a conflict rather than overwrite. Arcade isolation works while external sprites remain usable outside Arcade. Missing ROM behavior offers recovery without adding another cartridge chooser.

## Phase 9 — Cleanup and release verification

- Remove transitional contexts, old navigation callbacks, full-library startup scans, direct page PKHeX/device imports, and obsolete live-flow components only after their replacements work.
- Audit production source: current save/Camp writes occur only within `activeGame`; pages import device capabilities only through `device`; route links preserve the selected game. Backup/archive storage writes retain their separate role.
- Update architecture docs, this plan's status, `verify-navigation.mjs`, and Arcade verifiers. Replace chooser checks with Start-selection/direct-Arcade checks and update the `verify:arcade` command.
- Run typecheck/build, lint, unit tests, and the relevant browser verifiers. Inspect generated static entries and test them with a static server that has no SPA fallback. Check keyboard navigation, focus after route changes, small screens, and both storage providers.
- Compare Start, Hub, Camp, and Lab landing against the supplied sketches at desktop/mobile sizes and intermediate widths. Verify long trainer/game names, missing save/ROM states, loading/errors, no-game headers, zoom, touch targets, and accessible icon names. Repeat PC/Research Tools layout verification after their drawings are incorporated.
- Review deployment workflow only if the new build layout requires it. No backward-format readers or data-migration release steps are required. Do not delete existing user files as part of this planning task.

Release scenarios:

| Scenario                                                              | Required result                                                                                                                                                                                                               |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select Ruby → Hub → Camp → Lab → Camp                                 | Ruby stays selected; committed save/Camp are reused in memory.                                                                                                                                                                |
| Continue → Hub → Camp/PC                                              | Camp Sites work; PC scans Camp only; Arcade is disabled.                                                                                                                                                                      |
| Dirty Camp → Exit, mode change, Back to PC, badge, history navigation | One confirmation; cancel preserves URL and draft; discard restores committed state.                                                                                                                                           |
| Refresh/direct entry with valid and invalid parameters                | Static hosting works; setup and validation redirects match the route table.                                                                                                                                                   |
| Save, restore, upload, cartridge import, trade, deletion              | All mutations pass through `activeGame`; committed changes reach PC; failed writes remain recoverable.                                                                                                                        |
| PC result also found in another game                                  | Other-game matches survive rescans and their Camp links remain disabled.                                                                                                                                                      |
| Dropbox unavailable or account changes during an operation            | No silent local fallback, cross-account cache reuse, or stale completion published into the new session.                                                                                                                      |
| Hub → Arcade → save → Hub                                             | Full reload boundary; latest save is loaded; PC entry memory clears.                                                                                                                                                          |
| Another tab changes the Arcade save                                   | Fresh conflict read detects the change; no silent overwrite.                                                                                                                                                                  |
| Resize desktop Camp to mobile and back with a dirty draft             | Desktop columns become vertically stacked mobile content: View details or Move/Group destination grid below the source grid. Edits, held Pokémon/groups, box/site context, and access to Save survive resizing and scrolling. |
| Start/Hub/Lab landing on a phone                                      | The supplied compact compositions remain readable, keyboard/touch usable, and free of sideways page scrolling.                                                                                                                |

## Suggested delivery boundaries

Implement and review in phase order, with Phase 3 after Phase 2 and before enabling the new PC flow. Phase 6 must finish before the final Camp trade flow is considered complete. Phase 7 requires Phases 3 and 6; Phase 8 requires shared save ownership, storage-owned settings, and routing. Keep intermediate adapters until each end-to-end path is migrated, then remove them in Phase 9.

For each delivery, include the concrete user behavior, affected service contracts, relevant test evidence, and any remaining temporary adapter. Do not call the restructure complete while any production save/Camp writer bypasses `activeGame` or ordinary zone navigation still reloads the selected save.
