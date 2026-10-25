export const languageStorageKey = 'pkcamp.language'
export const availableLanguages = [
  'en',
  // 'es', // Temporarily disabled; keep the catalogs for further review.
]

export function savedLanguage(): string {
  if (typeof window === 'undefined') return 'en'
  try {
    const saved = localStorage.getItem(languageStorageKey)
    if (saved && availableLanguages.includes(saved)) return saved
  } catch {
    // Language selection still works when browser storage is unavailable.
  }
  return 'en'
}

export function saveLanguage(language: string): void {
  if (typeof window === 'undefined') return
  if (!availableLanguages.includes(language)) return
  try {
    localStorage.setItem(languageStorageKey, language)
  } catch {
    // Keep the in-memory selection for this session.
  }
}

/** Show each language in its own language, so it remains recognizable. */
export function languageName(code: string): string {
  const name =
    new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1)
}
