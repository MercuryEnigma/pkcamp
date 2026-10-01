# Ribbon icons — provenance

The 161 PNG files in this directory are copied verbatim, unmodified, from
upstream PKHeX's own ribbon icon set.

- **Source**: [kwsch/PKHeX](https://github.com/kwsch/PKHeX),
  `PKHeX.Drawing.Misc/Resources/img/ribbons/`
- **Pinned via**: the `PKHeX` fork vendored (gitignored, re-fetched per
  `vendor/pkhex-wasm/FORK_NOTES.md`) at
  `vendor/pkhex-wasm/external/PKHeX.Everywhere/external/PKHeX`, pinned at
  commit `10016c6fe5b732a113c3ca732116ea8976dc1f2c` (arleypadua/PKHeX fork of
  kwsch/PKHeX) — same commit already recorded as the Core source in
  `vendor/pkhex-wasm/FORK_NOTES.md`.
- **License**: GNU General Public License v3.0 or later (GPL-3.0-or-later),
  same as the rest of PKHeX.Core. Full text:
  <https://www.gnu.org/licenses/gpl-3.0.txt>, or see `LICENSE` at the root of
  the pinned PKHeX repository above.
- **Scope of this copy**: only the `ribbons/` icon set (161 files, ~644 KB).
  No other part of `PKHeX.Drawing.Misc` is used or shipped by pkcamp.
- **Why they're here and not in `vendor/pkhex-wasm/dist/`**: `dist/` is
  pkhex-wasm's own rebuildable package output (wasm runtime + JS bindings).
  These icons are unrelated to that build — they're static image assets
  pkcamp's own UI references directly — so they're vendored into pkcamp's
  `public/` folder instead, alongside pkcamp's other static assets.
- **Filename convention**: `lowercase(PropertyName) + ".png"`, where
  `PropertyName` is the `Ribbon*`-prefixed PKHeX.Core property backing that
  ribbon (e.g. `RibbonEffort` -> `ribboneffort.png`). See
  `RibbonDefinition.IconFile` in
  `vendor/pkhex-wasm/external/PKHeX.Everywhere/src/PKHeX.Facade/Pokemons/Ribbons.cs`.
- **No modifications**: files are copied byte-for-byte; none have been
  edited, resized, or recompressed.
