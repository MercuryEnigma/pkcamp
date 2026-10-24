import { useMemo } from 'react'
import type { ControllerSkin } from './controllerSkin'
import { defaultSkinArchive } from './defaultSkin'
import { normalizeDeltaSkin, type NormalizeOptions } from './normalizeDeltaSkin'
import type { SkinLibraryState } from './useSkinLibrary'

/**
 * The skin to play, laid out for this window: the selected one, else pkCamp's
 * default. The layout follows the window, so turning a phone swaps portrait
 * for landscape.
 */
export function useDeltaSkin(
  { archive }: Pick<SkinLibraryState, 'archive'>,
  { orientation, device }: NormalizeOptions
): ControllerSkin {
  return useMemo(() => {
    const options = { orientation, device }
    if (archive) {
      try {
        return normalizeDeltaSkin(archive, options)
      } catch {
        // An unusable skin plays the default instead.
      }
    }
    return normalizeDeltaSkin(defaultSkinArchive(), options)
  }, [archive, orientation, device])
}
