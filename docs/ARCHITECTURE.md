# Build and verification architecture

The [application overview](../ARCHITECTURE.md) describes runtime pages and
services. The build prepares the ignored local `pkhex-wasm` package before root
installation: `setup-pkhex-wasm.mjs` fetches pinned source revisions, refuses to
reset a mismatched checkout, and invokes packaging. Vite serves/copies its WASM
runtime beneath the `/pkcamp/` base path. The production trade placeholder is
tracked in `src/assets/trade/`; personal save fixtures remain ignored.

The deployment workflow configures Node 24, .NET 10, and `wasm-tools`, then runs
setup, install, strict maintained-code lint, tests, and build before Pages
upload/deploy. Vendored code is excluded from lint; real-save tests skip without
local fixtures. `verify-navigation.mjs` uses Chrome against a running dev server
(default port 5174, overridable with `PKCAMP_TEST_URL`), checking a mock harness
and actual Start/Lab/settings navigation without live accounts or hardware.
`verify-hardware-lifecycle.mjs` adds a simulated device/session harness against
the real tool pages (default port 5173, same URL override).

```mermaid
flowchart TB
  Setup["setup-pkhex-wasm.mjs<br/>run · revision"] --> Vendor["build:pkhex-wasm<br/>dotnet publish · package runtime/source kit"]
  Vendor --> Install["npm ci"]
  Install --> Checks["lint · vitest · tsc"]
  Checks --> Build["vite build<br/>pkhexWasmAssets.configureServer/writeBundle"]
  Build --> Pages["dist/ → GitHub Pages"]
  Dev["vite dev server"] --> Browser["Navigation / hardware lifecycle scripts<br/>Chrome → real pages + simulated boundaries"]
```
