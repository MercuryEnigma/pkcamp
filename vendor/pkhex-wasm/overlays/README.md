# Upstream overlays

`external/` is re-fetched at pinned commits and never committed. Local
additions to those upstream sources live here instead, and
`scripts/setup-pkhex-wasm.mjs` (in the pkcamp root) applies them after checkout.

- `PKHeX.Everywhere/src/PKHeX.Facade/Pokemons/Ribbons.cs` is copied in as-is.
- `Pokemon.cs` in the same folder gets one line, `public Ribbons Ribbons => new(pokemon);`,
  inserted after the `Egg` property. The setup script makes that edit.
