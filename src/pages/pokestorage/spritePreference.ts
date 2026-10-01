import { SPRITE_SOURCES } from './spriteSources'

const STORAGE_KEY = 'pkcamp.spriteSourceId'

/** Reads the stored sprite source choice, or null if unset/invalid/unavailable. */
export function getStoredSpriteSourceId(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value && SPRITE_SOURCES.some((s) => s.id === value)) return value
    return null
  } catch {
    // Private browsing / blocked storage — treat as unset rather than throwing.
    return null
  }
}

export function setStoredSpriteSourceId(sourceId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, sourceId)
  } catch {
    // Ignore — the choice just won't persist this session.
  }
}
