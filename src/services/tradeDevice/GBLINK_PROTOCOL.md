# GB-Link trade-emulation protocol

This implementation follows the official GB-Link host protocol documented and
used by:

- <https://github.com/GB-Link/GBLink-Firmware>
- <https://github.com/Celio-Link/Celio-Client>

The relevant protocol is: WebUSB interface 0, command/status endpoint 1, data
endpoint 2, or the equivalent Web Serial `GB` frames; `Cancel` (`0x01`), then
`SetMode` (`0x00`) with trade-emulation mode (`0x00`); wait for `DeviceReady`
(`0xff08`); upload encrypted 100-byte party records in payloads no larger than
64 bytes; and wait for `EmuTradeSessionFinished` (`0xff09`).

The transport/protocol TypeScript in this directory is an original, minimal
implementation based on those public protocol definitions. No Celio Client or
GB-Link firmware source files are copied into PkCamp.

## Stock firmware limitation

PkCamp works with unmodified GB-Link firmware. In trade-emulation mode the
firmware sends only `DeviceReady` and `EmuTradeSessionFinished` and never
returns the Pokémon received from the GBA.

`GbLinkTradeDevice.trade()` therefore uploads six identical copies of the
selected Pokémon (so whichever slot the GBA player picks, the selected one is
what is traded), ignores every other party slot (no companion is needed), and
waits for `0xff09`. It then emits `hardware-trade-finished` with
`receivedAvailable: false` and resolves with `trades: []` and the input party
unchanged. The route layer decides what replaces the unknown Pokémon.

## Reading a cartridge save

`GbLinkTradeDevice.readSave()` (see `src/services/gbaSaveDump/`) reads a GBA
cartridge save with stock firmware, the same way GB-Link Cart Doctor does:
`SetVoltage3V3` (`0x40`), `SetMode` GB link (`0x02`) and `SetTimingConfig`
(`0x30`, 36 µs, 4 bytes per transfer). It then multiboots Cart Doctor's dumper
and runs its 32-bit SIO protocol (`CMD_INFO`, `CMD_DUMP_SAVE`). It finishes by
sending `Cancel` so a later trade starts from idle.

## GBA ↔ Switch

GBA ↔ Switch trading is a live relay between a GB-Link and an ESP32 running the
GB-Link-Switch-LDN bridge firmware, both on USB. Each player picks a Pokémon on
their own console. PkCamp stores and writes nothing, and the National Dex
bypass is never enabled.

It needs GB-Link firmware 2.2.7 or newer. PkCamp reads the version with
`GetFirmwareInfo` (`0x0F`) and refuses older or unknown firmware. To update,
`RebootBootloader` (`0x43`) puts the GB-Link into its USB bootloader, and the
user copies the `.uf2` from the GB-Link GitHub release to the `RPI-RP2` drive.
PkCamp never ships or flashes firmware.

- **FireRed/LeafGreen/Emerald (wireless):** the ESP32 drives the GB-Link into
  wireless mode (`0x07`) itself. The page only relays GB frames between the
  ESP32 adapter port (set to host) and the GB-Link (`Bridge`).
- **Ruby/Sapphire (cable):** the GB-Link runs cable mode (`0x01`) and the page
  translates the cable protocol to the Switch's room (`CableSession`).

`GbLinkTradeDevice.linkAdapter()` hands the relay the GB-Link under its busy
guard, and `Esp32TradeDevice.runLink()` runs the session until it is aborted.
