# pkCamp

Source for [mercuryenigma.github.io/pkcamp](https://mercuryenigma.github.io/pkcamp) —
a static site about Pokémon game internals.

## License and credits

Copyright (C) 2026 MercuryEnigma and pkCamp contributors.
pkCamp's original code is licensed under the **GNU General Public License,
version 3 or (at your option) any later version (GPL-3.0-or-later)**. You may
redistribute and modify it under those terms. It is provided without warranty;
see [LICENSE](LICENSE) for the full terms.
Third-party components retain their respective licenses and copyright notices;
see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), the linked provenance files,
and [MODIFICATIONS.md](MODIFICATIONS.md).

The vendored [GB-Link-Switch-LDN](src/services/tradeDevice/vendor/gb-link-switch-ldn/)
code (Switch trading, the Switch Mystery Gift relay, and the ESP32 trade path)
remains under its upstream AGPL terms. GPLv3 and AGPLv3 section 13 permit this
combination. AGPLv3's network-interaction source requirements apply to the combined
application, including its GPL-covered portions; pkCamp's original code remains
GPL-3.0-or-later. The source offer must cover the complete corresponding source of
the version being served, including local modifications and build scripts.
The site's GitHub button and `licenses/SOURCES.md` provide source access.

The site's GitHub button opens this repository. Its bottom-right **License** link
opens the license on GitHub. Production builds also include third-party notices and source links in `licenses/`.

## Build and corresponding source

Use Node 24 and .NET SDK 10.0.401 (pinned in `global.json`) with the `wasm-tools`
workload installed:

```sh
dotnet workload install wasm-tools
npm run setup:pkhex-wasm
npm ci
npm run build
```

`npm run setup:pkhex-wasm` fetches the pinned PKHeX sources, applies the checked-in
overlays, and builds the WASM package. `npm run build` packages the site together
with license notices and GitHub source links in `licenses/`. Packaging fails if
required license files are missing. No private Dropbox credentials or
personal save fixtures are required to build the application.

Source is available at [MercuryEnigma/pkcamp](https://github.com/MercuryEnigma/pkcamp).
`licenses/SOURCES.md` links to the application's build commit and the exact
upstream PKHeX and payload revisions. Keep the repository public and retain those
revisions for deployed versions. No source archives are created or published by
the site license packager. See [docs/LICENSING.md](docs/LICENSING.md) for release
checks and attribution records.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

UI copy lives in `src/services/i18n/{page}/en.json`. Run `npm run check:i18n`
to check JSX text and presentation attributes. See the
[i18n architecture](src/services/i18n/ARCHITECTURE.md) for namespaces, key conventions,
and adding translations.
