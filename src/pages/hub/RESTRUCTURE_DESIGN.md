# pkCamp restructure: design specs

Page-level design specs for the restructure. See `RESTRUCTURE_PLAN.md` for the site map and `RESTRUCTURE_ARCHITECTURE.md` for services and data flow.

## Design principles

These apply to every page and component in this doc.

- **Responsive web design:** every page and component adjusts automatically to any screen size, from a small phone to a wide desktop. The "Desktop" and "Mobile" layouts in this doc are two reference points, not the only sizes supported. Layouts between them must still work.
- **Prefer flexbox:** use CSS flexbox for layout wherever possible. Use CSS grid only where a true two-dimensional grid is needed, such as the 6 × 5 slot grids or the cartridge grid.
- **Proportions are relative:** the percentages in each page's tables are proportions of the available space, implemented with relative sizing (e.g. `flex` ratios), not fixed pixel sizes.
- **No horizontal page scroll:** content wraps or stacks, rather than overflowing sideways.
- **Simple CSS:** no override chains. Shared pieces (`SitePage`, `PageHeader`, `SiteCard`, `Panel`, `OptionGroup`, `Dialog`) own their styles once, and pages position them with flex ratios or one `grid-template-areas`.
- **Fit the screen:** a page never scrolls as a whole. Long content scrolls inside its own panel.

## Shared page header

Every page uses the same header layout, with a diagonal divider (`//`) that splits the light side from the page name and badges:

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back            {game}           ╱╱ {Page}              (G) (D) │
└──────────────────────────────────────────────────────────────────┘
```

- **← Back**: on the light side, left. Goes to that page's Back target in the site map (e.g. Lab → Hub, PC → Lab).
- **{game}**: the selected game's name, e.g. "Ruby", centered on the light side. Empty when no game is selected.
- **Diagonal divider**: the left edge of the dark block that holds the page title and the badges, like the tab bar of a console menu. It is drawn with `clip-path`, not text.
- **{Page}**: the current page's title, e.g. "Lab" or "PC", in the dark block.
- **(G)**: the GitHub badge. **(D)**: the Dropbox badge, which opens Lab Settings → storage. Both sit in the dark block.

On mobile the header is shorter, with a back arrow only and no game name:

```
┌──────────────────────────┐
│ (←) ╱╱ {Page}   (G) (D)  │
└──────────────────────────┘
```

Page sections below show this header only in their wireframes and don't repeat its spec. In code it is `PageHeader`, and `SitePage` wraps it with the page body.

## Start: select a game (`/`)

The start page reuses the current Arcade cartridge chooser (`ArcadeMain.tsx`, `arcadeZone.css`) and adds a Continue button and the credits. It has no Back button or page tab, only the GitHub and Dropbox badges.

### Desktop layout

```
┌──────────────────────────────────────────────────────────────────┐
│                                                          (G) (D) │
│        ┌───────────────── board, max 52rem ─────────────────┐    │
│        │              Select a game to start                │    │
│        │  ┌──────────┐    ┌──────────┐    ┌──────────┐      │    │
│        │  │   Ruby   │    │ Sapphire │    │ Emerald  │      │    │
│        │  └──────────┘    └──────────┘    └──────────┘      │    │
│        │         ┌──────────┐    ┌──────────┐              │    │
│        │         │ FireRed  │    │LeafGreen │              │    │
│        │         └──────────┘    └──────────┘              │    │
│        │           [ Continue without a save ]              │    │
│        └────────────────────────────────────────────────────┘    │
│  Credits …………………………………………                              License  │
└──────────────────────────────────────────────────────────────────┘
```

- **Board**: the Camp board from the Arcade chooser, `min(52rem, 100%)` wide.
- **Title**: "Select a game to start".
- **Cartridge grid**, as in the Arcade chooser today:
  - a 6-column grid with a **0.85rem** gap;
  - each cartridge spans **2 columns**, so the first row holds three (Ruby, Sapphire, Emerald);
  - the second row holds two, centered (FireRed, LeafGreen).
- **Continue without a save**: a button under the cartridge grid. It goes to the hub with no game selected.
- **Credits**: the credits text, bottom left, below the board.
- **License**: a text link, bottom right, below the board.

#### Cartridge card

The current Arcade cartridge, unchanged:

```
 ╭──────────────────────────╮   ← top ridge in the game's color
 │      GAME BOY ADVANCE    │
 │ ┌──────────────────────┐ │
 │ │        Ruby          │ │   game name, in the game's color
 │ │                      │ │
 │ │      Save ready      │ │   save status
 │ ├──────────────────────┤ │
 │ │      ROM ready       │ │   ROM status
 │ └──────────────────────┘ │
 ╰────────────▼─────────────╯
