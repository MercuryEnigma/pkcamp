# gblink-wondercards

These files are the Wonder Card sender from
[gblink-wondercards](https://github.com/GB-Link/gblink-wondercards),
revision `24d5b63c8f2c0609afa9497ed648a2bf173cae7a`, copied unmodified from
upstream `src/`:

- `link/{wonder,distributor,mystery-gift,rfu1,save,text,ticker}.js`: the
  Mystery Gift distributor that answers a GBA's MYSTERY GIFT → WIRELESS
  COMMUNICATION through a GB-Link in Wireless Adapter mode.
- `events/{custom-events,goppier-events,descriptor,rfu-identity}.js` and their
  card data, `events/{custom-wondercards,goppier-wondercards,save-payloads}.js`.

Upstream's own WebUSB driver (`link/gblink.js`) and its runner
(`link/distribution.js`) are not included. PkCamp drives the session over its
shared GB-Link transport instead, in `../../gbaGift.ts`.

Licensing: GPL-3.0; see `LICENSE` in this folder. The `.d.ts` files are
hand-written local declarations.
