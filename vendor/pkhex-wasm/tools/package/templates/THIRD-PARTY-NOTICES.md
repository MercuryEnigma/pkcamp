# Third-party notices for pkhex-wasm

This package ships compiled WebAssembly built from several upstream projects.
Their notices and license obligations are summarized here; exact commit pins
live in [`upstream.json`](./upstream.json), and the complete corresponding
source ships as [`complete-source.tar.gz`](./complete-source.tar.gz).

## PKHeX.Core fork — GPL-3.0-or-later

- **Source**: the `PKHeX` fork nested in [PKHeX.Everywhere](https://github.com/arleypadua/PKHeX.Everywhere)
  (upstream lineage: [kwsch/PKHeX](https://github.com/kwsch/PKHeX))
- **Pinned commit**: see `pkhexCoreFork.commit` in [`upstream.json`](./upstream.json)
- **License**: GNU General Public License v3.0 or later — full text in [`LICENSE`](./LICENSE)
- **Role**: save-format parsing, editing, and serialization logic; compiled into
  the wasm bundle under `wasm/_framework/`.
- **Modifications**: none at the Core level. This repository compiles it unmodified;
  distribution-level changes are logged in [`MODIFICATIONS.md`](./MODIFICATIONS.md).

## PKHeX.Everywhere — MIT

- **Source**: <https://github.com/arleypadua/PKHeX.Everywhere>
- **Pinned commit**: see `pkhexEverywhere.commit` in [`upstream.json`](./upstream.json)
- **License**: MIT — full text below.
- **Role**: hosting monorepo of the Core fork (submodule pins) **and**, since
  the pkcamp modifications, the source of **PKHeX.Facade**, which *is* compiled
  into this bundle (`wasm/_framework/PKHeX.Facade.*.wasm`). The binding holds
  Facade `Game`/`Pokemon` objects and delegates version identity, box/party
  projection, form, egg state and `.pk*` file IO to them.
- **Scope**: Facade is built by `src/PKHeX.Facade.Wasm/PKHeX.Facade.Wasm.csproj`
  from the pinned sources, excluding `AutoLegality.cs` and
  `Extensions/PokemonExtensions.cs` (they require the PKHeX-Plugins AutoMod
  submodule, which is not fetched). The one member Facade itself uses from the
  latter, `Legality()`, is re-declared verbatim in
  `src/PKHeX.Facade.Wasm/FacadeExtensionsShim.cs`. The web/CLI/plugin projects
  are not linked. See `MODIFICATIONS.md`.

```text
MIT License

Copyright (c) 2024 Arley Pádua

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Vendored cryptography (MD5, AES-128) — MIT

- **Source**: [bcgit/bc-csharp](https://github.com/bcgit/bc-csharp) (BouncyCastle C#),
  pinned at `214b5f881be55d708e528ae43693a70211557075`
- **License**: MIT
- **Role**: pure-managed MD5 / AES-128-ECB implementations registered into
  PKHeX.Core's `RuntimeCryptographyProvider` during bootstrap, because native
  crypto APIs throw under the bare mono-wasm runtime.
- **Scope**: algorithm files verbatim; support utilities trimmed to referenced
  members. File-by-file mapping and the re-sync ritual:
  `src/PKHexWasm/Crypto/Vendored/PROVENANCE.md` inside
  [`complete-source.tar.gz`](./complete-source.tar.gz).
- The CBC-NoPadding mode around the vendored AES engine is this project's own work.

## .NET runtime — MIT

The wasm runtime under `wasm/_framework/` is produced by the .NET SDK
(MIT-licensed components of the .NET project) from Microsoft.