```

- **Shape**: a GBA cartridge, aspect ratio **12 : 7** (a retail cartridge is about 60 × 35 mm).
- **Label**, in three rows:
  1. the game name;
  2. the save status ("Save ready" / "New game"), which takes the remaining height;
  3. the ROM status strip ("ROM ready" / "ROM needed").
- **Colors**: each game has its own accent, used for the top ridge and the name. Ruby `#b8322a`, Sapphire `#2d5aa8`, Emerald `#23845a`, FireRed `#d0502a`, LeafGreen `#4f8f34`.
- OT/ID details are left out for now.

### Mobile layout

As the Arcade chooser does today:

- **≤ 42rem wide**: two columns. The last cartridge is centered at half width.
- **≤ 28rem wide**: one column.
- **Continue without a save** stays under the grid at full width. Credits and License sit together at the bottom.

## Hub (`/hub/`)

### Desktop layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back   Ruby   ╱ pkCamp ╲                               (G) (D) │
├──────────────────────────┬───────────────────────────────────────┤
│                          │                                       │
│         Arcade           │                                       │ 40%
│                          │               Camp                    │
├──────────────────────────┤                                       │
│        (gap)             │                                       │ 20%
├──────────────────────────┴─────────────┬─────────────────────────┤
│                                        │                         │
│                 Lab                    │    (empty space)        │ 40%
│                                        │                         │
└────────────────────────────────────────┴─────────────────────────┘
            40%                 20%                    40%
```

- **Header**: the shared page header, with Page = "pkCamp" and Back → `/`.
- **Body**, with each button's size as width × height of the body:

| Button     | Position                                          | Size      | Opens                                                 |
| ---------- | ------------------------------------------------- | --------- | ----------------------------------------------------- |
| **Arcade** | Top left                                          | 40% × 40% | `/arcade/?game=…` (disabled when no game is selected) |
| **Camp**   | Top right                                         | 60% × 60% | `/camp/`                                              |
| **Lab**    | Bottom left, with a 20% gap between it and Arcade | 60% × 40% | `/lab/`                                               |

- The bottom-right 40% × 40% is empty.

### Mobile layout

```
┌──────────────────────────┐
│ (←)  pkCamp     (G) (D)  │
├────────────┬─────────────┤
│   Arcade   │    Camp     │
├────────────┴─────────────┤
│           Lab            │
└──────────────────────────┘
```

- Arcade and Camp are square tiles side by side, with Lab as a wide tile below.

## Lab menu (`/lab/`, no `mode`)

### Desktop layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back   Ruby   ╱ Lab ╲                                  (G) (D) │
├───────────────────────────────────────┬──────────────────────────┤
│                                       │       Transporter        │ 30%
│                                       │                          │
│              PC                       ├──────────────────────────┤
│         (Collections)                 │      Research Tools      │ 30%
│                                       │                          │
├──────────────────────────┬───────────────────────────────────────┤
│                          │                                       │
│ Patch Notes              │               Settings                │ 40%
│                          │                                       │
└──────────────────────────┴───────────────────────────────────────┘
              40%                               60%
```

- **Header**: the shared page header, with Page = "Lab" and Back → Hub.
- **Body**, with each card's size as width × height of the body:

| Card                 | Position         | Size      | Opens                                                                                    |
| -------------------- | ---------------- | --------- | ---------------------------------------------------------------------------------------- |
| **PC (Collections)** | Top left, square | 60% × 60% | `mode=collection`                                                                        |
| **Transporter**      | Top right        | 40% × 30% | `mode=transporter`, a page that guides the player through downloading PokeTransporter GB |
| **Research Tools**   | Middle right     | 40% × 30% | `mode=tools`                                                                             |
| **Settings**         | Bottom right     | 60% × 40% | `mode=settings`                                                                          |

- **Patch Notes**: a plain text hyperlink in the bottom-left corner, not a card. Opens `mode=news`.
- The bottom-left area around the Patch Notes link is **intentional empty space**.

