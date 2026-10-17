# GB-Link-Switch-LDN source

These files are the browser transport, PC-to-Switch trade implementation, and
GBA-to-Switch relay (Bridge and CableSession) from
[GB-Link-Switch-LDN](https://github.com/GB-Link/GB-Link-Switch-LDN),
revision `c1a3a97f3ab5c60e87307089d6b7db10e3fd5993` (upstream `web/js/`).

Only the import closure of `EspDevice`, `TradeSession`, `Bridge` and
`CableSession` is included: `esp.js`, `wire.js`, `keys.js`, `bridge.js`,
`national.js`, `trade/{adapter,bytes,engine,link,pk3,pk3-data,pool,rfu,session}.js`,
`cable/{session,cable,translator}.js`. The `.d.ts` files are hand-written
local declarations.

Licensing: the source is AGPL-3.0; see `LICENSE` in this folder. Exception:
`cable/translator.js` is MPL-2.0 (ported from mgba_LDN); see
`cable/LICENSE.MPL-2.0`. Its header is kept intact.

## Local modifications

1. `trade/rfu.js`: the emulated trainer name is `PkCamp` instead of `EMU`
   (three `gameName('PkCamp', ...)` calls).
2. `cable/cable.js`: the `import { MODE_CABLE_LINK } from '../gblink.js'` line
   is replaced by a local `const MODE_CABLE_LINK = 0x01;` (same value as
   upstream) so upstream `gblink.js` is not vendored.

## Mystery Gift (newer revision)

`cable/leader.js` and `gift/*.js` come from revision
`8b47745dd2b8efcddb9ff93e4ad319eae4b95f25` (upstream `web/js/`), copied
unmodified. They import `../wire.js`, `../trade/adapter.js` and `../esp.js`
from this folder's older revision; those three files are unchanged in
substance between the two revisions. `gift/wc3.js` and the page code in
`app.js` are not included. The `.d.ts` files are hand-written.
