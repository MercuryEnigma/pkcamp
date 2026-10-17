# GB-Link Cart Doctor

`gba-cart-dumper_mb.gba` is the unmodified GBA multiboot save dumper from
[gb-cart-doctor-web](https://github.com/GB-Link/gb-cart-doctor-web),
revision `12aa211923add22a567e5c4310ebb45605cd49bf` (`web/gba-cart-dumper_mb.gba`,
SHA-256 `07df90a6de9a5af420493b1ce42ce030e51a41ac1dd1286839f1cb84adc45e61`).
Its source (`source/gba_cart_dumper/`) is a port of FIX94's GBA Link Cable
Dumper and is MIT-licensed.

The host protocol in `../../multiboot.ts` and `../../gbaCartClient.ts` is a
TypeScript port of `web/multiboot.js` and `web/gba_cart.js` from the same
revision, which are licensed under GPL-3.0; see `LICENSE` in this folder.

`gba-switch-to-gbc_mb.gba` is the unmodified GB/GBC backup dumper from the same
revision (`web/gba-switch-to-gbc_mb.gba`), SHA-256
`ed1d58599273b10480a719a25eb05644ed199de03d132b91e05ada007946ded2`.
`../../readGbSave.ts` ports the SRAM receive portion of
`web/dump_receiver_fast.js` and the mode/timing setup in `web/app.js` under
GPL-3.0. It accepts only save transfers and validates section XOR checksums.
