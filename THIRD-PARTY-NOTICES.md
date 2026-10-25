# Third-party notices and credits

pkCamp's original code is GPL-3.0-or-later. The licenses below continue to apply to
their respective components; this document does not relicense upstream work.
Copyright statements and full license texts are preserved in the linked files
and are included in the production site's `licenses/` directory.

## Incorporated code and payloads

The vendored [GB-Link-Switch-LDN](src/services/tradeDevice/vendor/gb-link-switch-ldn/)
code (Switch trading, the Switch Mystery Gift relay, and the ESP32 trade path)
remains under its upstream AGPL terms. GPLv3 and AGPLv3 section 13 permit this
combination. AGPLv3's network-interaction source requirements apply to the combined
application, including its GPL-covered portions; pkCamp's original code remains
GPL-3.0-or-later. The source offer must cover the complete corresponding source of
the version being served, including local modifications and build scripts.

| Project / contributors                                                                                                 | Revision used                                                                                          | License and local record                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PKHeX](https://github.com/kwsch/PKHeX), kwsch and contributors; arleypadua fork                                       | `10016c6fe5b732a113c3ca732116ea8976dc1f2c`                                                             | GPL-3.0-or-later; [Core, Facade, and WASM notices](vendor/pkhex-wasm/tools/package/templates/THIRD-PARTY-NOTICES.md). Also supplies unmodified [ribbon icons](public/ribbons/PROVENANCE.md).                                                                                                                                                                                                               |
| [pkhex-wasm](https://github.com/EthanThatOneKid/pkhex-wasm), EthanThatOneKid and contributors                          | `29b1c1a65cc7eab7b32003bd30b7a325737cd28a` plus local changes                                          | Upstream’s current package.json and the vendored package declare GPL-3.0-or-later. Upstream has no root LICENSE file; the vendored README retains older wording that licensing is being settled. [Fork notes](vendor/pkhex-wasm/FORK_NOTES.md) and [modifications](vendor/pkhex-wasm/tools/package/templates/MODIFICATIONS.md). Current HEAD metadata is distinguished from the pinned revision’s records. |
| [PKHeX.Everywhere](https://github.com/arleypadua/PKHeX.Everywhere), Arley Pádua                                        | `c8836824d128152bfabb489daa18eb8e1493a201`                                                             | MIT at this pin, Copyright (c) 2024 Arley Pádua; full notice in the WASM notices above. Later upstream licensing differs.                                                                                                                                                                                                                                                                                  |
| [GB-Link-Switch-LDN](https://github.com/GB-Link/GB-Link-Switch-LDN), GB-Link and contributors                          | `c1a3a97f3ab5c60e87307089d6b7db10e3fd5993`; gift files from `8b47745dd2b8efcddb9ff93e4ad319eae4b95f25` | [AGPL v3](src/services/tradeDevice/vendor/gb-link-switch-ldn/LICENSE); gift code derived from gblink-wondercards retains GPL v3 terms. [Scope and modifications](src/services/tradeDevice/vendor/gb-link-switch-ldn/PROVENANCE.md).                                                                                                                                                                        |
| [mgba_LDN](https://github.com/Gr3nSkyDragon/mgba_LDN), mGBA and fork contributors                                      | Cable translator as included in the pinned GB-Link-Switch-LDN source above                             | [MPL-2.0](src/services/tradeDevice/vendor/gb-link-switch-ldn/cable/LICENSE.MPL-2.0); exact translator source is included in pkCamp’s GitHub repository.                                                                                                                                                                                                                                                    |
| [gb-cart-doctor-web](https://github.com/GB-Link/gb-cart-doctor-web), GB-Link and contributors                          | `12aa211923add22a567e5c4310ebb45605cd49bf`                                                             | [GPL v3](src/services/gbaSaveDump/vendor/gb-cart-doctor/LICENSE); MIT GBA dumper component; [provenance and upstream source](src/services/gbaSaveDump/vendor/gb-cart-doctor/PROVENANCE.md).                                                                                                                                                                                                                |
| [gba-link-cable-dumper](https://github.com/FIX94/gba-link-cable-dumper), FIX94; upstream credits Chishm and Dark Fader | Incorporated through the Cart Doctor revision above                                                    | [MIT, Copyright (c) 2016 FIX94](src/services/gbaSaveDump/vendor/gb-cart-doctor/LICENSE.MIT).                                                                                                                                                                                                                                                                                                               |
| [gblink-wondercards](https://github.com/GB-Link/gblink-wondercards), GB-Link and contributors                          | `24d5b63c8f2c0609afa9497ed648a2bf173cae7a`                                                             | [GPL v3](src/services/mysteryGift/vendor/gblink-wondercards/LICENSE); [scope](src/services/mysteryGift/vendor/gblink-wondercards/PROVENANCE.md).                                                                                                                                                                                                                                                           |
| [Poké Transporter GB](https://github.com/Striaton-Lab-Team/Poke_Transporter_GB), Striaton Lab Team                     | Release `1.2.1`                                                                                        | [MIT](src/services/pokeTransporter/vendor/LICENSE); [asset hash and provenance](src/services/pokeTransporter/vendor/PROVENANCE.md).                                                                                                                                                                                                                                                                        |
| [picoflash](https://github.com/GB-Link/gblink-launcher/tree/bac443a78c05476a2b82ebab021ea58747966998/assets/js/picoflash), Piers Finlayson; via GB-Link/gblink-launcher | `bac443a78c05476a2b82ebab021ea58747966998` | [MIT, Copyright (c) 2025 Piers Finlayson](src/services/tradeDevice/vendor/picoflash/LICENSE); unmodified, [provenance](src/services/tradeDevice/vendor/picoflash/PROVENANCE.md). |
| [Bouncy Castle](https://github.com/bcgit/bc-csharp), The Legion of the Bouncy Castle Inc.                              | `214b5f881be55d708e528ae43693a70211557075`                                                             | [MIT and copyright notice](vendor/pkhex-wasm/src/PKHexWasm/Crypto/Vendored/LICENSE.md); [modified subset](vendor/pkhex-wasm/src/PKHexWasm/Crypto/Vendored/PROVENANCE.md).                                                                                                                                                                                                                                  |
| [.NET runtime](https://github.com/dotnet/runtime), .NET contributors                                                   | Current runtime `10.0.12`                                                                              | [MIT and third-party notices](vendor/dotnet-runtime-notices/PROVENANCE.md).                                                                                                                                                                                                                                                                                                                                |
| [mGBA WASM](https://github.com/thenick775/mgba), Jeffrey Pfau, Nicholas VanCise, and contributors                      | npm `@thenick775/mgba-wasm@2.5.1`, source `e974b288bd7e5cfc7c7b96f8b4d32b673ddfb68c`                   | MPL-2.0. The npm archive omits its license file; the production packager includes the identical full MPL-2.0 text already preserved for the mGBA-derived cable component, plus this exact source link.                                                                                                                                                                                                       |

## JavaScript runtime dependencies

React, React DOM, Scheduler, fflate, i18next, react-i18next, @babel/runtime,
html-parse-stringify, and use-sync-external-store retain their package licenses
(currently MIT). pdfjs-dist (Mozilla pdf.js, Apache-2.0) draws the PDF artwork of
imported controller skins; it is loaded only when a skin needs it. Versions are pinned by `package-lock.json`. The license packager
includes their original license texts and copyright statements, recursively
including production dependencies. Development tools retain their own licenses;
using a tool to build pkCamp does not relicense that tool or its output.

## ROM extraction reference

## Protocol references and related projects

[HexManiac Advance](https://github.com/haven1433/HexManiacAdvance) is the
reference for the initial vanilla Gen III ROM table anchors. Its MIT notice is
preserved at
[src/services/guide/HEXMANIAC-ADVANCE-LICENSE.txt](src/services/guide/HEXMANIAC-ADVANCE-LICENSE.txt)
and packaged at `licenses/hexmaniac-advance/LICENSE.txt`.

[GBLink-Firmware](https://github.com/GB-Link/GBLink-Firmware) and
[Celio-Client](https://github.com/Celio-Link/Celio-Client) (GPL v3) were protocol
references; their firmware/client code is not copied into pkCamp's original
TypeScript transport. See [GBLINK_PROTOCOL.md](src/services/tradeDevice/GBLINK_PROTOCOL.md).
[gba-multiboot-web](https://github.com/GB-Link/gba-multiboot-web) (GPL v3) is a
documented workflow reference for Poké Transporter GB.

## Sprite and data credits

- [PokeAPI](https://github.com/PokeAPI/pokeapi) and [PokeAPI/sprites](https://github.com/PokeAPI/sprites): species metadata and sprites.
- [PkmnShuffleMap](https://github.com/nileplumb/PkmnShuffleMap): Pokémon Shuffle icons.
- [PMDCollab / SpriteCollab](https://github.com/PMDCollab/SpriteCollab): Mystery Dungeon portraits and metadata, created by its individual contributors.
- [Pokémon Database](https://pokemondb.net/sprites): HOME sprite hosting.
- [Ribbon Helper](https://github.com/MercuryEnigma/ribbon-helper): image mappings and form metadata.

These are credits, not a statement that all artwork is GPL, AGPL, or MIT licensed.
Pokémon names, images, and related material belong to their respective owners,
including Nintendo / Creatures Inc. / GAME FREAK inc. Asset and contributor-term
reviews have been completed by the project maintainer. Preserve applicable terms
and credits when updating assets. pkCamp is not affiliated with or endorsed by
those companies.
