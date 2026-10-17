# Research Tools roadmap

## Hub and shared workflow

- [x] Open four responsive workspaces from Celio's Lab: Cartridge Saves, ROM & BIOS Dumps, Mystery Gifts, and Poké Transporter GB.
- [x] Match Camp's header/Back placement, stack cards on small screens, and leave room for hover effects.
- [x] Keep tools browsable without hardware; request access on Start and reuse GB-Link between sequential tasks.
- [x] Protect active operations with navigation/page-exit guards and exclusive device leases.
- [x] Reuse the shared cartridge task helpers tracked in the [Camp checklist](../ROADMAP.md#trading-and-cartridge-transfers).
- [x] Reuse GB-Link firmware maintenance and hardware settings tracked in the [Camp checklist](../ROADMAP.md#shared-hardware-settings).
- [x] Reject late device selections after cancellation or page exit; suppress stale callbacks and late success messages.
- [x] Share repeated Stop/disconnect cleanup and block competing reconnects until cleanup completes.
- [x] Show chooser cancellation without opening a second Serial chooser after USB selection is dismissed.
- [x] Preserve restore confirmation, pre-write backups, and interrupted-write recovery warnings.
- [ ] Improve remaining generic permission/transport errors with operation-specific recovery instructions.
- [ ] Standardize save/ROM/BIOS download wording to say the browser download started rather than claiming the file was saved.

## Cartridge Saves

- [x] Download GBA cartridge saves as header-named local .sav files without requiring a Gen 3 save.
- [x] Detect a selected Gen 3 restore file's game and validate matching cartridge/game/save size.
- [x] Store the cartridge's original save as the Cabin hardware backup before writing.
- [x] Keep unsupported operations unavailable with a reason.
- [x] Record player-confirmed hardware coverage for backup/restore and previously discussed recovery cases.

### Repair

- [ ] Define supported Ruby/Sapphire versions and hardware for berry repair.
- [ ] Define RTC diagnosis/reset support and explain each operation before confirmation.
- [ ] Require diagnosis and a successful backup before applicable changes.
- [ ] Implement verified repair/reset with result and recovery guidance.

### Switch save download

- [ ] Prove save extraction over ESP32 with a Mystery Gift script.
- [ ] Record supported versions, integrity checks, limits, interruption behavior, and go/no-go evidence.
- [ ] If proven, implement validated local .sav download and recovery.
- [ ] Remove the In research label only after verification; keep Switch restore out of scope.

## ROM & BIOS Dumps

- [x] Provide separate GBA ROM and BIOS dump actions using Cart Doctor, progress, and local downloads.
- [x] Keep ROM/BIOS bytes out of account storage and all upload paths.
- [x] Reject incomplete/checksum-failed transfers before downloading.
- [x] Record player-confirmed ROM/BIOS hardware checks and previously discussed error/retry cases.
- [ ] Add GB/GBC ROM dumping.
- [ ] Define known-good hash sources/provenance and verified/mismatched/unknown reporting.
- [ ] Retain successful dump bytes for downloading again.
- [ ] Add automated coverage for download-trigger failures and repeated checksum failure.

## Mystery Gifts

- [x] Vendor pinned GBA/Switch senders and card data with provenance/licenses.
- [x] Provide GBA/Switch selection, six curated cards, and upstream catalog links.
- [x] Deliver through GB-Link Wireless Adapter mode or ESP32 with firmware/key requirements.
- [x] Use short steps: start the sender, wait for Ready, then choose Mystery Gift in the game.
- [x] Support Cancel during startup and Stop for an open group; release reservations and ignore late callbacks.
- [x] Record player-confirmed delivery to various GBA games and supported Switch games.
- [ ] Record a per-card/game/language compatibility matrix before claiming exhaustive hardware coverage.

## Poké Transporter GB

- [x] Define compatibility, layout, recovery, and pinned-release requirements in [POKE_TRANSPORTER_GB.md](POKE_TRANSPORTER_GB.md).
- [x] Bundle official v1.2.1 with size/SHA-256 validation, provenance, and license; reject modified bytes.
- [x] Offer optional GB/GBC source and GBA destination save backups above the primary launch action.
- [x] Retain completed backup bytes for downloading again until leaving the page.
- [x] Keep backups and launch sequential on the shared device.
- [ ] Simplify launch gating so finishing a backup does not require closing its panel with idle Cancel.
- [x] Multiboot the verified program through the shared GB-Link with progress, cancellation, and recovery instructions.
- [x] Explain compatibility, bootleg/save-change risks, EZ-Flash notes, and the Game Boy Color cable handoff.
- [x] Distinguish program-sent completion from console-to-console Pokémon transfer completion.
- [x] Validate transporter launch, cable handoff, and console transfer on hardware; completed by the player.
- [x] Record transporter backup-completion testing covered by the other team, as confirmed by the player.
- [x] Test GB/GBC receive cancellation, bad-section retry, and rejection of ROM/restore headers.
- [ ] Add automated handshake-timeout, mid-upload disconnect/cancel, exhausted checksum retry, and multi-step lease/retry coverage.
- [ ] Document recovery of both downloaded saves with compatible restore tools.

## Verification

- [x] Check responsive hub/tool/Back navigation, transporter backup selection, launch gating, and overflow at 320×568, 390×844, 768×500, and 1144×703.
- [x] Test restore game/size mismatch, backup-before-write order, storage failure before write, and interrupted upload.
- [x] Add a browser regression script for cancellation, leave-warning veto/accept, late chooser/results, and gift shutdown/failure.
- [ ] Run [verify-hardware-lifecycle.mjs](../../../../scripts/verify-hardware-lifecycle.mjs).
- [ ] Complete keyboard, focus, screen-reader status, long-description, and post-upload instruction checks.
- [ ] Broaden browser automation for capability gating, storage-provider failures, and local-only downloads.
- [ ] Verify tool/Back navigation and active-operation guards from the production/static deployment.
- [ ] Complete the release checks in the [site checklist](../../../../ROADMAP.md#site-wide-foundation-and-cleanup).
