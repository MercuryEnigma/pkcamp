# pkCamp architecture

pkCamp is a browser-only React/Vite app. `main.tsx` initializes the shared i18n service; `App` supplies PKHeX and navigation providers. `Campsite` switches
between Start, the zone-card menu, Camp, and Lab using component state.
The menu opens Camp/Lab and shows Arcade as coming soon; Battle, Safari, and
Pelago cards are hidden. Lab remains mounted when
visiting a source Cabin/Camp Site so Back restores its research context.
Navigation guards protect unsaved work and active tasks; shared provider reads
keep editor bytes separate and publish saved sprite preferences site-wide.

The current folders still place Lab and shared React hooks/UI under
`pages/pokestorage/`; services handle parsing, persistence, sprites, and devices.
[Build structure](docs/ARCHITECTURE.md) and directory architecture files cover
those implementations.

```mermaid
flowchart TB
  Entry["main → App<br/>services/i18n · i18n.init"] --> Providers["PkHexProvider · NavigationProvider<br/>usePkHex · useNavigationGuard"]
  Providers --> Shell["Campsite<br/>openInCamp · returnToLab"]
  Shell --> Hub["hub/<br/>StartMenu · WorldMap · useHubStartup"]
  Shell --> Camp["PokeStorageMain<br/>SaveViewer · LocalPokemonView · TradeView"]
  Shell --> Lab["pokestorage/lab/LabMain<br/>Collections · ResearchTools · Trade Table · Settings"]
  Hub & Camp & Lab --> Storage["services/storage<br/>use · getSave · getCamp · saveSettings"]
  Camp & Lab --> Data["services/pkhex · tradeDevice<br/>load · toBytes · runTrade · revertTrade"]
  Hub & Camp & Lab --> Sprites["services/sprites<br/>spriteResolver · preloadSpriteSource"]
```
