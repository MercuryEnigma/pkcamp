# Laboratory Settings — Design Specification

Status: proposed design; no UI implementation included.

This specification combines the supplied reference image and ChatGPT proposal with the existing Lab settings behavior. The reference establishes the composition: a retained Camp header, a left section rail, and a warm inset workstation. Dimensions below refine that composition for readable text, accessible controls, and responsive layouts.

## 1. Design direction

Treat Settings as one Lab console with five specialized workspaces. Keep the green global shell and existing header actions. Inside Settings, reuse the Pokédex's ivory plastic, graphite screen frame, flat fills, and restrained red accents.

Refinements to the reference and companion proposal:

- Use the same console width on every page, including Arcade. The wider Arcade mockup demonstrates its layout, not a separate shell size.
- Use muted red for the active Lab section, matching the reference image and Pokédex. Keep green for the global shell and successful status indicators.
- Increase text and control sizes from the compressed reference. Achieve density through grouping and spacing.
- Let every page scroll when needed. Four pages should usually fit at a comfortable desktop height, but translated text, uploaded collections, workflow details, zoom, and mobile screens must remain accessible.
- Put Controller Skin beside the binding groups on wide desktops and below them at smaller widths.
- Show only supported device information and real collection counts. Reference values are examples, not product data.

## 2. Shared shell and dimensions

Dimensions use CSS pixels, expressed in rem in implementation at a 16px root. Breakpoints refer to the available Settings host width, rather than the viewport, so the console also works inside a constrained Lab shell. Use a size container on the host.

| Setting | Wide desktop ≥1280px | Desktop/tablet 900–1279px | Narrow tablet 720–899px | Mobile <720px |
|---|---:|---:|---:|---:|
| Maximum outer width | 1440px | 1440px | 1440px | 100% |
| Outer horizontal gutter | 24px | 24px | 16px | 12px |
| Casing padding | 12px | 12px | 12px | 8px |
| Navigation width | 176px | 160px | 152px | Full-width selector |
| Rail/workstation gap | 12px | 12px | 12px | 8px vertical |
| Workstation border | 3px | 3px | 3px | 2px |
| Workstation padding | 24px | 20px | 16px | 12px |
| Module gap | 16px | 16px | 12px | 12px |
| Module padding | 16px | 16px | 16px | 12px |

Outer width is `min(1440px, 100% - 2 × gutter)`, centered in the available host. All sizing includes borders and padding. At a 1440px host, the outer console is 1392px wide and the usable workstation content is approximately 1126px. At 1024px, usable content is approximately 722px. At 390px, usable content is approximately 322px.

Keep the current global header geometry and navigation actions; do not introduce a second global header. The settings casing begins beneath it. Its desktop rail and workstation stretch to the available Lab body height; modules remain aligned to the top. Do not stretch individual cards to fill unused vertical space or impose a large minimum panel height.

On desktop, the workstation body is the single vertical scroll region. Its title, modules, and footer scroll together; the shell header and rail remain visible. Give the scroll container `min-height: 0` and `overflow-y: auto`. Avoid nested scrolling collection tables or skin lists.

Below 720px, use one vertical scroll region for the entire Settings body, including the section selector and workstation. Remove the workstation's independent scrolling and fixed height. Keep only any already persistent global shell header. Allow bottom padding for the device safe area; never obscure the final action with a sticky footer.

### Navigation

Desktop rail buttons: full rail width, minimum 48px high, 8px vertical gap, 12px horizontal padding, 20px leading icon, 10px icon/text gap. Text is 14px semibold and may wrap. Active state uses red fill, white text, and a visible inset edge; hover and focus remain distinct.

On mobile, replace the rail with a native select labeled **Settings section**, 48px high and full width. Show all five section names in the existing order. Do not require horizontal scrolling to discover a section. Keep the current section in navigation state and preserve existing URL behavior; making Arcade addressable is a separate routing change.

### Shared page header

