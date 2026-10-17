# pkCamp architecture

pkCamp is a browser-only React/Vite app. `main.tsx` initializes the shared i18n service; `App` supplies PKHeX and navigation providers. `Campsite` switches
between Start, the six-card world map, Camp, and Lab using component state.
Camp and Lab are enabled; other zones are disabled. Lab remains mounted when
visiting a source Cabin/Camp Site so Back restores its research context.
Navigation guards protect unsaved work and active tasks; shared provider reads
keep editor bytes separate and publish saved sprite preferences site-wide.

The current folders still place Lab and shared React hooks/UI under
`pages/pokestorage/`; services handle parsing, persistence, sprites, and devices.
[Build structure](docs/ARCHITECTURE.md) and directory architecture files cover
those implementations. Keep every architecture file to one page: one or two
current-state paragraphs and one structure/API diagram. Product intent belongs
in [PLAN.md](PLAN.md); milestone/task checklists belong in [ROADMAP.md](ROADMAP.md).

```mermaid
flowchart TB
  Entry["main → App<br/>services/i18n · i18n.init"] --> Providers["PkHexProvider · NavigationProvider<br/>usePkHex · useNavigationGuard"]
  Providers --> Shell["Campsite<br/>openInCamp · returnToLab"]
  Shell --> Hub["hub/<br/>StartMenu · WorldMap · useHubStartup"]
  Shell --> Camp["PokeStorageMain<br/>SaveViewer · LocalPokemonView · TradeView"]
  Shell --> Lab["pokestorage/lab/LabMain<br/>CollectionView · LabTradeTable · LabSettings"]
  Hub & Camp & Lab --> Storage["services/storage<br/>use · getSave · getCamp · saveSettings"]
  Camp & Lab --> Data["services/pkhex · tradeDevice<br/>load · toBytes · runTrade · revertTrade"]
  Hub & Camp & Lab --> Sprites["services/sprites<br/>spriteResolver · preloadSpriteSource"]
```
