# i18n architecture

The main application and standalone Arcade player both import `services/i18n`.
`config.ts` initializes one shared i18next instance synchronously using bundled
resources. English is the fallback language; `common` is the default namespace. The shared
header language button offers registered catalogs and saves the selection in
`localStorage` for both entry points. This preference stays in the browser and
is never included in Dropbox or synced settings. English is currently the only catalog.
Unavailable or inaccessible saved preferences fall back to English.
React escapes translated text, so i18next interpolation escaping is disabled.
The rendered language updates the document's `lang`; each entry sets its title.

## Catalog ownership

Catalogs live at `src/services/i18n/{page}/{lang-code}.json`. `resources.ts`
registers namespaces explicitly; `i18next.d.ts` derives key and namespace types
from English resources and rejects unknown translation keys.

| Namespaces                                                          | Ownership                                                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `common`                                                            | Repeated actions, area names, metadata, shared formats                 |
| `start`, `hub`                                                      | Startup, cartridge chooser, navigation, shared shell                   |
| `camp`, `trade`, `pokemon-details`                                  | Storage screens, trade UI, Pokémon labels                              |
| `lab`, `collections`                                                | Lab shell, research tools layout, collection screens and built-in copy |
| `transporter`, `mystery-gifts`, `cartridge-saves`, `rom-bios-dumps` | Individual tools                                                       |
| `settings`, `news`, `arcade`                                        | Settings, articles, emulator and skins                                 |
| `services`                                                          | App-owned storage, device, runtime, validation and progress messages   |

Use semantic nested keys grouped by screen/helper and purpose. Existing screen
sections use their component names (for example `StartMenu.readSave`). Reuse
`common:actions` for equivalent shared actions; keep context-specific sentences
with their feature. Keys do not depend on line numbers or English text at runtime.

## Consumers and data boundaries

React consumers use `useTranslation([namespace, 'common'])`; rich paragraphs use
`Trans` with explicit React components for links/emphasis. Translators may reorder
these components, while URLs and behavior stay in React. Do not store raw HTML in
catalogs or reintroduce `dangerouslySetInnerHTML` for translated content.

Framework-free services and helpers call the shared `i18n.t()` at execution time.
Label arrays/maps are functions so importing a module does not freeze translated
labels. Add `t` to React callback/memo dependencies when the calculation uses it.
Avoid storing translated labels as IDs or matching against them. Existing error
classes/codes, event shapes, and callback signatures remain intact; external
errors and device diagnostics are retained as interpolated details.

Use complete sentences, named interpolation parameters, and `_one` / `_other`
plural forms with a numeric `count`. Do not append English plural suffixes or
build sentences from separately translated fragments. `format.ts` supplies
locale-aware date, number, list, and relative-time formatting; instantiate
formatters when used, rather than caching the browser's locale at module load.
Use localized formatting for display counts, while IDs, filenames, and protocol
values keep their original representation.

`collectionDisplay()` resolves built-in collection/group copy by stable IDs for
presentation. It only accepts the built-in objects as localizable content;
uploaded definitions (even a separate object with the same ID) retain their text.
Stored definitions, constraints, IDs, and serialized exports are not localized.
Pokémon/game terminology, brands, user/imported content, third-party source,
license text, and artwork text remain outside this English extraction.

## Adding copy or a language

1. Add the English key to the owning namespace and use it from the consumer.
2. For another language, add the matching `{namespace}/{lang-code}.json` files
   and register them in `resources.ts` under that language code. Keep English
   as the type source and fallback; preserve interpolation/component names.
3. Enable reviewed languages in `availableLanguages` in `languages.ts`. The
   selector shows only those languages, each named in its own language. Spanish
   is temporarily commented out; its catalogs remain registered for translation
   tests. Saved preferences for disabled languages fall back to English.
4. Run `npm run check:i18n`, `npm test`, `npm run lint`, and `npm run build`.

The AST copy guard checks JSX text and presentation attributes, including nested
conditional values and tool instructions. Its exact proper-name/hardware-label
exceptions include a reason in `scripts/check-i18n.mjs`; do not add blanket
exemptions for capitalized or short text. The guard cannot infer arbitrary helper
or service return values: review those messages explicitly alongside catalog
changes. Tests cover catalog registration, fallback, pluralization, interpolation,
React/rich-text rendering, dynamic helper labels, locale formatting, collection
data integrity, and filtering independent of presentation labels.

## Translation review

Translate complete sentences rather than replacing individual English words.
Use consistent Spanish UI terms: campamento, parcela, cabaña, partida guardada,
copia de seguridad, ajustes, and Pokémon variocolor. The Spanish level label is
`Nv.`, and the Missing collection status is `Sin registrar`. The catalog is
European Spanish: quote with « », and use the present perfect for events that
just happened (`Se ha descargado`, `No se ha podido`). Keep placeholders (`{{level}}`, `{{name}}`), component tags (`<part1>`),
JSON/schema identifiers, filenames, project names, and physical button/menu
labels unchanged. Instructions that refer to literal in-game menu commands
retain those commands so players can match them on screen.

Catalog tests check interpolation and component-tag parity, along with rendered
Spanish Camp/Transporter regressions. These checks protect structure and known
failures; they do not replace reviewing the Spanish prose for meaning and grammar.

Game names in selectors, headers, and related UI use `common:games` through
`getGameLabel()`. The canonical `GAME_LABEL` map remains English for download
filenames. Game IDs, routes, and save-version matching never use translated labels.