Use one heading per page: 24px/30px semibold on desktop, 22px/28px on mobile. Place a 24px section icon to its left with a 12px gap. Align the optional one-sentence description beneath the heading text, 14px/20px, maximum 65 characters per line. Leave 20px after the header on desktop and 16px on mobile. Hardware must not render an additional competing page heading.

## 3. Visual system

Reuse the values in `src/pages/pokestorage/lab/pc.css` through shared Lab tokens rather than duplicating divergent palettes.

| Role | Value |
|---|---|
| Casing | `#e4e0d3` |
| Casing edge | `#b4b0a3` |
| Graphite frame | `#3b3e43` |
| Screen | `#f7f1dc` |
| Module/divider line | `#ddd3b4` |
| Main text | `#2c2a26` |
| Secondary text | `#6e695c` |
| Lab accent | `#c0392b` |

Use 6px outer corners and 4px workstation, module, input, and button corners. Apply one subtle inset shadow to the workstation. Modules use a 1px border and a quiet ivory fill; avoid adding shadows to every row. Keep button fills flat rather than reproducing the reference's glossy gradients.

Module headings: 16px/22px semibold. Small transfer-group labels: 12px/16px bold with modest tracking. Body and control text: 14px/20px. Supporting metadata: 13px/18px. Do not reduce essential labels below 13px.

Buttons and select fields are at least 44px high; binding rows are 44px high on desktop and 48px on mobile. Icon-only controls have 44×44px targets. Use a visible 2px focus outline with 2px offset and verify text, focus, and status contrast during implementation.

Primary actions and active selection may use red fill. Destructive actions use red text, a pale tinted background, a trash icon, and explicit wording in a separate bottom module. Do not use a red connection dot for an ordinary disconnected device: use a neutral dot plus text. Green means connected/success; amber means attention; red indicates failure. Never encode status through color alone.

## 4. Backup & Restore

Desktop composition:

```text
Backup & Restore
Manage the save backup for this cabin.

[ Cabin selector             ] [ Last backup                 ]
[ Bring a save into pkCamp   ] [ Send this save out           ]
  From GBA                       To GBA
  From File                      Download File
[ Active transfer workflow, when opened                     ]
[ Remove backup for Ruby Cabin…                             ]
```

At workstation content widths ≥640px, use two equal columns with a 16px gap for both the summary row and transfer row. Summary modules have a 104px minimum height; allow expansion. The cabin module contains its label and 44px select. A decorative cartridge image may occupy 40×48px beside the field when space permits; hide it before shrinking the control.

Last backup shows an icon, readable status, localized date/time, and actual file size if available. Do not add an overflow menu without additional actions. Empty state: **No backup yet**. Loading and unreachable states must not be presented as empty backups.

Transfer modules use two full-width 44px action rows with an 8px gap. Icons are 20px; chevrons indicate opening a workflow. Enable import when no backup exists; disable export and removal with an adjacent explanation. Open GBA workflows in a full-width module below both columns, retaining existing progress, cancellation, and navigation guards.

Place removal last, separated by 16px. Its row is at least 56px high and names the selected cabin. Confirm the actual deletion scope before applying it. It is not a full filled-red primary action.

Below 640px content width, stack Cabin → Last backup → Import → Export → Active workflow → Removal. All action rows remain full width. No Save Settings button for immediate backup operations.

Preserve the existing **Campsites** selector option. When selected, replace cabin transfer modules with campsite capacity controls, Download Campsites ZIP, and the existing campsite removal action. Capacity changes are staged: show a dirty-state Save Settings action for that form only. Do not imply that Campsites support the same GBA transfer path as cabin saves.

## 5. Appearance

At content widths ≥880px, use a 280px controls column plus a flexible Preview column, with a 16px gap. Below 880px, stack controls then Preview. This prevents five samples becoming unreadable on ordinary laptop widths.

Controls module contains the **Sprite resource** label, 44px select, a short resource description, and a resource link that wraps. Keep the link here, associated with the selected resource.