### Mobile layout

```
┌──────────────────────────┐
│ (←)  Lab        (G) (D)  │
├────────────┬─────────────┤
│     PC     │ Transporter │
├────────────┼─────────────┤
│  Research  │  Settings   │
│   Tools    │             │
├────────────┴─────────────┤
│ Patch Notes              │
└──────────────────────────┘
```

- **Header**: the shared mobile header, with Page = "Lab".
- **Body**: a 2×2 grid of equal square tiles: PC, Transporter, Research Tools and Settings.
- **Patch Notes**: a text link under the grid.

## PC (Lab `mode=collection`)

The PC replaces the current Collections page: the collection dropdown, the sources picker, and the single-column entry list.

### Desktop layout

```
┌─────────────────────────────────────────┬──────────────────────────────────────┐
│ [Hoenn Dex] [Ribbon Set] [ … ] [ + ]    │          Research progress  412 / 960 │
├─────────────────────────────────────────┼──────────────────────────────────────┤
│                                         │ ┌────────┐  #252 Treecko             │
│   Collection entries                    │ │ sprite │  Constraints:             │
│   (the selected collection's list)      │ └────────┘   · Shiny                  │
│                                         │              · Holds a Leftovers      │
│                                         ├──────────────────────────────────────┤
│                                         │  ◀   Match 1 of 3   ▶                 │
│                                         │  Nickname   LEAFY                     │
│                                         │  OT / ID    MAY / 12345               │
│                                         │  Level      23                        │
│                                         │  Species    Grovyle                   │
│                                         ├──────────────────────────────────────┤
│                                         │  [ View in Camp → ]                   │
└─────────────────────────────────────────┴──────────────────────────────────────┘
```

#### Left: collections

- **Tabs** across the top:
  1. The collection currently being viewed. On entry this is the most recently viewed collection.
  2. The second most recently viewed collection.
  3. **"…"** opens a picker for any other collection; choosing one makes it the current tab.
  4. **"+"** adds a collection, through a pop-up with:
     - a multi-select of the collections that exist but aren't added yet (built-in and uploaded);
     - **collection JSON upload**, moved here from the current page.

     Adding a collection forces an update that scans it right away, and it then counts toward research progress.
- Below the tabs: **search** and the **status filter** (all / registered / …, as today).
- Below those: the **entry list**, every entry in the selected collection as **numbered rows** (e.g. `#252 Treecko`), each with its owned, seen or unseen status. Selecting an entry shows it in the right-hand view.

#### Top right: research progress

- The total research progress tracker: owned and seen, summed over every **added** collection, e.g. `Owned 412 · Seen 57 / 960`.

#### Right: Pokémon view

For the selected entry:

1. **Header** (upper left of the view)
   - The entry's sprite.
   - Next to it: dex number and species name, e.g. `#252 Treecko`.
   - Below the name: any constraints beyond species (e.g. shiny, held item, ribbon, OT). Hidden when the entry has none.
2. **Matches** (middle)
   - The data of the Pokémon that match the entry: **Nickname, OT, ID, Level, Species**.
   - With multiple matches, **◀ / ▶** arrows step through them ("Match 1 of 3").
   - With no matches, the area shows that none are owned.
3. **Link** (bottom)
   - **"View in Camp"** for the current match: `mode=move` for a save match, `mode=campsite` for a Camp Site match.
   - Disabled for a match in a different game's save (per the site map).

#### Proportions (desktop)

| Element                                                  | Size                                               |
| -------------------------------------------------------- | -------------------------------------------------- |
| **Left column** (tabs, search/filter, entry list)        | 40% of the page width                              |
| **Right column** (progress, Pokémon view)                | 60% of the page width                              |
| Collection tab bar                                       | Fixed, about one row high                          |
| Search + status filter                                   | Fixed, about one row high                          |
| Entry list                                               | The rest of the left column's height; scrolls      |
| Research progress                                        | Fixed, about one row high, top of the right column |
| Pokémon view: header (sprite, number, name, constraints) | ~30% of the view's height                          |
| Pokémon view: matches                                    | ~55%                                               |
| Pokémon view: "View in Camp" link                        | ~15%                                               |
| Sprite                                                   | Square, about the header's height                  |

### Mobile layout

