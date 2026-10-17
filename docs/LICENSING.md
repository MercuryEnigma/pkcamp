# Licensing and release checks

pkCamp's original code is GPL-3.0-or-later. Keep the root LICENSE text unchanged;
metadata and notices state the project's chosen version. Preserve upstream
licenses rather than replacing them with the root license.

## What production builds publish

`npm run build` packages the `licenses/` directory after
TypeScript and Vite succeed. These contain legal notices, credits, full license
texts, and GitHub source links. No source archives are created or published.
`licenses/SOURCES.md` links to the application's build commit and exact upstream revisions.
`licenses/build.json` records the commit and whether tracked changes were present.

PKHeX.Everywhere and Core source checkouts are gitignored; their exact GitHub
revisions are linked separately. The checked-in setup script and overlays record
how they are fetched and modified. Cart Doctor payload source/build scripts are
also linked at the exact revision from the local provenance file.

## AGPL component

GB-Link-Switch-LDN in `src/services/tradeDevice/vendor/gb-link-switch-ldn/`
retains its upstream AGPL terms (its `cable/translator.js` is MPL-2.0).
GPLv3 and AGPLv3 section 13 permit the combination while preserving the respective
licenses of its parts. AGPLv3's network-interaction source requirements apply to
the combined application, including its GPL-covered portions. Offer the complete
corresponding source of the served version, including local modifications,
required dependencies, and build scripts. Keep the in-app source link and the
build-commit link working. Code copied or adapted from the AGPL component retains
its upstream AGPL obligations.

See [GPLv3 section 13](https://www.gnu.org/licenses/gpl-3.0.html#section13)
and the [GNU explanation of corresponding source for combined works](https://www.gnu.org/licenses/gpl-faq.en.html#AGPLv3CorrespondingSource).

## Source links

Source: https://github.com/MercuryEnigma/pkcamp

License: https://github.com/MercuryEnigma/pkcamp/blob/main/LICENSE

`licenses/SOURCES.md` links to the build commit and pinned upstream revisions.

## Before releasing

1. Run `npm run setup:pkhex-wasm` after any WASM source/overlay changes. Update
   .NET runtime notices when updating the runtime version. The SDK is pinned to
   `10.0.401` in `global.json` and CI, but `wasm-tools` installs the newest
   workload set, so the browser runtime can move to a newer 10.0 patch. The
   license packager accepts any 10.0.x runtime: a patch difference from the
   notices (`10.0.12`) only warns, and the licenses output links that exact
   release's source and notices. A new major/minor line fails the build until
   the notices are updated.
2. Preserve upstream copyright statements and record local changes and dates in
   MODIFICATIONS.md or component logs. Verify licenses at the revisions used.
3. Commit changes before production deployment. Run `npm ci`, `npm run lint`,
   `npm test`, and `npm run build` with available test fixtures.
4. Keep the pkCamp repository public and its deployed source commits accessible.
   Check every GitHub source link from a signed-out browser, including the pinned
   external sources. A private or missing repository is not an adequate source
   offer. Do not deploy unpublished working-tree changes: a commit link would
   then omit the actual changes being served.
5. Confirm deployed license and source links work. Production GitHub Actions
   sets `GITHUB_SHA`, which the packager uses for the application's source link.

## License and attribution records

Upstream pkhex-wasm's current `package.json` declares `GPL-3.0-or-later`, as does
the vendored package. The upstream repository has no root LICENSE file; the
vendored README still contains older wording that licensing is being settled.
Record the author's metadata declaration without treating that older README as
the absence of a license declaration. Adding a root license file upstream would
make the documentation clearer; the current HEAD declaration and the evidence
for our pinned revision should remain distinguished.

The project maintainer has completed the asset and contributor-term reviews for
the current sprite/portrait collections and bundled event resources. These assets
retain their own rights and attribution requirements; the software license does
not relicense them. Preserve the existing credits and review applicable terms
when adding or replacing resources.

This implementation documents known software license obligations; it is not
certification of legal compliance.
