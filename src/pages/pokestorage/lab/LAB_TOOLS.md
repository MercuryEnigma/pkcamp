# Research Tools scope

Research Tools is a Lab workspace for cartridge saves, ROM and BIOS dumps,
Mystery Gifts, and Poké Transporter GB. The current design is in [PLAN.md](PLAN.md)
and implementation status is tracked in [ROADMAP.md](ROADMAP.md).

## Cartridge Saves

- **Backup:** download a `.sav` from any GBA cartridge using GB-Link's Cart
  Doctor backup tool. The game is detected from the cartridge header and names
  the file, such as `Pokemon Emerald (BPEE).sav`. Switch save download via a Mystery Gift script and
  ESP32 is in research; its feasibility has not been established.
- **Restore:** choose a Gen 3 `.sav` from the computer. PKHeX detects its game,
  and the cartridge must match it and the save size. The current cartridge save
  is stored as that game's Cabin `hardware.sav` before writing.
- **Repair:** coming soon for the Ruby/Sapphire berry glitch and RTC changes.
  Specify compatibility, backup, and recovery before enabling a repair.

GBA save operations reuse `src/services/gbaSaveDump` and the shared GB-Link
device. Tasks share one GB-Link connection while the player stays in Research
Tools, and the Lab releases it on leaving. GB/GBC save operations and erase are outside the current workspace scope.
Implementation and hardware-verification status are tracked in [ROADMAP.md](ROADMAP.md).

## ROM & BIOS Dumps

The ROM & BIOS Dumps page downloads a GBA cartridge ROM, named from its header,
or the 16 KB GBA BIOS as `gba_bios.bin`. Both use the bundled Cart Doctor dumper;
the BIOS needs no cartridge. Dumps only go to the computer and never enter
storage or Dropbox. GB/GBC ROM dumps and known-good hash checks are still to
come.

## Mystery Gifts

One page picks the hardware, GBA (GB-Link) or Switch (ESP32), then one of six
Wonder Cards: Altering Cave, Fast Forward ×4, Pokémon Follow, PC Anywhere,
Reusable TMs, and Trade Evolution Without Trading. A link opens GB-Link's own
page for every other card on that hardware. **Start** opens a Mystery Gift group
that sends the chosen card to each console that joins, until **Stop**. Start the
sender and wait for Ready before choosing Mystery Gift in the game. Startup
offers Cancel; leaving active work requires the shared navigation warning.

- **GBA:** Emerald, FireRed and LeafGreen in every language, through the GB-Link
  in Wireless Adapter mode (firmware 2.2.7+), with the vendored
  gblink-wondercards distributor.
- **Switch:** FireRed and LeafGreen on Nintendo Switch Online, through the ESP32
  board (firmware 2.1.0+, Switch keys required), with the vendored
  GB-Link-Switch-LDN gift distribution.

The games' own checks decide what is sent: a console that already holds the card
is asked before it is replaced, and an unsupported game gets nothing. Nothing is
stored. Firmware maintenance is available in shared Settings, which shows the
installed/latest GB-Link version and checks/updates automatically.

## Poké Transporter GB

The [Poké Transporter GB page reference](POKE_TRANSPORTER_GB.md)
pins the official v1.2.1 release and puts optional GB/GBC and GBA save backups
above the primary action. Both backups run in PkCamp. Start sends the bundled
official `.gba` through GB-Link using GBA multiboot, then guides the switch to a
Game Boy Color link cable. GB-Link's web tools are protocol references.
GB/GBC source backups use the bundled GBC-mode Cart Doctor dumper and validate
per-section XOR checksums. GBA destination backups reuse the GBA save reader.
Completed backups remain in memory for download again until leaving the page.

R/S Mystery Event, GameCube-era events, cartridge authenticity checks, Save
Inspector, and emulator handoff/conversion remain deferred.
