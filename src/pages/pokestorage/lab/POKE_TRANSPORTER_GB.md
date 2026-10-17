# Poké Transporter GB page reference

Poké Transporter GB moves Pokémon from Red, Blue, Yellow, Gold, Silver, or
Crystal into Ruby, Sapphire, Emerald, FireRed, or LeafGreen. The tool changes
both saves and removes transferred Pokémon from the GB/GBC source, so the page
puts optional backups directly before the launch action.

The high-level goal is in [PLAN.md](PLAN.md). Implementation and verification
status, including player-confirmed hardware checks and the other team's backup
completion coverage, are tracked in [ROADMAP.md](ROADMAP.md).

## Pinned release and technical references

- Release: [Poké Transporter GB v1.2.1](https://github.com/Striaton-Lab-Team/Poke_Transporter_GB/releases/tag/1.2.1)
- Multiboot asset: [`Poke_Transporter_GB_v1.2.1.gba`](https://github.com/Striaton-Lab-Team/Poke_Transporter_GB/releases/download/1.2.1/Poke_Transporter_GB_v1.2.1.gba)
- Asset size: 124,024 bytes
- SHA-256: `1875fe0a1e747eabd0943dd32f1eec6611e5a1d3e947acacda4bb7621721cbde`
- Multiboot reference: [GB-Link USB Multiboot](https://multiboot.gblink.io/?from=gblink-launcher)
  and its [source](https://github.com/GB-Link/gba-multiboot-web).
- Backup protocol reference: [GB-Link Cart Doctor](https://cartdoctor.gblink.io/?from=gblink-launcher).
- License: MIT for the project's code; retain the project's Pokémon copyright
  and non-endorsement notice when distributing or presenting the release.

Pin v1.2.1 even when GitHub marks another release latest. Do not silently move
to a beta or a later version. A version change requires reviewing compatibility,
release notes, the asset name, its checksum, and these instructions.

These sites are technical references. PkCamp performs backups and sends the
pinned ROM directly through its shared GB-Link connection. Bundle the verified
release asset with provenance so launching needs no GitHub download, external
page, or file picker. Keep an official release download as a secondary fallback.

## Page layout

Use the same responsive Lab page shell as Cartridge Saves and ROM & BIOS Dumps.
The header has Back to Research Tools, “Poké Transporter GB,” and “Move Pokémon
from Gen 1 or 2 into Gen 3.” The body is one vertical sequence:

```text
┌ Before you begin ─────────────────────────────────────┐
│ Requires two systems, two cartridges, GB-Link, and   │
│ a Game Boy Color link cable. Both saves are changed. │
└───────────────────────────────────────────────────────┘

┌ Back up both games (recommended) ─────────────────────┐
│ GB / GBC source save                                  │
│ Red / Blue / Yellow / Gold / Silver / Crystal         │
│ [Back up GB/GBC save]             Not backed up yet  │
│                                                       │
│ GBA destination save                                  │
│ Ruby / Sapphire / Emerald / FireRed / LeafGreen       │
│ [Back up GBA save]                Not backed up yet  │
└───────────────────────────────────────────────────────┘

[Start Poké Transporter GB]

Version 1.2.1 · Release notes · MIT license
```

On wider screens, put the two backup rows in two equal columns. Stack them on
narrow screens. Keep the primary action below the complete backup section at
every width so the reading and keyboard order remains source backup,
destination backup, then start.

## Backup behavior

Each backup runs inside PkCamp and downloads the `.sav` to the computer. Label
the actions “Back up GB/GBC save” and “Back up GBA save.” Reuse the existing GBA
backup implementation and the GB/GBC dumper path from Cart Doctor.

Track each backup independently: idle, preparing, reading, download started, or
failed. Show the filename after reading succeeds and provide a download-again
action for the bytes retained in memory. The browser cannot prove the user kept
the file, so report “Download started,” not “File saved.” Clear this session-only
status on leaving the page. The page cannot detect a cartridge swap; describe
these as backups downloaded during this visit, not proof of the currently
inserted cartridge's state. Backups are recommended, not a gate.

The integrated backup tasks use different flows for source and destination:

- GB/GBC source: send its dumper by multiboot, insert the source
  cartridge once the GBA enters GBC mode, and dump SRAM with **B**.
- GBA destination: send the dumper, read the cartridge, and download its save.

Backups and transporter launch run sequentially on the shared device. Disable
the other operations while one is active. Keep the USB session for reuse between
tasks, but release each operation's exclusive lease and clean up dumper mode.
The current page also disables launch while a backup panel is open, even after
completion; its idle Cancel closes that panel. Simplifying this interaction is
tracked in the roadmap rather than required by this reference.
After a backup, explain how to reset the GBA into multiboot readiness before
starting Poké Transporter; do not attempt to send into the still-running dumper.

## Primary launch flow

Show connection and GBA preparation instructions above the primary button.
Pressing **Start Poké Transporter GB** starts the integrated operation:

1. Connect or reuse the GB-Link and acquire exclusive access to it.
2. Load and verify the bundled v1.2.1 ROM against its pinned size and SHA-256.
3. Wait for the GBA's multiboot handshake, send the ROM, and show upload progress.
   The GBA should be powered on in multiboot mode, holding START + SELECT when
   the destination cartridge is inserted. Complete CRC validation and boot.
4. Show “Program sent” after protocol completion, then release adapter mode.
   Disconnect the GB-Link from the GBA and connect the two systems
   with a Game Boy Color link cable. A Game Boy Advance link cable will not work.
5. Follow the instructions on the consoles. Insert or retain the Gen 3 cartridge
   as directed by the release, with the GB/GBC source in the second system.

Reuse `src/services/gbaSaveDump/multiboot.ts` and `GbLinkWords` through the shared
device's exclusive transport lease. Compare adapter mode, voltage, timing setup,
handshake, encryption, CRC, and boot sequence against GB-Link's multiboot source.
The existing sender already transfers the Cart Doctor ROM; extract common setup
where appropriate rather than adding an independent USB connection.

Keep bootstrapping separate from Cart Doctor-specific ping and cartridge reads:
Poké Transporter speaks its own protocol after boot. PkCamp can confirm the ROM
was sent, but not that the console-to-console Pokémon transfer succeeded.

## Compatibility and warnings

- Source games: English Red, Blue, Yellow, Gold, Silver, and Crystal.
- Destination games: English, Spanish, German, Italian, and French Ruby,
  Sapphire, Emerald, FireRed, and LeafGreen.
- v1.2.1 is the stable release selected for this page. Present the compatibility
  claimed by that release rather than newer beta-release support.
- Original Gen 3 cartridges are supported. The project also documents EZ-Flash
  Omega Definitive Edition Mode B, which needs its own linked instructions.
- The project warns that bootleg cartridges are incompatible and can cause
  Pokémon loss. Put this warning immediately above the primary action.
- State that transferred Pokémon are removed from the source save and both saves
  are modified. Do not soften this into generic “save changes.”
- This is a physical-hardware workflow; do not offer an emulator path.

## Accessibility and recovery

The backup controls must be keyboard operable and must not encode state by color alone.
On phones, all controls fill the available width without horizontal scrolling.

Show actionable errors for missing permission, missing GBA handshake, disconnect,
checksum mismatch, and failed multiboot. On retry, require the GBA to be reset into
multiboot readiness. Protect active tasks with the existing navigation guard and
abort/cleanup behavior. Preserve completed backup bytes for download again.
After cable handoff, do not claim that the Pokémon transfer completed. Link the
official instructions/issues for transporter-specific failures and document
restoring each downloaded save with a compatible restore tool.
