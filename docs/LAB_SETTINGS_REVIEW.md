# Lab Settings — review notes for the implementer

Reviewed against `docs/LAB_SETTINGS_DESIGN_SPEC.md`. This file is updated as
work lands. Items marked **Keep** are deviations from the spec that are better
than the spec and should stay.

Last pass: 2026-10-24, pass 3. Nothing from pass 2 is addressed yet; start
with the "Target viewport" section.

> **Arcade tab: hands off.** At the owner's request, Claude is rebuilding the
> Arcade tab to match the in-game pause menu by sharing the menu's own
> component and CSS. Please don't edit `lab/ArcadeSettings.tsx`, the Arcade
> rules in `lab/labSettings.css`, `arcade/ArcadeMenu.tsx`,
> `arcade/arcadeMenu.css`, or the new `arcade/KeyBindingEditor.tsx` /
> `arcade/keyBindingEditor.css`.
>
> **Data tab: hands off too.** Claude is also rebuilding the Data tab at the
> owner's request: `DataStorageControls` in `SettingsSections.tsx`,
> `lab/LabCollectionData.tsx`, `DropboxBadge.tsx`, and the Data rules in
> `lab/labSettings.css` (`.lab-settings-data`, `.lab-storage-*`, `.lab-data-*`,
> `.lab-collections-*`, `.lab-danger-*`). Everything else in this file is
> still yours.

## Theme setting (in progress, not in the spec)

**Pass 6: the theme picker breaks the fit on Appearance.** At 1440×665 the
panel now scrolls by 170px: the sprite preview and `Save Settings` are below
the fold (it fit before). `ThemePicker` adds a second full module whose
preview is about 160px tall, with empty space under the select, stacked
above the sprite module.

Suggested fix: one module, two columns, one preview.
- Left column: `Theme` select, `Sprite resource` select, the resource link.
- Right column: a single `Preview` that *is* the theme board (the staged
  `--preview-*` colors) with the five sample sprites sitting on its card.
  That shows both choices together and matches the spec's "left: settings,
  right: preview" structure.
- `Save Settings` at the bottom right (`.camp-confirm-btn` has
  `margin: 0 auto`; set `margin-inline-start: auto`).

Target: fits at 1440×665 with no scrolling, like the other three non-Arcade
tabs.

**Pass 5: the save warning below is resolved.** `useSettingsForm` saves its
loaded `themeId` and `StartMenu` passes `startup.themeId`, so saving keeps
the theme. Typecheck, lint, i18n, and all 569 tests pass. Arcade and Data at
1440×665 render pixel-identical to before the theme tokens landed. Still to
come: the theme picker itself on Appearance; `common:themes.night` is
labeled but not yet in `availableThemes`.

`StorageSettings` gained `themeId`, and `saveSettings` now writes
`themeId: settings.themeId ?? null`. The tree doesn't typecheck yet:
`hub/StartMenu.tsx:118` and `useSettingsForm.ts:395` still save
`{ spriteSourceId }` alone.

**Don't fix those by adding `themeId: null`.** That would reset the saved
theme every time someone saves Appearance or finishes the first-run sprite
dialog. Pass the current value instead: the form's loaded `themeId` in
`useSettingsForm`, and a read-modify-write (`{ ...(await getSettings()),
spriteSourceId }`) in `StartMenu`. A test that saves the sprite source and
asserts the theme survives would lock this in.

A theme picker isn't in the spec. If it goes on Appearance, it has to fit
the 1440×665 budget alongside the sprite preview, and use flat fills with no
gradients, per the project's style.

## Target viewport: 1440 × 665

This is the owner's real browser window, about 1440×665 CSS px. It's much
shorter than a 900px-tall test window. "Fits without scrolling" means fits
*here*. The panel's `overflow-y: auto` stays as the fallback for shorter
windows; it isn't the plan.

Status at 1440×665 (pass 2):

| Tab | State | Result |
|---|---|---|
| Backup & Restore | Cabin with a backup | **Scrolls +63px**: title clipped at top, `Remove backup` cut off |
| Backup & Restore | No backup | fits |
| Backup & Restore | Campsites (pass 3) | **Scrolls +140px**: `Save Settings` is off-screen, and the download column is crushed |
| Appearance | — | fits |
| Data | — | **Scrolls +110px**: `Delete all collections` is off-screen |
| Hardware | (not redesigned yet) | fits |
| Arcade | — | scrolls (expected) |