There's no room for both columns, so a **tab toggle** at the top switches between them:

```
┌──────────────────────────┐
│ [ Collection ] [ View ]  │
├──────────────────────────┤
│ (the selected tab's      │
│  content, full width)    │
└──────────────────────────┘
```

- **Collection**: the collection tabs ("…", "+") and the entry list.
- **View**: the research progress tracker, then the Pokémon view.
- Each tab fills the full width. The Pokémon view keeps the same 30 / 55 / 15 height split as on desktop.

### Saved and remembered state

- **Saved to storage**, as new collection metadata:
  - which collections are added;
  - the recently viewed order, which drives the first two tabs.
- **In-app memory only:** the selected entry and the current match, so PC → Camp → Back returns to the same place.

## Transporter (Lab `mode=transporter`)

A step-by-step guide that sends (downloads) Poké Transporter GB to the GBA. Poké Transporter GB then moves Pokémon from a Gen 1–2 game into a Gen 3 game. Before that, the player can back up both games' saves. Back → Lab menu.

### Desktop layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back   Ruby   ╱ Transporter ╲                          (G) (D) │
├─────────────────────┬────────────────────────────────────────────┤
│ ① What you need   ✓ │                                            │
│ ② Back up (opt.)  ● │        Active step                         │
│ ③ Send to GBA       │        (instructions, GB-Link task panel,  │
│ ④ On the consoles   │         progress, Start / Stop)            │
│                     │                                            │
│                     │                                            │
│                     ├────────────────────────────────────────────┤
│                     │                         [ ◀ Back ] [ Next ▶ ]│
├─────────────────────┴────────────────────────────────────────────┤
│ Credits: Poké Transporter GB by …                                │
└──────────────────────────────────────────────────────────────────┘
        30%                               70%
```

| Area                | Position              | Size       | Contents                                                                                 |
| ------------------- | --------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| **Step list**       | Left                  | 30% × 90%  | The four steps, numbered, with done (✓) and current (●) marks. Clicking a step opens it. |
| **Active step**     | Right                 | 70% × 80%  | The current step's content (below).                                                      |
| **Step navigation** | Right, under the step | 70% × 10%  | ◀ Back and Next ▶.                                                                       |
| **Credits**         | Bottom, full width    | 100% × 10% | A text line.                                                                             |

**Steps:**

1. **What you need**:
   - two systems, both games, GB-Link, and a Game Boy Color link cable;
   - a collapsible "Which games work?" note.
2. **Back up both games** (optional, recommended): two side-by-side cards, **GB/GBC source** and **GBA destination**. Each has a **Back up** button that opens the GB-Link task panel, then "Download again" once backed up. These backups are download-only, with no "Use as {game}'s save" option (unlike Cartridge Saves).
3. **Send to GBA**: the GB-Link task panel that sends Poké Transporter GB to the GBA, with its steps, progress and Start/Stop.
4. **On the consoles**: the numbered console steps, with the "A GBA link cable will not work" warning.

### Mobile layout

- The step list collapses into a step indicator under the header, e.g. `② of 4 · Back up`.
- In step 2, the two backup cards stack.
- The active step fills the width, with ◀ Back / Next ▶ pinned at the bottom.
- Credits sit under the step.

## Research Tools (Lab `mode=tools`)

A menu of the three cartridge and console tools. Back → Lab menu.

### Desktop layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back   Ruby   ╱ Research Tools ╲                       (G) (D) │
├─────────────────────┬─────────────────────┬──────────────────────┤
│                     │                     │                      │
│   Mystery Gifts     │  Cartridge Saves    │   ROM / BIOS Dumps   │ 60%
│                     │                     │                      │
├─────────────────────┴─────────────────────┴──────────────────────┤
│                                                                  │ 40%
└──────────────────────────────────────────────────────────────────┘
         33%                   33%                   33%
```

| Card                 | Position   | Size      | Opens        |
| -------------------- | ---------- | --------- | ------------ |
| **Mystery Gifts**    | Top left   | 33% × 60% | `mode=gifts` |
| **Cartridge Saves**  | Top middle | 33% × 60% | `mode=saves` |
| **ROM / BIOS Dumps** | Top right  | 33% × 60% | `mode=dumps` |