Preview module contains its heading, then five sample cells: Bulbasaur, shiny Bulbasaur, Venusaur female, Venusaur male, and Deoxys Defense. Preserve the existing resolver and its honest fallback behavior. Label sex/form differences explicitly. A small fallback note is appropriate when a resource does not supply a requested variation.

Each sample needs at least 104px width. Use a responsive grid: five columns when the module's inner width is ≥552px, three at 328–551px, and two below 328px, with 8px gaps. Each sprite sits in a 72×72px well, with art contained in 64×64px; preserve aspect ratio and use integer scaling where practical for pixel assets. Labels sit below, centered, and may wrap. Do not stretch sprites to fill the card.

Preview updates immediately with the draft selection. Put Save Settings in a footer 16px below the modules, right aligned, minimum 152×44px. Show the footer only while dirty or saving, with **Unsaved changes** beside it. On mobile the button spans the available width and feedback sits above it. A failed save retains the draft; navigating away with unsaved changes requires the existing guard mechanism to be extended to this form.

## 6. Data

At content widths ≥880px, use a 260px Storage Provider column and a flexible Collections column, gap 16px. Otherwise stack Storage Provider → Collections → Danger zone.

Provider module: heading, 28px provider icon, provider name, status line, and Connect/Disconnect action. Distinguish **Stored in this browser**, **Dropbox · Connected**, **Connecting…**, and **Dropbox · Unreachable**. Include one short scope sentence. A configured cloud provider becoming unreachable must not silently appear as local storage.

Collections use a semantic table at widths where its module's inner area is ≥560px. Columns: Collection (flexible), Type (80px), Registered (96px), Action (116px), with 12px horizontal cell padding. Header is at least 36px high; data rows at least 56px to accommodate 44px actions. Wrap collection names. Use real registration counts only if available without speculative or expensive new computation; otherwise omit Registered consistently.

Below 560px inner width, render each collection as a compact row with name and type/count metadata on the left, action on the right. Keep a minimum 140px name area; wrap the action below when needed. Use dividers, not a separate large card per collection. No horizontal page scrolling and no visual bullets.

Built-ins offer **Clear history**; uploads offer **Delete collection**. Clearing history retains its definition. Uploaded deletion and global removal must describe their actual effects. Do not copy reference totals or promise reconstruction semantics without checking the existing collection service.

The danger module follows the entire list in normal flow, with a 24px top gap. Include **Delete all collections…**, a concise scope explanation, and confirmation. Allow the list to grow with uploaded collections; no fixed row count or clipped table. Actions save immediately; no page-level Save Settings button.

## 7. Hardware

At content widths ≥880px, use a flexible main module and a 280px Device Information module. Otherwise stack them. If the device API supplies no useful secondary metadata, omit the second module and cap the main module at 720px; do not show a large panel of permanent dashes.

Main module: **GB-Link**, connection badge, firmware definition list, actions, and status area. Firmware rows have minimum 36px height and a 148px label column on desktop. On mobile, labels and values may wrap. Show **Unknown — check device** for an unqueried version; latest firmware comes from the existing resolver, with a Beta badge when applicable. Never hardcode the example version.

Preferred final controls are Check Device and Update Firmware, 44px high with a 12px gap. They sit side by side at module inner widths ≥360px and stack below that. Update availability depends on the updater's actual state, not simply whether a version string exists. A neutral status box below the actions uses 14px/20px text and expands for progress or recovery instructions.

Implementation dependency: the existing UI has one multi-step **Check / Update** action, including bootloader selection and reconnection. A separate read-only Check Device needs an explicit supported code path before the two-button design ships. Until then, retain the truthful combined action in the new module. Preserve update, select-device, reconnect, verification, failure, and unsupported-browser states, plus the existing navigation guard.

Device Information may show model, serial, and transport when supplied by the API. Avoid repeating firmware already shown in the main module. Show **Not available** for unsupported fields or omit them; distinguish unavailable data from disconnected state. No Save Settings button.

## 8. Arcade

At content widths ≥1080px, use two columns: a flexible bindings area and a 280px Controller Skin module, gap 20px. The bindings area contains three equal columns: D-Pad, Buttons, Shortcuts, with 16px gaps.

