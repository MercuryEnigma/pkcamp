# Delta controller skins

The Arcade's on-screen controller is a Delta `.deltaskin` (GBA only). pkCamp
ships one (`default/`, original artwork) and players can import their own from
the menu's Skins page or the Lab's Settings → Arcade. Nothing is uploaded;
imported skins are kept in the browser's local store.

## Pipeline

```
.deltaskin ─ parseDeltaSkin ─▶ archive ─ rasterizePdfs ─▶ archive + PNGs
                                              │
                              normalizeDeltaSkin (per orientation/device)
                                              ▼
                       ControllerSkin ─▶ DeltaSkinController (layout + touch)
```

- `parseDeltaSkin.ts` unzips in memory and validates `info.json`.
- `rasterizePdfs.ts` draws PDF artwork to transparent PNGs with pdf.js, loaded
  only for skins that need it.
- `normalizeDeltaSkin.ts` turns Delta's JSON into `ControllerSkin`, so nothing
  else knows the Delta format. Re-run when the window rotates.
- `skinGeometry.ts` holds the single skin-to-pixel transform and the touch
  hit-testing; `DeltaSkinController.tsx` draws and routes input. It owns layout
  only and never touches the emulator.
- `skinLibrary.ts` / `useSkinLibrary.ts` store imported skins and the selection
  (`SkinManager.tsx` is the shared UI).

## Layout choice

- Phones prefer iPhone layouts, larger windows iPad ones; split-view layouts are
  never used. A skin missing the wanted orientation uses the other.
- With `screens`, the skin is drawn as given.
- Without `screens`, as Delta does: portrait puts the screen above the artwork;
  landscape lays the artwork (at 70% when `translucent`) over a screen that
  fills the window.

## Inputs

| Delta input                                       | Arcade                  |
| ------------------------------------------------- | ----------------------- |
| `a` `b` `l` `r` `start` `select`, several at once | GBA buttons             |
| `dpad` (3×3 grid, diagonals)                      | Four directions         |
| `menu`                                            | Opens the pkCamp menu   |
| `quickLoad`                                       | Restart                 |
| `quickSave`                                       | Guide                   |
| `toggleFastForward`                               | Steps the speed         |
| `fastForward`                                     | ×4 while held           |
| anything else (`thumbstick`, …)                   | Ignored, with a warning |

Menu, Restart, Guide and speed work before a game starts; GBA buttons only
while playing. Tap-style actions run on the skin's click, not on press, so the
click that follows a touch cannot land on a menu they open.

`debug: true` in a skin's `info.json` outlines its touch areas.
