# pkCamp game-first restructure

## Context

Today the player presses Start, picks a zone, and then picks the game again inside each zone, often after a menu or a lodge picker as well. Each page also re-fetches the save from storage. The restructure has the player pick the game once on the start page, carries it in the URL, opens every zone already focused on that game, and streamlines each zone's menus.

We are working through this one piece at a time. **Piece 1, the site map and navigation, is agreed (below).** Implementation has started with URL routing/static entries and the shared PKHeX/`activeGame` service foundation; the existing Camp and Lab screen internals remain transitional.

The proposed implementation sequence, remaining decisions, and acceptance checks are in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md). It does not change which decisions below are agreed.

Desktop and mobile sketches supplied on October 20, 2026 now guide Start, Hub, Camp, and the Lab landing menu. Their layout brief and outstanding control questions are recorded in [the implementation plan](./IMPLEMENTATION_PLAN.md#layout-brief-from-the-desktop-and-mobile-sketches). Collection/PC and Research Tools page drawings are still pending; no internal layouts for those pages have been agreed.

## Decisions agreed so far

- **No data migration:** only the developer has used the app so far. The restructure does not need to preserve or convert old app storage/settings/PC-result formats. This does not change the save, draft, failed-write, or incremental PC-history guarantees of the new design.

- **Arcade** stays a separate, isolated page at `/pkcamp/arcade/`. Entering or leaving it is a full page load. Its cross-origin isolation would block the external sprite hosts if it applied site-wide.
- **Save handling:** after a game is selected, its save is loaded once and the latest copy is kept in memory. Pages read that copy instead of fetching from storage again. Saving still writes to storage (e.g. Dropbox) and updates the copy. Camp keeps its Save button and its "unsaved changes" confirmation.
- **PC (formerly Collections)** stays merged across games, but an update rescans only the selected save plus the Gen 3 Camp Sites. Matches from the other games carry over from history. With no game selected, it scans only the Camp Sites.

## Piece 1: site map and navigation (agreed)

`{game}` means `game={gameId}` when a game is selected and is omitted when none is.

Every page shows the GitHub and Dropbox badges. The Dropbox badge opens `/pkcamp/lab/?{game}&mode=settings&tab=storage`.

Site-wide rules:

- **Setup gate:** until first-run setup (sprite source) is done, every page redirects to `/pkcamp/`.
- **Unknown values:** an unknown `game=` or `mode=` redirects to `/pkcamp/`.
- **Dropbox sign-in/sign-out** returns to `/pkcamp/` (the select page), as it does today.
- **Unsaved Camp changes:** every way out of Camp (Exit, Back to PC, browser back/forward, the Dropbox badge) asks for confirmation first.

- `/pkcamp/` → Select game
  - "{gameId}" → `/pkcamp/hub/?game={gameId}`
    - If that game has no save, the save-acquisition screen offers file upload or a device read here first, then continues to the hub
  - "Continue without save" → `/pkcamp/hub/` (no game selected)
  - Separate ROM button → ROM uploader dialog (file or GBA), without entering Hub
  - "License" → license link; retain the requested credits
- `/pkcamp/hub/?{game}` → Hub map
  - "← Back" → `/pkcamp/`
  - "Camp" → `/pkcamp/camp/?{game}`
  - "Lab" → `/pkcamp/lab/?{game}`
  - "Arcade" → `/pkcamp/arcade/?game={gameId}` (full page load; **disabled** when no game is selected)
- `/pkcamp/arcade/?game={gameId}` → Arcade player
  - "← Exit" → `/pkcamp/hub/?game={gameId}` (full page load)
  - No game → redirect to `/pkcamp/hub/`
- `/pkcamp/camp/?{game}` → redirect to `&mode=move`
  - `mode=move` (default)
    - With a game: two grids on desktop; selected-save boxes on the left and another box from that save on the right
    - With no game: move Pokémon between Camp Site "boxes"
    - Bottom-right Boxes/Campsite selector → `mode=move|campsite` (Campsite hidden when no game is selected)
    - "Trade" → `&mode=trade`
  - `mode=campsite`: move Pokémon between the save and the Camp Sites
    - Desktop: selected-save boxes on the left, Camp Sites on the right
    - With no game → redirect to `&mode=move`
  - `mode=trade`
    - With a game: selected-save boxes on the left, trading section on the right; trade with another save, a device, or the Camp Sites
    - With no game: device ↔ device, or Camp Sites ↔ device
  - Bottom-left Trade button opens `mode=trade`; center View/Move/Group controls change the interaction type, independently of the route mode
  - Mobile preserves existing View/Move/Group interactions: View details are below the first grid; Move/Group stack the destination box/Camp Site grid below the source grid, using vertical scrolling
  - "← Exit" (from any mode) → `/pkcamp/hub/?{game}`
  - When opened from a PC entry: "← Back" → `/pkcamp/lab/?{game}&mode=collection`, which reopens the remembered entry
- `/pkcamp/lab/?{game}` → Lab menu
  - "← Exit" → `/pkcamp/hub/?{game}`
  - "PC" → `&mode=collection`
    - The open collection and entry are kept in **in-app memory**, not the URL. Moving between Hub, Camp and Lab keeps them; a refresh or an Arcade visit clears them.
    - PC opens the most recently viewed enabled collection. Its tabs show the current collection and second most recent. `…` selects another enabled collection; `+` opens a multi-select dialog to enable or disable available collections. At least one remains enabled.
    - A top tracker shows total registered items / total items summed across all enabled collections.
    - Desktop keeps the entry list on the left and selected-entry match viewer on the right. Mobile uses a List/View tab toggle while preserving both sides' state.
    - The viewer shows the image, Pokédex number and species, additional collection constraints, and the current matching Pokémon's Nickname, OT, ID, level, and species. Arrows page through multiple matches; the bottom View in Camp link follows the displayed match and is disabled for another game's save.
    - "Open in Camp" → `/pkcamp/camp/?{game}&mode=move` (save match) or `&mode=campsite` (Camp Site match, regardless of game; with no game, Camp's own redirect turns it into `mode=move`)
    - Matches in a **different game's save** are shown, but their link is disabled.
  - "PokeTransporterGB" → `&mode=transporter` (promoted out of Research tools)
  - "Research tools" → `&mode=tools`, a menu of the three tools below
    - "Mystery Gifts" → `&mode=gifts`
    - "Cartridge Saves" → `&mode=saves`
    - "ROM/BIOS Dumps" → `&mode=dumps`
    - Each tool's "← Back" → `&mode=tools`
  - "Settings" → `&mode=settings` (site-wide, covering all zones), optional `&tab=backups|appearance|storage|hardware|arcade`
  - "Patch Notes" → `&mode=news` (small tile on desktop, simple hyperlink on mobile)
  - Each mode's "← Back" → the Lab menu

### Removed

- Camp: the activity menu, the generation picker, the lodge/game picker, and Camp Settings (merged into Lab Settings)
- Lab: the Trade Table (trading now lives only in Camp, `mode=trade`)
- Arcade: the cartridge chooser (`ArcadeMain.tsx`)
- Start menu: the Start button (replaced by the existing GBA cartridge designs and “Continue without save”); retain credits and the License link. Trainer name/ID are deferred.

## Pieces not yet discussed

Take these one at a time. Technical choices below remain open; the supplied sketches now give partial layout direction for Start, Hub, Camp, and the Lab menu, as recorded in the implementation plan.

1. Routing mechanics: the router approach, back/forward handling with unsaved Camp edits, and the redirects above
2. Static hosting of `/hub/`, `/camp/`, `/lab/` on GitHub Pages
3. The cached-save design: where it lives, when it refreshes, and the Arcade conflict check
4. Start page: the game cards (save/ROM status), the first-run sprite-source dialog, and the no-save upload flow
5. Camp redesign around `mode=move|campsite|trade`, including no-game behavior
6. Lab menu changes, and merging all settings into Lab Settings
7. The PC rescan-one-save merge logic and its tests
8. Deferred: starting a brand-new Arcade game when the selected game has no save
9. Verify scripts (`verify-arcade-chooser` tests a page being removed) and the ARCHITECTURE docs

Permission note: implementation will need write access to `src/pages/Campsite.tsx` and to one root-level build file. Both are read-only for AI under `ai-permissions.toml`.
