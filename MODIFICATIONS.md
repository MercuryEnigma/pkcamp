# pkCamp modifications

Copyright (C) 2026 MercuryEnigma and pkCamp contributors.
Original pkCamp code is GPL-3.0-or-later; upstream components retain their licenses.

## Distribution notice added 2026-10-17

pkCamp combines upstream Pokémon save tools and GB-Link communication code with
its own React interface, storage providers, and TypeScript integration layers.
It is a modified distribution, not an official release of the upstream projects.

- GB-Link-Switch-LDN: changed the trainer name to `PkCamp` in `trade/rfu.js`
  and replaced an import with the identical local mode constant in
  `cable/cable.js`. See its [provenance](src/services/tradeDevice/vendor/gb-link-switch-ldn/PROVENANCE.md).
  These existing modifications are documented here on 2026-10-17; this is not a
  claim about their original edit dates. Mystery Gift files are copied unmodified.
- Cart Doctor: ported its multiboot and cartridge protocols to TypeScript;
  added save-only transfer handling and checksum validation. Its bundled ROMs
  are unmodified. See its [provenance](src/services/gbaSaveDump/vendor/gb-cart-doctor/PROVENANCE.md).
- gblink-wondercards: upstream JavaScript files are unmodified; pkCamp supplies
  its own shared transport and UI integration. Local `.d.ts` files are original.
- pkhex-wasm / PKHeX.Everywhere: the dated
  [modification log](vendor/pkhex-wasm/tools/package/templates/MODIFICATIONS.md)
  records the Facade integration, ribbon API, binding, and packaging changes.
- Poké Transporter GB and ribbon icons are copied unmodified, as recorded in
  their provenance files.

On 2026-10-17, dated in-file modification notices were also added to `trade/rfu.js`
and `cable/cable.js`, preserving upstream comments. The SDK is now pinned and the
actual browser runtime version is checked against its license-notice pin. Source links point to the repository and exact upstream revisions.

This update adds license metadata, FIX94's MIT notice, deployable license texts,
credits, and GitHub source links. Later changes should update the relevant local
provenance and modification notices as well as the deployed source links.
