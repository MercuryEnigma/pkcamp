# Research Tools plan

Research Tools gives players one place in Celio's Lab to preserve cartridges,
send Mystery Gifts, and prepare a Gen 1–2 transfer into Gen 3. Its four
workspaces are Cartridge Saves, ROM & BIOS Dumps, Mystery Gifts, and Poké
Transporter GB. The [roadmap](ROADMAP.md) tracks delivery and verification;
[LAB_TOOLS.md](LAB_TOOLS.md) defines detailed scope.

## Navigation and presentation

Use the same responsive page shell and Back-button placement as Camp. The hub
shows four readable cards in two columns where space permits, stacking them in
the same order on small screens. Each card opens its own workspace, and Back
returns to the hub. Tools remain browsable without device access; permission is
requested when the player starts an operation. Show short instructions with one
action per step and clear progress, results, and recovery guidance.

## Workspaces

**Cartridge Saves** downloads GBA saves to the computer and restores a selected
Gen 3 save to a matching cartridge. Restore requires matching game/size checks
and a successful backup of the original cartridge save before any write.
Repair is planned for Ruby/Sapphire berry and RTC issues, with diagnosis and
backup before changes. Switch save download via Mystery Gift remains research;
Switch restore, erase, and general GB/GBC save management are outside this
workspace's scope.

**ROM & BIOS Dumps** preserves GBA cartridge ROMs and the GBA BIOS as local
downloads. ROM and BIOS bytes stay on the computer regardless of account storage.
Future work includes GB/GBC ROM dumps and known-good hash reporting that clearly
distinguishes verified, mismatched, and unknown files.

**Mystery Gifts** sends curated Wonder Cards to compatible GBA games through
GB-Link or Switch games through ESP32, with links to the upstream catalogs.
Instructions must tell players to start the sender and wait for Ready before
choosing Mystery Gift in the game. Compatibility and replacement decisions stay
visible, and the player can stop the group or cancel startup.

**Poké Transporter GB** offers independent, optional GB/GBC source and GBA
destination backups before the primary launch action. It sends the pinned
v1.2.1 program directly through GB-Link using GBA multiboot, then guides the
handoff to a Game Boy Color link cable. Explain that transferred Pokémon leave
the source and both saves change. A successful launch confirms the program was
sent; the consoles complete the Pokémon transfer. Detailed compatibility and
interaction requirements are in [POKE_TRANSPORTER_GB.md](POKE_TRANSPORTER_GB.md).

## Hardware and recovery

Reuse device connections between sequential tasks while preventing competing
operations. Cancel/Stop controls and leave warnings should protect active work
without adding unnecessary confirmation steps. A canceled chooser must not start
work later, and closed pages must not receive stale results. Interrupted
cartridge writes must never be presented as rolled back.

Shared hardware settings and safe firmware maintenance follow the
[Camp plan](../PLAN.md#trading-and-physical-devices). Results should distinguish a local
download being started, a backup being stored, a program being sent, and a
console transfer being completed.

## Deferred scope

Repair, Switch save download, GB/GBC ROM dumping, and stronger hash/recovery
features need their own supported-device and failure contracts. Later ideas
include R/S Mystery Event, GameCube events, cartridge authenticity checks,
Save Inspector, emulator handoff/conversion, and additional generations.