- Each card shows its title and a one-line description:
  - **Mystery Gifts**: "Send Wonder Cards to a GBA or the Switch."
  - **Cartridge Saves**: "Back up and restore GBA cartridge saves."
  - **ROM / BIOS Dumps**: "Download cartridge ROMs and the GBA BIOS."
- The bottom 40% is intentional empty space, as on the Lab menu.

### Mobile layout

- The three cards stack as full-width tiles, in the same order.

## Research tool pages (Lab `mode=gifts`, `mode=saves`, `mode=dumps`)

The three tools share one layout: choices on the left, the GB-Link task on the right. Back → Research Tools.

### Shared desktop layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back   Ruby   ╱ {Tool} ╲                               (G) (D) │
├──────────────────────────────────────────────────────────────────┤
│ [ Option A ] [ Option B ]                                        │ 10%
├────────────────────────────────┬─────────────────────────────────┤
│                                │  Steps                          │
│  Choices and info              │  1. …                           │
│  (what this does, what to      │  2. …                           │
│   pick, notes)                 │  ▓▓▓▓▓▓░░░░  Reading…  62%      │ 90%
│                                │  Status message                 │
│                                │          [ Start ] / [ Stop ]   │
└────────────────────────────────┴─────────────────────────────────┘
              50%                               50%
```

| Area            | Position        | Size       | Contents                                                                                                          |
| --------------- | --------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| **Task toggle** | Top, full width | 100% × 10% | A segmented toggle between the tool's two options                                                                 |
| **Choices**     | Left            | 50% × 90%  | What the task does, the choices, and notes                                                                        |
| **Task panel**  | Right           | 50% × 90%  | The GB-Link task: numbered steps, a progress bar, a status message, and Start / Stop (plus Cancel while starting) |

**Mobile**: the toggle stays on top. Choices stack above the task panel, and Start / Stop is pinned at the bottom.

### Mystery Gifts (`mode=gifts`)

- **Toggle**: **GBA** | **Switch**.
- **Choices**:
  - the supported games for that hardware;
  - **Choose a gift**: a list of gift buttons, with the selected gift's description below;
  - a "More gifts for the {console} on gblink.io →" link.
- **Task panel**: "Send {gift}" steps and a collapsible "No MYSTERY GIFT on the menu?" help. On Switch, any key setup is handled by the device service, which shows its own pop-up when needed. It isn't part of this page's design.

### Cartridge Saves (`mode=saves`)

- **Toggle**: **Back up** (read) | **Restore** (write).
- **Choices**:
  - **Back up**: "Download the save from a GBA cartridge. The game is detected from the cartridge." Switch save download is marked "In research".
    - After a backup: **Download** the `.sav`, and **Use as {game}'s save**, which replaces the selected game's save through `activeGame`. It's **disabled** when no game is selected, or when the cartridge's game doesn't match the selected game.
  - **Restore**: a `.sav` file picker, with the note that the cartridge must match the file (a Ruby or Sapphire save fits either).
- **Task panel**: the read or write steps and progress.

### ROM / BIOS Dumps (`mode=dumps`)

- **Toggle**: **ROM dump** | **BIOS dump**.
- **Choices**:
  - **ROM dump**: "Download the ROM of any GBA cartridge. Large games take several minutes."
  - **BIOS dump**: "Download the 16 KB BIOS from your GBA."
  - After a ROM dump: **Download** the ROM, and **Back up to storage for the Arcade**, which saves it as the game's ROM in storage.
  - BIOS dumps: download only, noting "Downloads stay on your computer and are never synced."
- **Task panel**: the dump steps and progress.

## Lab Settings (Lab `mode=settings`)

All site settings in one place, including the old Camp Settings and the Arcade's settings. Back → Lab menu. The URL's `&tab=` opens a tab directly; the Dropbox badge opens `tab=storage`.

### Desktop layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back   Ruby   ╱ Settings ╲                             (G) (D) │
├────────────────┬─────────────────────────────────────────────────┤
│ ▸ Backup &     │                                                 │
│   Restore      │   {Tab title}                                   │
│   Appearance   │                                                 │
│   Data         │   Section cards for the selected tab            │
│   Hardware     │                                                 │
│   Arcade       │                                                 │
│                │                                                 │
└────────────────┴─────────────────────────────────────────────────┘
       25%                             75%
```

