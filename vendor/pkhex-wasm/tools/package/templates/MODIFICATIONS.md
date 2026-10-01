# Modifications to upstream sources

GPLv3 §5a requires modified versions to "carry prominent notices stating that
you changed the software". This log records every deviation of pkhex-wasm from
the vendored upstreams pinned in [`upstream.json`](./upstream.json). New
entries go on top; each entry names what changed and why.

## pkcamp fork (2026-09-25, ribbons) — new PKHeX.Facade ribbon-reading API

Facade had no ribbon API at all (its `PokemonFlags` covers Pokérus only), so
this is new source added to Facade, not a workaround built around it in the
wasm binding layer:

- **`external/PKHeX.Everywhere/src/PKHeX.Facade/Pokemons/Ribbons.cs`, new.**
  - *What*: a `Ribbons` wrapper (constructed from a `PKM`, matching the
    `Egg`/`PokemonForm` convention) exposing a `Held` property: every ribbon
    the entity currently has, as `RibbonDefinition(Id, Name, PropertyName)`
    records. Discovery goes through PKHeX.Core's own
    `RibbonInfo.GetRibbonInfo(PKM)` — the reflection-based enumerator Core's
    own ribbon editor UI uses, since which `Ribbon*` properties a `PKM`
    subtype has is generation-dependent (a matter of which `IRibbonSetXxx`
    marker interfaces it implements). Display names come from Core's
    `GameInfo.Strings.Ribbons` (a `RibbonStrings`, the same localization table
    the ribbon editor reads). A stable numeric id is attached where Core has
    one: Core's modern `RibbonIndex` enum where a name matches, else its
    Generation-3-only `RibbonIndex3` enum (offset by `+1000` so the two
    zero-based id spaces cannot collide) for ribbons Generation 3 alone ever
    had (e.g. the Hoenn Battle Tower ribbons), else `-1`.
  - *Generation 3 wrinkle*: the five contest ribbons are stored as one 0-4
    tier count each (`RibbonCountG3Cool`, etc.), not five bare booleans. Each
    count is expanded into the individual named tiers it implies (a count of
    2 yields both the base and "Super" tier), matching the tier names Core
    itself uses when converting a Generation 3 entity forward to Generation
    4's boolean-per-tier scheme. Verified against this app's real Gen 3
    fixtures (`emerald.sav`, `firered.sav`, `ribbondol.pk3` — the latter
    chosen specifically because it carries ribbons).
  - *Why not fully generation-generic*: `RibbonInfo` itself is generation-
    agnostic (it reflects whatever the concrete `PKM` type declares), so
    boolean ribbons already work unmodified for any generation. Only the
    byte-valued tier expansion is scoped to Generation 3's specific counter
    layout (`RibbonCountG3*`, 4 tiers) — this app's real fixtures are
    Generation 3 only, and later generations' byte-valued ribbons (e.g.
    Generation 6's memory-contest/battle counters) are a different shape
    (plain magnitude, not named tiers) that would need a real fixture to
    verify against rather than guessing.
- **`external/PKHeX.Everywhere/src/PKHeX.Facade/Pokemons/Pokemon.cs`.**
  - *What*: added `public Ribbons Ribbons => new(pokemon);`, alongside the
    existing `Egg`/`Form` properties.
  - *Why*: same getter convention as every other per-entity Facade facet.
- **Binding + exports** (`src/PKHexWasm/PKHexApi.cs`,
  `src/PKHexWasm.Wasm/PkHexExports.cs`): `Mon.RibbonIds(mon)` and
  `MonRibbonNames(mon)`, two parallel arrays (JS interop marshals only
  single-typed arrays, not records) paired by index into `RibbonRef[]` at the
  TS boundary — the same flatten-then-reshape pattern the existing
  `MonMoveSlots` export uses for `MoveSlot[]`.
- **Drift-gate bookkeeping** (`tools/apigen/model.ts`, `mappings.ts`): added
  the `RibbonRef` type and `Pokemon.ribbons` model member, and mapped both new
  exports.
- **Tests**: `tests/PKHexWasm.Tests/FacadeAdditionsTests.cs` gained four cases
  (no ribbons, boolean ribbons with id resolution, the Generation-3-only
  legacy-offset id path, and contest-tier count expansion), all against a
  detached `PK3` (blank Generation 3 saves are not in this suite's loadable
  fixture set, per the existing `DetachedPk3` helper).

The sentence this replaces (below, in the original pkcamp entry) — "PKHeX.Facade
sources are likewise unmodified; only which of its files are compiled
differs" — is no longer accurate as a blanket statement now that Facade has a
new file and a new `Pokemon` property; see above for the one exception.

## pkcamp fork (2026-09-25) — Facade-backed additions on top of upstream `29b1c1a`

This copy is vendored into the pkcamp app at `vendor/pkhex-wasm/` from
<https://github.com/EthanThatOneKid/pkhex-wasm> commit
`29b1c1a65cc7eab7b32003bd30b7a325737cd28a`. Changes, all by the pkcamp project:

- **PKHeX.Facade is now linked** (`src/PKHeX.Facade.Wasm/`, new).
  - *What*: a project file that compiles the pinned
    `external/PKHeX.Everywhere/src/PKHeX.Facade` sources into the bundle,
    excluding `AutoLegality.cs` and `Extensions/PokemonExtensions.cs`;
    `FacadeExtensionsShim.cs` re-declares verbatim the one excluded member Facade
    uses internally (`Legality()`, needed by `MoveRepository`).
  - *Why*: delegate save/entity semantics to Facade instead of re-deriving
    them. The two files are excluded because they need PKHeX-Plugins' AutoMod,
    a second large submodule upstream does not fetch. The submodule tree
    itself is not edited.
