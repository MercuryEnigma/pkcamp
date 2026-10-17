# Sprite architecture

Normalized Pokémon requests resolve to a verified asset path or an explicit
fallback. Generated manifests describe PokeAPI, Shuffle, PokémonDB, and PMD
SpriteCollab coverage; resolution does not parse saves or perform I/O.
`catalog.ts` owns selectable sources and page consumers import it directly.

`resources.ts` caches one resolver per source and preloads selected base images
through a six-request queue. Paths/successes are deduplicated; changing source
replaces queued work while active requests finish, and failures do not stall
the queue. Saved provider settings update React consumers; the persistent hub
startup hook requests preloading. Images still come from third-party hosts.

```mermaid
flowchart TB
  Generated["generated*.ts"] --> Sources["sources / pokemonDbSource / pmdCollabSource"]
  Sources --> Catalog["catalog.ts<br/>SPRITE_SOURCES · DEFAULT_SPRITE_SOURCE_ID"]
  Sources --> Pure["resolver.ts<br/>resolveSpriteFromManifest · initializeSpriteResolver"]
  Catalog & Pure --> Resources["resources.ts<br/>spriteSource · spriteResolver · preloadSpriteSource"]
  Resources --> Queue["SpritePreloader<br/>preload · drain → browser Image"]
  Settings["useStorageSettings"] --> Hooks["useSpriteResolver · useHubStartup"]
  Hooks --> Resources
```