| Area            | Position | Size       | Contents                                                            |
| --------------- | -------- | ---------- | ------------------------------------------------------------------- |
| **Tab list**    | Left     | 25% × 100% | Vertical tabs: Backup & Restore, Appearance, Data, Hardware, Arcade |
| **Tab content** | Right    | 75% × 100% | The selected tab's title and its section cards, scrolling if needed |

### Tabs

| Tab                  | `&tab=`      | Sections                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backup & Restore** | `backups`    | **Game picker**, defaulting to the selected game. **Save backup card** for that game: last-updated date; bring a save in (From GBA / From file); take it out (to GBA / export file); restore an earlier day's save; remove. **Camp Sites card**: export and import the Camp Sites. All save changes go through `activeGame`. |
| **Appearance**       | `appearance` | **Sprite source** picker.                                                                                                                                                                                                                                                                                                    |
| **Data**             | `storage`    | **Where data is stored**: "Stored on Dropbox" or "Stored locally in this browser", with the explanation, the Dropbox status, and Connect/Disconnect. **PC data**: the collection data controls.                                                                                                                              |
| **Hardware**         | `hardware`   | **GB-Link firmware**: the installed version and update.                                                                                                                                                                                                                                                                      |
| **Arcade** (new)     | `arcade`     | **Key bindings**: the binding groups, each key rebindable, plus "Restore default keys". **Confirm before restart** toggle. These are the same settings as the Arcade's in-game menu; both read and write them through `storage`.                                                                                             |

### Mobile layout

- The tab list becomes a horizontal, scrollable tab bar under the header.
- Section cards stack full width below it.

## Patch Notes (Lab `mode=news`)

A read-only list of updates. Back → Lab menu.

### Desktop layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back   Ruby   ╱ Patch Notes ╲                          (G) (D) │
├───────────────┬──────────────────────────────────┬───────────────┤
│               │ 2026-08-25                       │               │
│               │ Mystery Gift live at Worlds / XP!│               │
│               │ Body text …                      │               │
│               ├──────────────────────────────────┤               │
│               │ 2026-08-19                       │               │
│               │ Working Mystery Gift prototype   │               │
│               │ Body text …                      │               │
│               └──────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────┘
       20%                      60%                       20%
```

- **One centered column**, 60% of the width, with empty margins either side.
- **Update cards**, newest first. Each card has:
  - the **date**;
  - the **title**;
  - the **body** (text, links, images as today).
- The column scrolls; the header stays fixed.

### Mobile layout

- The column fills the width, with the same cards stacked.

## Arcade player (`/arcade/?game=…`)

The current Arcade player stays as it is (screen, controls, in-game menu, dialogs). Only the header changes.

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back   Ruby   ╱ Arcade ╲                               (G) (D) │
├──────────────────────────────────────────────────────────────────┤
│                    (current player, unchanged)                   │
└──────────────────────────────────────────────────────────────────┘
```

- **Header**: the shared page header, with Page = "Arcade". On mobile it's the shared mobile header.
- **← Back**: exits to `/hub/?game=…` with a full page load. It keeps the player's existing "leave with unsynced progress?" confirmation.

## Camp (`/camp/`, `mode=move | campsite | trade`)

One page with two grids. The left grid is always the save; the right side changes with `mode`. Back → Hub.

### Desktop layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back   Ruby   ╱ Camp ╲                                 (G) (D) │
├──────────────────────────────┬──────┬────────────────────────────┤
│  ╭────────────────────────╮  │      │  ╭────────────────────────╮ │
│  │ <     ( Box 1 )      > │  │ (●)  │  │ <    ( Camp 1 )      > │ │
│  ├──┬──┬──┬──┬──┬──┤      │  │      │  ├──┬──┬──┬──┬──┬──┤      │ │
│  │  │  │  │  │  │  │      │  │ [▣]  │  │  │  │  │  │  │  │      │ │
│  ├──┼──┼──┼──┼──┼──┤      │  │      │  ├──┼──┼──┼──┼──┼──┤      │ │
│  │  │  │  │  │  │  │ 6 × 5│  │ [ ]  │  │  │  │  │  │  │  │ 6 × 5│ │
│  │      …               │  │      │  │      …               │ │
│  ╰────────────────────────╯  │      │  ╰────────────────────────╯ │
│  ( Save )*   ( Trade )       │      │       ◀  Ruby Boxes  ▶     │
└──────────────────────────────┴──────┴────────────────────────────┘
   * appears only when there are unsaved changes
