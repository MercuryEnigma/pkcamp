# PkCamp storage and trading

## Storage

Persistence is layered: `FileStore` stores bytes at relative paths;
`FileStoreProvider` implements saves, ROMs, Camps, and settings; `storage` is
the active `StorageProvider`.

- Read UI data with `useStorageProvider()`; write through `storage`.
- `storage.current` is the active provider. `storage.use(provider | null)`
  switches providers; `null` returns to browser-local storage.
- A `StorageProvider` exposes save (`getSave`, `putSave`, history and hardware
  backup methods), ROM, Camp, settings, and `prefetch` operations.
- Dropbox status is `signed-out`, `connecting`, `connected`, or `error`.
  `DropboxAccount` has no public redirect-URI getter.

## GBA Lodge

Each Gen-3 Cabin accepts only its matching save version: Ruby, Sapphire,
Emerald, FireRed, or LeafGreen. `GbaSavePanel` checks the inserted cartridge
before it reads or writes; a GBA write saves the cartridge's existing data as
`hardware.sav` before overwriting it.

## Trading Post

`TradeView` routes local save backups, Camp Sites, GB-Link, and ESP32 sources
through `runTrade`. GBA-to-Switch is a live relay and writes no PkCamp data.
For a GB-Link trade involving PkCamp data, the fallback placeholder is loaded
before the physical session starts. `revertTrade` restores only recorded local
writes; it never changes a GBA or Switch.
