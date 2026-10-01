# pkhex-wasm — pkcamp vendored fork

This directory is a plain vendored copy of pkhex-wasm, not a git submodule.
pkcamp builds the npm package it depends on from here.

## Provenance

| What | Source | Commit | License |
| --- | --- | --- | --- |
| pkhex-wasm (this tree) | <https://github.com/EthanThatOneKid/pkhex-wasm> | `29b1c1a65cc7eab7b32003bd30b7a325737cd28a` (2026-08-26, "v2 binding scaffold…") | wrapper: see upstream; bundle: GPL-3.0-or-later |
| PKHeX.Everywhere (hosts PKHeX.Facade) | <https://github.com/arleypadua/PKHeX.Everywhere> | `c8836824d128152bfabb489daa18eb8e1493a201` | MIT |
| PKHeX.Core fork | <https://github.com/arleypadua/PKHeX> | `10016c6fe5b732a113c3ca732116ea8976dc1f2c` | GPL-3.0-or-later |

- **Cloned:** 2026-09-24, from upstream `HEAD`. Upstream's `.git` was removed so
  pkcamp's own history tracks these files.
- **Why HEAD, not the `v0.1.0` tag:** the task asked for the repository
  itself. HEAD's wasm host did not compile (it failed in upstream's v2
  scaffold); the fix is logged in `MODIFICATIONS.md`.
- **Change log (GPLv3 §5a):**
  [`tools/package/templates/MODIFICATIONS.md`](tools/package/templates/MODIFICATIONS.md).
  This is upstream's own log and ships inside the built package. The pkcamp
  entry is on top.
- **Third-party notices:**
  [`tools/package/templates/THIRD-PARTY-NOTICES.md`](tools/package/templates/THIRD-PARTY-NOTICES.md).
  It now records PKHeX.Facade (MIT) as linked into the bundle.
- **Corresponding source (GPLv3 §6):** every build writes
  `dist/complete-source.tar.gz`. That archive holds this tree plus the pinned
  `external/` sources.

## `external/` is not committed

`external/` is gitignored in pkcamp. It holds upstream's submodules with their
own `.git` directories. Re-fetch them at the pins above with:

```sh
cd vendor/pkhex-wasm/external
git clone --filter=blob:none https://github.com/arleypadua/PKHeX.Everywhere.git PKHeX.Everywhere
cd PKHeX.Everywhere
git checkout c8836824d128152bfabb489daa18eb8e1493a201
# Only the Core fork is needed. PKHeX-Plugins (AutoMod) is deliberately not fetched.
git submodule update --init --filter=blob:none external/PKHeX   # -> 10016c6f…
```

## Building

The build needs the .NET SDK 10.x with the `wasm-tools` workload
(`dotnet workload install wasm-tools`), plus Node. Deno is only needed for the
API generator and its gates. From the pkcamp root:

```sh
npm run build:pkhex-wasm   # dotnet publish -> esbuild -> brotli -> GPL kit -> dist/
npm install                # package.json points pkhex-wasm at file:./vendor/pkhex-wasm/dist
```

These are the gates used while developing this fork. Run them in this
directory:

```sh
deno task reflect && deno task gen   # regenerate runtime-meta + d.ts after changing exports
deno task gen:check                  # drift gate
deno task apigen:test
deno task typecheck
dotnet test pkhex-wasm.slnx          # 4 Gen 7/LGPE failures are pre-existing upstream (see MODIFICATIONS.md)
```

`dist/` is gitignored upstream, and that nested `.gitignore` also applies
inside pkcamp. A fresh pkcamp clone therefore needs `npm run build:pkhex-wasm`
(and so the .NET toolchain) before `npm install` resolves `pkhex-wasm`. The
alternative is to commit `dist/` (about 54 MB) — that decision is left open.
