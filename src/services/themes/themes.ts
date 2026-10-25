import { i18n } from '../i18n'
import type { ThemeId } from './resources'

export const DEFAULT_THEME_ID: ThemeId = 'campsite'
export const themeHintStorageKey = 'pkcamp.theme'

/** Themes offered in Settings › Appearance. */
export const availableThemes: ThemeId[] = ['campsite', 'night']

/** Native controls (selects, scrollbars) follow each theme's scheme. */
export const colorSchemes: Record<ThemeId, 'light' | 'dark'> = {
  campsite: 'light',
  night: 'dark',
}

/** Each theme's name, translated when it's shown. Ids are never translated. */
export function themeLabel(id: ThemeId): string {
  switch (id) {
    case 'campsite':
      return i18n.t('common:themes.campsite')
    case 'night':
      return i18n.t('common:themes.night')
  }
}

/**
 * The last applied theme, so a reload doesn't flash the default while
 * storage settings load. Storage settings remain the saved preference.
 */
export function savedHint(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(themeHintStorageKey)
  } catch {
    // Themes still apply when browser storage is unavailable.
    return null
  }
}

export function saveHint(id: ThemeId): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(themeHintStorageKey, id)
  } catch {
    // The saved preference still applies once storage settings load.
  }
}
