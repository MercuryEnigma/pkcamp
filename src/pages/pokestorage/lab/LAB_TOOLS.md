# Plan: Define the Lab's Research Tools (GBA scope)

## Context

Research Tools is only a placeholder today: one sentence in `PLAN.md:45-47`, two roadmap items
(`ROADMAP.md:41-42`), and a "coming later" card in `src/pages/pokestorage/lab/LabMenu.tsx:113-122`.
The user has now chosen the GBA-focused scope. This change writes that scope down so later
implementation sessions have a spec. It is a docs-only change plus the Lab card's planned list. Other
generations are deferred.

Facts this builds on:

- `src/services/gbaSaveDump` already multiboots the vendored Cart Doctor dumper over GB-Link and
  reads/writes Gen 3 saves (`readGbaSave` / `writeGbaSave`, `GbaCartClient`, `multiboot`).
- Cart Doctor 1.4.0 also dumps GB/GBC/GBA ROMs and GB/GBC SRAM, dumps the BIOS, and erases saves.
  Its restore refuses a size mismatch.
- `Esp32TradeDevice` is the existing Switch boundary.
- Poke Transporter GB ships `Poke_Transporter_GB_mb.gba` (multiboot, MIT code). It needs a GBC link
  cable and supports R/B/Y/G/S/C → R/S/FR/LG/E, using PCCS "LEGAL" conversion.

## Decided scope (user-confirmed)

1. **Cartridge ROM dump** for GB/GBC/GBA through the Cart Doctor dumper over GB-Link.
   - Verify against known-good hashes where available.
   - Optional BIOS dump.
   - **Local only:** download, or keep in browser storage for the emulator. Never synced to
     Dropbox or uploaded.
2. **Cartridge save backup/restore** for GB/GBC/GBA.
   - Generalizes the existing Gen 3 `readGbaSave`/`writeGbaSave` into a standalone tool.
   - Saves go to Cabins like today. Restoring always backs up first.
   - Erase save is guarded behind that backup.
3. **Mystery Gift delivery** of a curated, verified gift catalog.
   - Targets: GBA carts (GB-Link) and Switch GBA FR/LG (ESP32).
   - Covers Wonder Card + script contents: items/tickets, Pokémon, eggs.
   - Shows the unlock phrase help.
4. **Switch GBA save download** via a Mystery Gift script that sends save data back over the ESP32
   link into a Cabin. A research spike comes first to prove it's feasible.
5. **Poke Transporter GB launcher.**
   - Multiboot the PTGB ROM over GB-Link, then guide the cable swap to a GBC link cable.
   - Fallback: a download of the official release files with flash cart instructions.
   - Pin the release version and keep its provenance and license, as we do for the Cart Doctor vendor.
   - Prompt a save backup of both carts first.
6. **Ruby/Sapphire berry glitch fix + clock (RTC) reset/diagnosis** over GB-Link, with a save backup
   first.

Explicitly deferred: R/S Mystery Event and GameCube-era events, cart authenticity check, Save
Inspector, emulator handoff/conversion, and non-GBA generations. List them as "later" ideas.

## Changes

### 1. `PLAN.md`, Lab Zone section (replace lines 44-47 wording about Research Tools)

Rewrite the Research Tools sentence into a short paragraph that matches the file's terse prose style:

- Name the six tools above in one or two sentences.
- State that each must specify the following before it is built, keeping the existing gate:
  - supported games/devices
  - data sources/contents
  - backup-before-write
  - failure/recovery
- Note that ROM/BIOS dumps stay local, and that the Switch save download is unproven until a spike.

### 2. `ROADMAP.md`, Lab Zone checklist (replace lines 41-42)

Replace the two Mystery Gift items with unchecked items, in build order:

- [ ] Add a Research Tools hub in the Lab with GB-Link capability checks.
- [ ] Back up and restore GB/GBC/GBA cartridge saves from Research Tools.
- [ ] Dump GB/GBC/GBA ROMs (and the GBA BIOS) to local-only storage with hash verification.
- [ ] Launch Poke Transporter GB over GB-Link multiboot, with a download fallback.
- [ ] Fix the Ruby/Sapphire berry glitch and reset or diagnose cartridge clocks.
- [ ] Specify the Mystery Gift catalog, contents, compatible games/devices, and recovery behavior.
- [ ] Deliver verified Mystery Gifts to GBA carts and Switch GBA FR/LG.
- [ ] Prove, then build, Switch GBA save download via Mystery Gift.

### 3. `src/pages/pokestorage/PLAN.md` (optional, one line)

Add a single cross-reference in the Lab section. It should say that cartridge save backup/restore in
Research Tools reuses the Camp GB-Link save transfer (`gbaSaveDump`) rather than a second path.

### 4. `src/pages/pokestorage/lab/LabMenu.tsx`

Update the Research Tools station:

- `description`: "Cartridge dumps, Mystery Gifts, and repair tools are coming later."
- `planned` entries, each with a one-line description:
  - Cartridge Dumps (ROM and save)
  - Mystery Gifts (GBA and Switch)
  - Switch Save Download
  - Poke Transporter GB
  - Berry Fix & Clock
    Keep the existing `{ name, description }` shape.

## Verification

- `npm run lint` and `npm test`. The LabMenu copy change should not break tests. Grep the tests for
  "Mystery Gifts and research utilities" first and update any assertion that matches.
- `node scripts/verify-navigation.mjs` (or the project's browser navigation test) still passes.
- Open the Lab and check that the Research Tools card lists the five planned entries at phone width.
