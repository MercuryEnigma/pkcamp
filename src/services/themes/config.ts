import {
  prefixes,
  resources,
  type ThemeCatalog,
  type ThemeId,
} from './resources'
import {
  availableThemes,
  colorSchemes,
  DEFAULT_THEME_ID,
  savedHint,
  saveHint,
} from './themes'

/** Unknown, disabled, or missing ids use the default theme. */
export function resolveTheme(id: string | null | undefined): ThemeId {
  return availableThemes.find((theme) => theme === id) ?? DEFAULT_THEME_ID
}

/** Every token of an enabled theme (or the default) as CSS custom properties. */
export function themeTokens(id: string | null | undefined) {
  return catalogTokens(resources[resolveTheme(id)])
}

export function catalogTokens(catalog: ThemeCatalog) {
  const tokens: Record<string, string> = {}
  for (const namespace of Object.keys(prefixes) as (keyof ThemeCatalog)[]) {
    for (const [key, value] of Object.entries(catalog[namespace])) {
      tokens[`${prefixes[namespace]}${key}`] = value
    }
  }
  return tokens
}

/**
 * Writes the theme onto the document root, above every stylesheet's `:root`
 * rule, so page CSS only ever references tokens. A preview (`remember:
 * false`) leaves the boot hint on the saved theme.
 */
export function applyTheme(
  id: string | null | undefined,
  { remember = true }: { remember?: boolean } = {}
): ThemeId {
  const theme = resolveTheme(id)
  if (typeof document === 'undefined') return theme
  const root = document.documentElement
  for (const [name, value] of Object.entries(themeTokens(theme))) {
    root.style.setProperty(name, value)
  }
  root.style.colorScheme = colorSchemes[theme]
  root.dataset.theme = theme
  if (remember) saveHint(theme)
  return theme
}

// All catalogs are bundled; applying synchronously avoids a flash on boot.
applyTheme(savedHint())