The shell above and below the panel (frame margin, header, `.site-body`
padding) costs about 240px of the 665px and is out of scope ("existing shell
remains unchanged"). The fixes have to come from inside `.settings-page`.

### Backup & Restore: gain about 70px and lose a nesting level

1. Drop `.settings-page`'s own `padding: .75rem` and `max-width`.
   `.site-body` already pads the page. **+24px.**
2. **Flatten the transfer area.** Right now it's panel → `.lab-backup-actions`
   card → `.camp-transfer-group` box → button, three borders deep. That's
   most of why the owner's screenshot looks heavy. Remove the wrapper's chrome
   (border, padding, background, and the `padding: .5rem !important`). Then
   let the two transfer groups sit directly in `.lab-settings-backup`'s
   2-column grid as ordinary `.lab-settings-module`s. The page becomes a clean
   2×2 grid: Cabin | Last backup / Bring in | Take out. That matches the
   spec's "two equal columns". **About +18px.**
3. Remove `min-height: 6.5rem` on `.lab-backup-status`; the grid row already
   stretches it to the Cabin module's height.
4. Make `Remove backup…` the spec's full-width pale-red row, about 2.25rem
   tall, under one divider with tight spacing. It should match the Data
   page's danger row. It's a plain text link at the far right today.
5. `From GBA` (a `<button>`) and `From file` (a `<label>`) still differ by
   about 2px in height. Give `.camp-transfer-btn` an explicit `height`, not
   just `min-height`.

### Campsites (not in the spec): mirror the Cabin layout

Pass 3's `.lab-campsites-card` grid is broken at 1440×665:
- The `Take the campsite out` box renders about 158px wide, so its heading
  wraps onto two lines and the `Download` button is clipped.
- The top row has empty space beside the Cabin selector (the same problem
  pass 1 had).
- `Save Settings` sits below the fold. That's a functional problem here: a
  camp-site count change does nothing until it's saved.

Suggested approach: drop `.lab-settings-backup--campsites` and
`.lab-campsites-card`, plus both new `!important`s, and reuse the Cabin
view's 2-column module grid, so switching Cabin ↔ Campsites doesn't reshuffle
the page:

- Row 1: `Cabin` | `Number of camp sites` (the input and its minimum hint
  take the slot where `Last backup` sits).
- Row 2: `Take the campsite out` (Download zip ›) | the explanatory "Each
  Camp Site adds 30…" sentence, or leave the cell empty.
- Then the `Delete campsite…` danger row and `Save Settings` at the bottom
  right, both visible without scrolling.

### Data: done (Claude, pass 4)

Rebuilt at the owner's request, and it fits at 1440×665 with no scrolling:
- Compact provider card: icon, name, state dot and label, one button, one
  sentence. The hardcoded English status words are now i18n keys.
- Collections table with Collection | Type | Registered | Actions. Counts
  come from `provider.getCollectionResult`.
- A separate pale-red danger row with a normal-sized `Delete all
  collections…` button.

Must fix 4 below is resolved. The notes that follow are kept for history.

### Data: gain about 110px (superseded)

1. **Collections as a table** (Collection | Type | Registered | Actions), one
   line per row. Putting "Built-in" in a Type column instead of a second line
   saves about 20px per row, **about 80px** for the 4 built-ins. For the
   Registered column, reuse `registeredCount(result)` and
   `common:format.progress` from `CollectionHome.tsx`.
2. Move the `collectionsAndTheirRegisteredHistoryAreKeptInTheActive`
   paragraph out of the module header and into the danger zone's help text,
   where the spec puts it. **About +45px** at the top.
3. Compact Storage Provider, as in Must fix 4 below.

## Must fix

1. **Don't use the PC palette here; use the camp tokens the spec asks for.**
   *Still open in pass 2. Visible in the owner's screenshot as the grey rail
   casing, red active tab, and graphite frame.* `labSettings.css` copies
   `pc.css`'s Pokédex-device palette into new `--settings-*` tokens. The spec
   says: warm ivory panel, subtle border, soft shadow; active nav = dark green
   fill with light text; inactive = cream with brown outline; red only for
   important or destructive actions.
   - The base styles already do exactly this: `.site-panel` and `.option` /
     `.option[aria-pressed='true']` in `src/pages/hub/siteComponents.css`.
     Mostly this means *deleting* the overrides on `.settings-page > .option-group`,
     `.option`, and `.lab-settings-workstation.site-panel`.
   - Why it matters: red as the nav highlight makes red ambiguous. The page's
     destructive actions (Remove backup, Delete all collections) are also red.
     The 3px graphite frame is also the heaviest element on the page and
     outranks the page title.
   - Inner surfaces should use `--camp-surface`, `--camp-border-soft`,
     `--camp-panel-border`, `--camp-text`, `--camp-muted`, `--camp-leaf`,
     `--camp-danger`. No new hex values (pass 2 added more: `#6e9d78`,
     `#e5f0df`, `#3c754e`, `#fffdf4`).

2. **Format the CSS and the changed TSX.** *Still open in pass 2.*
   `labSettings.css` is minified to about 20 long lines; every other
   stylesheet in the repo is formatted and commented. `npx prettier --check`
   fails on `labSettings.css`, `LabSettings.tsx`, `SettingsSections.tsx`,
   `OptionGroup.tsx`, and now `Panel.tsx`. Run `prettier --write`. Keep short
   why-comments for non-obvious rules, and avoid `!important`.

3. **Hardware is not started yet.**
   - Description line `Manage your GB-Link device and firmware.` (new i18n
     key, en + es).
   - Left module `GB-Link Device` with the connection state at top-right of
     the heading, then key/value rows (Current firmware / Latest available),
     the buttons, and the status box.
   - Remove the `<h2>GB-Link firmware</h2>` in JSX (or turn it into the module
     heading) instead of hiding it with `.camp-settings-section>h2 { display:none }`.
   - **Split Check Device / Update Firmware: do it. It's a real improvement.**
     Today `GbLinkFirmwareUpdater.run()` connects, reads the version, and,
     if outdated, downloads and reboots into the bootloader all from one
     click. Separating "check" (connect + read current + fetch latest) from
     "update" (download + reboot + flash) lets people see the versions before
     committing to a flash. Keep `nextAction` / the select-and-verify recovery
     steps working, and extend `gbLinkFirmwareUpdate.test.ts`.
   - **Device Information: only show rows the device can actually report.**
     Firmware and Connection are available (`GbLinkTransport` knows `webusb`
     vs `webserial`). Model and Serial aren't exposed, and Web Serial can't
     provide a serial number. Don't render rows that will always show "—".

4. **Data is only partly done.** (See the viewport section for the
   space-saving order.)
   - Storage Provider should be a compact card: provider icon + name, status
     dot + state, one button, one short sentence. Right now it has a heading,
     a second bold heading, two paragraphs, a status box, and a centered
     button.
     - **Keep (extends spec):** the spec only shows the connected state. In the
       local-browser state, keep a *short* form of the data-loss warning
       ("Only in this browser; clearing site data deletes it.").
   - Danger zone: move `Delete all collections…` out of the collections module
     to a full-width row at the bottom of the panel, with the explanatory text
     beneath it.

## Keep (better than the spec)

- **Mobile nav as a native `<select>`.** Two fixes:
  - Make it full width; it's currently about 160px.
  - Visually hide its "Settings" label (keep it for screen readers), since the
    page header already says Settings.
- **Save only on Appearance and Campsites (`showsSave`).** The other tabs act
  immediately.
- **Backup copy "Manage the save backup for each game."** The Cabin picker
  can select any game, so "each" is more accurate than the spec's "this".
- **Reset the panel's scroll on tab change** (pass 2). This is a real fix:
  leaving Arcade scrolled down used to carry over to the next tab. Simpler
  route: `key={active}` on `<Panel>` remounts it with no new prop on the
  shared hub component. The tab bodies already remount per tab, so nothing is
  lost.

## Smaller items

- **Appearance**
  - The spec's explanatory sentence under the selector is missing.
    `SpriteSourceDefinition` has no description field, so this needs one i18n
    key per source (4 sources, en + es).
  - Save should be at the bottom right. `.camp-confirm-btn` has
    `margin: 0 auto`, so the `align-self: end` override does nothing. Set
    `margin-inline-start: auto`.
- **Arcade: done (Claude, pass 3).** The owner asked for it to match the
  pause menu's Controls and Skins views. The binding lists now come from a
  shared `arcade/KeyBindingEditor.tsx` (styles in
  `arcade/keyBindingEditor.css`), which the pause menu also uses, so the two
  can't drift. A container query puts D-pad / Buttons / Shortcuts in three
  columns when the editor is at least 54rem wide; the menu keeps its two
  columns. The `lab-arcade-*` copies, the dead `.settings-binding*` rules,
  and 4 unused `settings:ArcadeSettings.*` keys were removed. One item is
  still open in `LabSettings.tsx`, which is yours: the spec's first
  description line, `Configure controller inputs for the emulator.` (new
  key).
- **OptionGroup `mobileSelect`.** The `.option-group-mobile-select` base rule
  lives in `labSettings.css`, but the prop is on the shared hub component.
  Move the base and breakpoint rules into `siteComponents.css` next to the
  other `.option-group` rules, and mention the prop in the doc comment.
- **Heading casing:** new headings mix Title Case ("Storage Provider") and
  sentence case ("Last backup", "Sprite resource", "Controller skin"). Pick
  one; the repo mostly uses sentence case.
- `Backup on file` under the Last backup date repeats what the check mark and
  date already say. Drop it, or use the slot for the spec's optional file size.

## Done since pass 1

- Last backup module paired with the Cabin selector (spec layout).
- Redundant "Ruby Cabin" heading inside the backup card removed.
- `›` chevrons on transfer buttons, hidden when disabled.
- i18n keys for Preview, Storage Provider, and Last backup, with es-ES
  translations that match the glossary.
- Spacing tightened. At 1280×720, Backup now fits with no backup on file;
  Data dropped from +161px to +62px.

## Checks (pass 2)

- `npm run check:i18n`, `tsc -b`, `npm run lint`: pass.
- `prettier --check`: fails on 5 files (Must fix 2).