```

- **Header**: the shared page header, with Page = "Camp".

#### Left grid: the save

- The game save's **box or party** sits in a rounded window. Its green header contains the previous arrow, game cartridge icon, centered name, an empty counterweight matching the icon's width, and the next arrow. The arrows are integrated into the header.
- A **6 × 5** slot grid (30 slots, one GBA box). The party shows its 6 slots.
- **No game selected:** the left grid is a **Camp Site** instead (e.g. **Campsite 1**).

#### Right side: depends on `mode`

| Mode             | Right side                                                                                                  | No game selected                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `move` (default) | A **second grid of the save**, box or party, with its own < > arrows, so Pokémon can move between two boxes | A second **Camp Site** grid                                  |
| `campsite`       | A **Camp Site** grid, **( Camp 1 )** with < > arrows                                                        | Redirects to `mode=move`                                     |
| `trade`          | The **trade panel**, for trading with a different save or a device                                          | Trades a Camp Site Pokémon with a device, or device ↔ device |

#### Bottom bar: mode and actions

- **Below the right storage grid**: an attached green footer reads **◀ Campsite ▶** for `mode=campsite` or **◀ {Game} Boxes ▶** for `mode=move`. Both arrows switch to the other destination. With no game selected it's hidden, since only `move` is available.
- **In View**: the right side has a green header with the selected Pokémon's nickname, level, and gender, and its footer switches between **Overview**, **Moves & Traits**, and **Stats**. The panel content has no scrollbar.
- **Below the left grid, aligned with the right footer**:
  - **Trade**: opens `mode=trade`.
  - **Save**: **appears only when an action has made changes**. It writes the changes through `activeGame`.
- **In `mode=trade`**, the bottom bar shows only an **End trade** button, centered. It returns to `mode=move`.
- **Leaving with unsaved changes** (Back, the mode buttons that leave, browser back, the Dropbox badge) opens a confirmation pop-up.

#### Proportions (desktop)

| Area                          | Size             |
| ----------------------------- | ---------------- |
| Left grid (the save)          | 45% of the width |
| Middle column (tool selector) | 10%              |
| Right side (by mode)          | 45%              |

#### Middle column

The **tool selector**, a vertical set of three icon buttons between the two grids. Exactly one is active, and it applies to both grids. These are the storage tools the Camp already has (`PokemonStorageView.tsx`).

| Icon    | Tool               | Today's mode | What a click on a slot does                            |
| ------- | ------------------ | ------------ | ------------------------------------------------------ |
| **(●)** | **View** (default) | `view`       | Selects the Pokémon and shows its details              |
| **[▣]** | **Move**           | `moveOne`    | Picks up one Pokémon, then places it in another slot   |
| **[ ]** | **Grid**           | `groupMove`  | Selects a rectangle of slots and moves them as a group |

- As today, the party allows **View** only.
- **View details:** while View is selected, the right side is always the **Pokémon page panel**. It shows a prompt until a Pokémon is selected from the save grid, then displays that Pokémon's details. On mobile the same panel is stacked below the save grid. Choosing Move or Grid restores the destination grid. The View tool's Poké Ball is outlined when inactive and filled when selected.

### Mobile layout

```
┌──────────────────────────┐
│ (←)  Camp       (G) (D)  │
├──────────────────────────┤
│ ╭──────────────────────╮ │
│ │ <    ( Box 1 )     > │ │  top half:
│ │  6 × 5 slot grid     │ │  the save (left grid)
│ ╰──────────────────────╯ │
│    (●)   [▣]   [ ]       │  tool selector, in a row
│ ╭──────────────────────╮ │
│ │ <    ( Camp 1 )    > │ │  bottom half:
│ │  6 × 5 slot grid     │ │  the right side for this mode
│ ╰──────────────────────╯ │
│ ( Save )*  ( Trade )     │
│        ◀ Campsite ▶      │
└──────────────────────────┘
```

- The desktop's left and right halves stack: the **save on top**, the **mode's right side below**.
- The **tool selector** (View / Move / Grid) runs as a horizontal row between the two halves.
- **Trade** (and Save when needed) sits immediately below the first grid. The Campsite/Boxes selector is attached to the second grid; in View, that footer becomes the detail-page selector.
