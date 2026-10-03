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