- **Binding delegates to Facade** (`src/PKHexWasm/PKHexApi.cs`).
  - *What*: the handle registry now holds `PKHeX.Facade.Game` and
    `PKHeX.Facade.Pokemons.Pokemon` objects. `Load` uses `Game.LoadFrom` and
    `SaveBytes` uses `Game.ToByteArray()`. The v1 `box()`/`party()` accessors
    now read Facade's `PokemonBox.All`/`Party.Pokemons`. After any slot write
    the binding makes, it rebuilds its cached Facade object, because Facade's
    `Trainer` caches box/party lists and commits them on export.
  - *Why*: coordinated change, pkcamp gap closure. v1 semantics are
    unchanged; upstream's C# suite gives the same results as pristine
    upstream (see below).
- **New exports** (`PKHexApi.cs`, `PKHexWasm.Wasm/PkHexExports.cs`; typed in
  `tools/apigen/model.ts`, bound in `src/ts/{pkhex,game,pokemon}.ts`):
  `Game.saveVersion` (Facade `SaveVersion`) and `Game.isVersionAggregated`
  (Facade `GameVersionDefinition.Aggregated`); `Game.boxName(i)`;
  `Game.boxSlots(i)` and `Game.partySlots()`, which are positional with
  `null` for empty slots, normalized once at the JS boundary from Facade's
  blank entities; `Game.setBoxSlot(i, j, pokemon)`, the one piece of new logic
  (exact-index placement written into Facade's `PokemonBox.All` and committed
  with `PokemonBox.Commit()`, since Facade's `AddOrUpdate` is by-UniqueId or
  next-open-slot only); `Game.dispose()`, which surfaces the pre-existing
  idempotent `Close`; `PKHex.parsePkm(bytes)` (Facade `Pokemon.LoadFrom`);
  `Pokemon.form` (Facade `PokemonForm`), `.isEgg` (Facade `Egg`),
  `.heldItem`, `.toBytes()` (Facade `Pokemon.ToFile()`, party layout), and
  `.release()` (idempotent entity-handle release).
- **Upstream HEAD compile fix** (`src/PKHexWasm.Wasm/PkHexExports.cs`).
  - *What*: added the missing `using` directives, plus
    `JSMarshalAs<JSType.Any>` on the v2 scaffold's `object`-typed
    `GetMember`/`SetMember`.
  - *Why*: at `29b1c1a` the wasm host did not compile (the csproj has no
    implicit usings, and `[JSExport]` cannot marshal bare `object`).
- **Drift-gate bookkeeping** (`tools/apigen/mappings.ts`, `model.ts`).
  - *What*: mapped the upstream v2 scaffold exports as `(internal)`, and
    scoped `MUTATOR_NAMES` to `set*` methods.
  - *Why*: re-running the reflector now sees the v2 exports. `MUTATOR_NAMES`
    had to stop counting `toBytes`/`release`; the locked seven-mutator
    invariant is unchanged.
- **Packaging** (`tools/package/lib/kit.mjs`).
  - *What*: the corresponding-source snapshot is taken from the working tree
    with the existing `PRUNE` rules (now also `dist`, `.local-fixtures`)
    instead of `git archive HEAD`, and it is staged in the OS temp dir.
  - *Why*: a vendored copy has no `.git`. Staging under the workspace also
    raced an editor's .NET language server, which recreated `obj/` dirs
    mid-cleanup.
- **Tests** (`tests/PKHexWasm.Tests/FacadeAdditionsTests.cs`, new): cover the
  additions using the upstream blank-fixture factory.
- **Known, pre-existing**: 4 upstream tests fail identically on pristine
  `29b1c1a` with this Core pin: Gen 7 / LGPE fixture reloads, where a
  `Debug.Assert` in Core's `Zukan7` fires. That assert is compiled out of the
  Release wasm bundle.

## Vendored crypto subset (`src/PKHexWasm/Crypto/Vendored/`, since initial import)

- **What**: BouncyCastle-lineage MD5 + AES engine copied verbatim; support
  utilities (`Pack`, `Arrays`, `Integers`, `Platform`) trimmed to the members
  the algorithm files reference, with trims noted in per-file header comments.
- **Why**: shrink the vendored license surface to exactly what the wasm bundle
  executes; native `System.Security.Cryptography` throws under wasmbrowser.
- **Detail**: file-by-file table in `PROVENANCE.md` next to the sources.
- CBC-NoPadding chaining is **not** vendored code — implemented fresh in
  `src/PKHexWasm/Crypto/ManagedAes.cs`.

## PKHeX.Core — no modifications

Compiled into the wasm bundle exactly as pinned in `upstream.json`. All save-
format behavior differences live in this repository's own layers
(`src/PKHexWasm`, `src/ts`), which are original work, not modifications of
upstream code.

PKHeX.Facade started out unmodified — only which of its files were compiled
differed (see the first pkcamp entry above) — until the ribbons entry above,
which added one new Facade source file (`Pokemons/Ribbons.cs`) and one new
property on Facade's existing `Pokemon` class. Every other Facade file
remains byte-for-byte the vendored upstream.