At 720–1079px content width, retain three binding columns and place Controller Skin below. At 480–719px, use two binding columns with Shortcuts on the next row. Below 480px, stack D-Pad → Buttons → Shortcuts. Each group follows the existing binding definitions; do not hardcode reference defaults.

Binding rows use a light ivory fill, 1px border, 4px corners, 12px horizontal padding, and 4px vertical gaps. The whole row is the button. The action label sits left; the keycap sits right. Keycaps are at least 36×28px and expand for Enter or Right Shift, with 8px horizontal padding. Use a neutral keycap fill and a subtle lower edge for the physical-key effect.

Selecting a row enters **Press a key…** capture state with a visible outline and text. Escape cancels; focus returns to the row. End capture when leaving the page or moving focus outside the capture interaction. Preserve and explain the existing duplicate-binding behavior instead of silently inventing a new conflict policy. Reserved/unsupported keys must produce readable feedback.

Under the binding groups, leave 16px then show Confirm before restarting and Restore default keys. On desktop they share a row, aligned left and right respectively; on mobile they stack with an 8px gap. Restore affects keys only, leaving the restart preference and skin alone. A short saved status confirms immediate changes. No Save Settings button.

Controller Skin uses its own titled module. On wide desktop it aligns with the binding headings. When below the bindings, separate it with a 24px gap and divider. Selected skin rows are at least 48px high, with a radio/check marker and graphite selected border. Retain the skin library's existing selection, import, and management behavior; do not reduce it to a static Default row. Import Delta Skin is a full-width 44px secondary action. Follow with the file-format and local-device scope sentence. Long skin names wrap.

On touch devices without a physical keyboard, explain that key rebinding requires a keyboard while keeping restart and skin controls usable. Do not open a key-capture state that has no usable input path.

## 9. Saving, feedback, and accessibility

| Setting/action | Persistence | Page-level save |
|---|---|---|
| Cabin transfers/removal | Immediate workflow | None |
| Campsite capacity | Draft | Only when dirty |
| Sprite resource | Draft with live preview | Only when dirty |
| Storage connection and collection actions | Immediate workflow | None |
| Firmware | Explicit device workflow | None |
| Arcade keys, restart preference, skin | Immediate | None |

Place feedback next to the initiating module. Use polite live status for completion/progress and alerts for actionable errors. Preserve focus on failure; don't replace a failed form with a toast. Offline states explain which actions are unavailable and retain any safe local actions supported by the underlying services.

All controls have visible labels and keyboard focus. Decorative icons are hidden from assistive technology. Preview sprites have meaningful labels without duplicate announcements. Keep DOM reading order consistent with the mobile sequence. At 200% zoom and 320px available width, all content and controls remain reachable without horizontal page scrolling. Honor reduced-motion preferences; no decorative animations are needed.

## 10. Implementation and acceptance

Build shared Settings casing, navigation, page header, module, status row, and danger-row components. Scope styles to Lab Settings. Keep `SettingsSections` business behavior reusable by the Camp UI; introduce layout slots or Lab wrappers rather than changing shared Camp styling globally. Reuse existing form, sprite, storage, skin, and device services.

Accept the design when:

- All five pages have matching shell width, title alignment, typography, and module treatment.
- Layouts work at 1440×900, 1024×768, 768×1024, 390×844, and 320×568, plus a short desktop window and 200% zoom.
- Long translated labels, long collection/skin names, and many uploaded collections wrap or scroll without clipping.
- Empty backup, Campsites, local storage, cloud offline, unknown firmware, update recovery, unsaved appearance, and key capture states remain usable.
- Desktop normally keeps short pages compact; every page can scroll when content grows. Mobile has one vertical scroll surface.
- Destructive actions name their scope, draft changes have a clear save path, and immediate actions have no misleading Save Settings button.

Visual implementation should be reviewed against the supplied reference, with these dimensions and behavior rules taking precedence where its compressed illustration would make the interface cramped or incomplete.
