# Themes architecture

The main application and standalone Arcade player both apply `services/themes`.
`config.ts` writes every token of one bundled theme onto the document root as
inline custom properties, above every stylesheet's `:root` rule, and sets the
root's `color-scheme` and `data-theme`. Campsite is the default and fallback.
Page CSS only references tokens, so swapping a theme repaints every zone.

The preference is `themeId` in `StorageSettings`, beside `spriteSourceId`, so it
follows the selected storage (this browser or Dropbox). Settings › Appearance
stages it with the sprite source and saves both with Save Settings; the
navigation guard covers an unsaved change. Choosing a theme there applies it
immediately as a preview, without touching storage or the boot hint, and
leaving Settings without saving restores the saved theme. `useSavedTheme()` applies it once
settings load, from `useHubStartup` (main entry) and `ArcadePlayer`. Importing
the service applies the last applied theme from `localStorage`
(`pkcamp.theme`) synchronously, so a reload doesn't flash Campsite while
settings load. That hint is a boot cache only; storage settings always win.

## Catalog ownership

Catalogs live at `src/services/themes/{namespace}/{theme-id}.json`.
`resources.ts` registers them per theme; `ThemeCatalog` derives namespace and
token types from Campsite, and every theme must define every token. There is
no per-token fallback, because mixing light and dark tokens breaks contrast.

| Namespace | CSS name   | Ownership                                                                  |
| --------- | ---------- | -------------------------------------------------------------------------- |
| `common`  | `--{key}`  | `index.css` root text, headings, page background and `#root` border        |
| `camp`    | `--camp-*` | Shared Camp look: Start, hub, Camp, Lab chrome, Arcade zone, header badges |
| `pc`      | `--pc-*`   | Lab Pokédex terminal and the Settings workstation built from it            |
| `cabinet` | `--cab-*`  | Arcade player cabinet, power button and pause menu                         |

## Tokens

Tokens are named by role, not by color: `surface`, `panel-border`, `leaf`,
never `paper` or `wood`. A color used both as a fill and as text gets two
tokens (`leaf` / `leaf-text`, `danger` / `danger-text`, `red` / `red-text`),
and text drawn on a fill gets an `on-*` token (`on-leaf`, `on-danger`,
`pc-on-fill`), so a dark theme can invert one without the other. Shadows use
their own base colors (`shadow-color`, `leaf-shadow`) rather
than text colors, which turn light in Night. Catalog values are six-digit hex.

Page CSS never contains color literals. Translucency mixes a token with
transparent, `color-mix(in srgb, var(--camp-leaf) 12%, transparent)`, so a
theme sets one base color instead of each alpha. Page CSS may still define
custom properties as `var()` composites or non-color values: `.camp-root`
derives `--camp-shadow`, `--camp-accent-soft` and the `--camp-select-*-soft`
tints; `.arcade-player` aliases `--cab-edge` and `--cab-focus`. The
`--camp-dropbox-*` aliases stay scoped to `.camp-zone`, so Arcade badges get
the paper-and-wood look while Start/Hub header badges stay bare.

Outside the themes: game version colors (`--arcade-version`, the Camp grid's
`data-game` titles), Pokémon type colors in `gen3Data.ts`, the GBA cartridge
illustrations, the emulator screen surround and the DeltaSkin debug overlay.
Like Pokémon terminology in i18n, these are game data or depictions of real
hardware.

## Campsite and Night

Campsite is the pre-theme palette: summer-camp notice board, warm canvas and
paper, forest-green and wood accents, a campfire highlight. The duplicated
`--camp-*` palettes in `camp.css`, `hub.css` and `arcadeZone.css` disagreed on
`--camp-muted`, but every rendered screen used `#7b6248`, so that is the token.
Near-identical shades that served one role were folded into a single token
(details text, stat rows, soft dividers, warm shadows, pressed red edges, PC
cream cards), and the almost-flat surface gradients became flat fills. Night keeps the same structure after dark: a night-forest board,
dim surfaces, moonlit text and a firelight accent. Both use flat fills; the
remaining gradients are Campsite's existing glows, kept as `*-glow` tokens.

Known gaps carried over from before themes: Campsite's stat "lowered" blue
(`select-blue-text`) is 2.9:1 on its row, below WCAG AA, and the Arcade
message banner references `--cab-paper`, which nothing defines, so it has no
fill.

## Adding a color or a theme

1. Prefer an existing role. For a new one, add the token to every theme's
   catalog in the owning namespace, then use `var(--{prefix}{key})`.
2. For a new theme, add `{namespace}/{theme-id}.json` for every namespace,
   register it in `resources.ts`, give it a `colorSchemes` entry and a
   `common:themes` name in every language, and add it to `themeLabel`.
3. Enable reviewed themes in `availableThemes` in `themes.ts`. Like a disabled
   language, a registered theme can stay out of the picker; saved preferences
   for it fall back to Campsite.
4. Run `npm test`, `npm run check:i18n`, `npm run lint`, and `npm run build`.

`colorLiterals.test.ts` fails on any color literal in `src/**/*.css` outside
its exact exception list (each with a reason), on an exception that no longer
matches anything, on a `--camp-`/`--pc-`/`--cab-` reference that is neither a
token nor defined in CSS, and on a token no stylesheet uses. `themes.test.ts`
checks catalog parity, hex values, WCAG AA contrast for listed text/surface
pairs in every registered theme, fallback and the root writes. Review new
themes in the browser too; the contrast list covers known pairings, not every
screen.
